// 표본 재검증(Opus 5.5) 결과를 DB 에 저장한다 — 고친 값은 이 대화에서 근거(감사 출처)를 보고 정했다.
//
//   node --env-file=.env.local scripts/audit-apply.mjs            보기만 (바뀔 내용을 찍는다)
//   node --env-file=.env.local scripts/audit-apply.mjs --apply    적기 (먼저 data/backup/audit-fixes-2026-10-02.json 에 원래 값을 남긴다)
//
// 하는 일
//   1) 재검증한 32종 모두 catalog.audit 에 판정 요약·틀린 주장을 남긴다 (내용은 바꾸지 않는다)
//   2) 틀렸거나 일부 틀린 주장 21개를 고친다 — 근거가 있는 값으로 바꾸거나, 확인되지 않은 부분만 뺀다
//      고친 내역은 verified.corrections 에 by: "audit-opus-5-5" 로 덧붙이고, 바뀐 칸의 옛 번역은 지운다(i18nStale)
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const BACKUP = "data/backup/audit-fixes-2026-10-02.json";
const BY = "audit-opus-5-5";
const rep = JSON.parse(readFileSync("data/research/_work/audit-report.json", "utf8"));

// ── 고칠 내용 (key → 칸별 새 값). specRows 는 같은 label 의 value 만 바꾼다 ──
const PATCHES = {
  "스택스립와인셀라카스크23|": {
    specRows: {
      품종: ["카베르네 소비뇽 (2019년산 등 최근 빈티지는 100%)", "'2004년 이후'라는 기준은 공식 기록과 다름(1983년산도 100%)"],
      숙성: ["프렌치 오크 15~24개월(빈티지별), 새 오크 비율 8~100% (2019년산은 21개월·새 오크 100%)", "공식 기록의 숙성 기간은 15~24개월"],
      생산: ["특별히 좋은 해에만 만듦", "'1974~2003년 12개 빈티지 남짓'은 확인되지 않아 뺌"],
    },
  },
  "다테세븐시즌2준마이다이긴조|": {
    history: [
      [{ year: "2015", event: "미야기현 7개 양조장이 아키타의 NEXT5에 자극받아 DATÉ SEVEN을 결성합니다 (2015년 7월 발표)" }, "결성은 2014년이 아니라 2015년으로 소개됨", "2014"],
      { keep: "2015" },
      [{ year: "2022", event: "시즌2가 시작됩니다. 리더 양조장 2곳이 같은 원료로 각자 개성의 술을 냅니다" }, "원료미·효모를 미야기산으로 바꾼 것은 2022년이 아니라 2026년판"],
      [{ year: "2026", event: "에피소드5. 처음으로 쌀과 효모를 모두 미야기현산으로 통일한 '올 미야기' 양조. 7월 3일 발매, 개봉 가능일은 7월 7일 오후 7시. 리더는 야마와와 고가네사와입니다" }, "올 미야기 양조는 2026년판부터"],
    ],
  },
  "신퀀타꼴레지오네|": {
    set: {
      region: ["풀리아 (현재 라벨 표기는 Vino Rosso d'Italia — 지역 표시 없음. 예전 병은 Salento IGT)", "현재 공식 표기는 Vino Rosso d'Italia"],
      trivia: ["이름의 '신퀀타(Cinquanta)'는 이탈리아어로 '50'으로, 칸티네 산 마르차노 창립 50주년을 기념한 이름입니다.", "'포도나무 수령 50년'이라는 뜻은 근거가 없어 뺌"],
    },
  },
  "베서니이스트그라운드쉬라즈|": { set: { alcohol: ["14~14.5% (빈티지별: 2017년 14%, 2020·2022년 14.5%)", "13.5% 는 일부 출처에만 보임"] } },
  "콜레캉프리바다모스카텔드세투발아르마냑|": {
    specRows: { 수상: ["2008 빈티지 와인 인수지애스트 93점 (공식 소개: 2001 빈티지 와인 인수지애스트 92점, 2002 빈티지 레비스타 드 비뉴스 17.5/20)", "'2002 빈티지 파커 91점'은 공식 기록에 없음"] },
    category: ["wine", "모스카텔 드 세투발(주정강화 와인)이다 — 아르마냑은 발효를 멈출 때 넣는 브랜디일 뿐"],
  },
  "둔츠레전드로제브뤼|": {
    set: {
      region: ["샹파뉴 (몽타뉴 드 랭스·코트 드 세잔)", "이 로제는 두 구역을 섞음"],
      story: ["샹파뉴의 둔츠(Duntze) 가문이 내놓는 '레전드' 컬렉션의 로제입니다. 레전드 컬렉션은 한 테루아의 특징을 살리는 것을 내세우지만, 이 로제는 몽타뉴 드 랭스와 코트 드 세잔 두 곳을 섞은 예외입니다.", "이 로제는 단일 테루아 원칙의 예외 · 뒤츠(Deutz)와 다른 집이라 표기를 둔츠로"],
    },
    specRows: { "당도(도사주)": ["브뤼 (이 로제는 리터당 8g, 레전드 컬렉션은 6~9g)", "도사주는 6~9g/L, 이 로제는 8g/L"] },
    historyAll: [[
      { year: "1816", event: "둔츠 가문의 계보가 시작된 해로 소개됩니다" },
      { year: "1913", event: "조르주 프레데리크 둔츠가 아비즈에서 샴페인 하우스를 세웁니다" },
      { year: "2012", event: "손자 빅토르 둔츠가 브랜드를 다시 엽니다" },
    ], "1816년은 사업 시작이 아니라 가문 계보의 시작 · 하우스 설립은 1913년"],
  },
  "리뎀션라이|": {
    history: [[{ year: "2010", event: "데이브 슈미어(Dave Schmier)와 마이클 칸바(Michael Kanbar)가 호밀 위스키 브랜드로 리뎀션을 시작 (Bardstown Barrel Selections)" }, "출시는 2010년"], { keep: "2015" }],
  },
  "도멘뒤작모레생드니|": {
    history: [{ keep: "1967" }, [{ year: "1999", event: "자크 세스가 아들들에게 운영을 넘기기 시작하면서 일부 송이를 제경하고 새 오크 비율을 낮추는 쪽으로 방식이 바뀜 (제레미는 1998년, 알렉은 2003년 합류)" }, "1999년에 두 아들이 함께 이어받은 것은 아님"], { keep: "2011" }],
  },
  "올메카데킬라실버|": { specRows: { "원료 산지": ["할리스코 로스 알토스(고지대)의 블루 웨버 아가베", "'남부'라는 한정은 근거 없음"] } },
  "박준미명인청주신선탁주12도충북무형문화재무감미료|": { specRows: { 원료: ["국내산 찹쌀, 앉은뱅이밀 누룩, 청주 지하수, 생지황·숙지황·인삼·당귀 등 약재 (전통 처방은 12가지, 지금은 지골피·계피를 뺀 10가지)", "지금은 10가지를 넣음"] } },
  "칼스버그|": { set: { region: ["덴마크 (지금 덴마크산은 프레데리시아 양조장, 원래 코펜하겐 발뷔에서 시작)", "현재 덴마크산 칼스버그 필스너는 프레데리시아에서 양조"] } },
  "360루아르소비뇽블랑발데루아르|": { replace: { winery: ["스스로를 루아르·투렌 AOC 와인의 최대 생산자라고 소개합니다.", "스스로를 루아르 밸리 1위 생산자라고 소개합니다.", "'투렌 AOC 최대 생산자'는 확인되지 않음"] } },
  "강산명주참복분자주13도|": { replace: { winery: ["보리 증류소주 모리와", "오크 숙성 증류주 모리(Morry)와", "원료가 보리라는 점은 확인되지 않음"] } },
  "g7메를로|": { set: { alcohol: ["13%", "빈티지별 범위 12~14%는 확인되지 않음"] } },
};

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const auditedKeys = rep.perItem.map((x) => x.key);
const docs = await col.find({ key: { $in: auditedKeys } }, { projection: { key: 1, name: 1, category: 1, result: 1, verified: 1, i18n: 1, i18nStale: 1, audit: 1 } }).toArray();
const byKey = new Map(docs.map((d) => [d.key, d]));
const now = new Date();
const ops = [], backup = [], diffs = [];

for (const it of rep.perItem) {
  const d = byKey.get(it.key);
  if (!d) { console.log("DB 에 없음:", it.name); continue; }
  const probs = rep.problems.filter((p) => p.key === it.key);
  const audit = { by: "claude-opus-5-5", at: now, kind: "sample-recheck", claims: it.claims, correct: it.correct, wrong: it.wrong, partly: it.partly, unverifiable: it.unverifiable, note: it.note, problems: probs.map(({ field, claim, correct, source, quote, verdict }) => ({ field, claim, correct, source, quote, verdict })) };
  const set = { audit }, unset = {}, corrections = [], changed = new Set();
  const P = PATCHES[it.key];
  if (P) {
    const r = d.result || {};
    for (const [f, [v, why]] of Object.entries(P.set || {})) { corrections.push({ field: f, was: r[f] ?? null, now: v, why }); set[`result.${f}`] = v; changed.add(f); }
    for (const [f, [from, to, why]] of Object.entries(P.replace || {})) {
      const cur = String(r[f] || "");
      if (!cur.includes(from)) throw new Error(`${d.name}: ${f} 에서 바꿀 문장을 못 찾음 — ${from}`);
      const v = cur.replace(from, to); corrections.push({ field: f, was: from, now: to, why }); set[`result.${f}`] = v; changed.add(f);
    }
    if (P.specRows) {
      const specs = (r.specs || []).map((s) => ({ ...s }));
      for (const [label, [v, why]] of Object.entries(P.specRows)) {
        const row = specs.find((s) => s.label === label);
        if (!row) throw new Error(`${d.name}: 제원 '${label}' 줄이 없음`);
        corrections.push({ field: `specs.${label}`, was: row.value, now: v, why }); row.value = v;
      }
      set["result.specs"] = specs; changed.add("specs");
    }
    if (P.history || P.historyAll) {
      let hist;
      if (P.historyAll) { const [arr, why] = P.historyAll; hist = arr; corrections.push({ field: "history", was: r.history ?? null, now: arr, why }); }
      else {
        const cur = r.history || [];
        hist = P.history.map((h) => {
          if (h.keep) { const row = cur.find((x) => String(x.year) === h.keep); if (!row) throw new Error(`${d.name}: 연표 ${h.keep} 없음`); return row; }
          const [row, why, fromYear] = h; // fromYear: 연도 자체를 고칠 때 원래 연도
          const old = cur.find((x) => String(x.year) === (fromYear || row.year)) || cur[P.history.indexOf(h)];
          corrections.push({ field: `history.${row.year}`, was: old ? `${old.year} ${old.event}` : null, now: `${row.year} ${row.event}`, why });
          return row;
        });
      }
      set["result.history"] = hist; changed.add("history");
    }
    if (P.category) { const [c, why] = P.category; corrections.push({ field: "category", was: d.category, now: c, why }); set.category = c; set["result.category"] = c; }
    for (const f of changed) { unset[`i18n.en.${f}`] = ""; unset[`i18n.ja.${f}`] = ""; }
    backup.push({ key: d.key, name: d.name, category: d.category, result: d.result, verified: d.verified, i18n: d.i18n, i18nStale: d.i18nStale ?? null });
    diffs.push({ name: d.name, corrections });
  }
  const update = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  const push = corrections.map((c) => ({ ...c, by: BY, at: now }));
  if (push.length) update.$push = { "verified.corrections": { $each: push } };
  if (changed.size) update.$addToSet = { i18nStale: { $each: [...changed] } };
  ops.push({ updateOne: { filter: { _id: d._id }, update } });
}

for (const x of diffs) {
  console.log(`\n■ ${x.name}`);
  for (const c of x.corrections) console.log(`  ${c.field}: ${typeof c.was === "string" ? c.was.slice(0, 90) : JSON.stringify(c.was).slice(0, 90)}\n      → ${typeof c.now === "string" ? c.now.slice(0, 110) : JSON.stringify(c.now).slice(0, 110)}  (${c.why})`);
}
console.log(`\n재검증 기록을 남길 술 ${ops.length}종 · 내용을 고칠 술 ${diffs.length}종 · 고칠 곳 ${diffs.reduce((a, x) => a + x.corrections.length, 0)}개`);
if (!APPLY) { console.log("보기만 했습니다. 적으려면 --apply"); await client.close(); process.exit(0); }
mkdirSync("data/backup", { recursive: true });
if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있습니다 — 두 번 적지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, by: BY, docs: backup }, null, 1), "utf8");
const res = await col.bulkWrite(ops, { ordered: true });
console.log(`적었습니다 — ${res.modifiedCount}종 (백업 ${BACKUP})`);
await client.close();
process.exit(0);
