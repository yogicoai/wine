// 기능서·현황서를 HTML 한 장으로 만든다.
//
//   node scripts/_overview-html.mjs --journal <워크플로 journal.jsonl> [--out docs/기능서-현황.html]
//   node scripts/_overview-html.mjs                      (이전에 읽어 둔 data/research/_work/spec/spec.json 으로 다시 만들기)
//
// 입력
//   data/research/_work/spec/progress.json   scripts/_progress-stats.mjs 가 센 주종별 수치 (DB)
//   data/research/_work/spec/apps.json        lib/apps/*.js 프로필 (앱 6종)
//   워크플로 journal.jsonl                    정리파일·코드를 나눠 읽고 독립 검증한 기능·문서 주장 목록
// 출력: 외부 파일 없이 열리는 HTML 한 장 (글꼴만 구글 폰트를 걸고, 없으면 시스템 글꼴)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SPEC_DIR = "data/research/_work/spec";
const OUT = arg("--out", "docs/기능서-현황.html");
const JOURNAL = arg("--journal");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const prog = readJson(`${SPEC_DIR}/progress.json`);
const apps = readJson(`${SPEC_DIR}/apps.json`);

// ───────────────────────── 기능·주장 목록 불러오기 (워크플로 journal → spec) ─────────────────────────
const AREAS = [
  { key: "scan", title: "스캔·인식", prefix: "SC" },
  { key: "result", title: "결과 화면", prefix: "RS" },
  { key: "discover", title: "탐색·추천·취향", prefix: "DC" },
  { key: "mine", title: "내 술·알림·계정", prefix: "MY" },
  { key: "data", title: "카탈로그·가격·출처", prefix: "DT" },
  { key: "platform", title: "앱 6종·다국어·화면 뼈대", prefix: "PF" },
  { key: "ops", title: "운영 도구", prefix: "OP" },
];
const DOC_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6"];
const CLAIM_CAP = 60;
const chunk = (arr, k) => { const out = []; for (let i = 0; i < arr.length; i += k) out.push(arr.slice(i, i + k)); return out; };

function loadSpec(journalPath) {
  const L = readFileSync(journalPath, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const labelOf = new Map(), res = new Map();
  for (const o of L) { if (o.type === "started") labelOf.set(o.agentId, o.label); else if (o.type === "result") res.set(o.agentId, o.result); }
  const by = {};
  for (const [id, label] of labelOf) if (res.has(id)) by[label] = res.get(id);
  const docsOut = DOC_KEYS.map((k) => by["docs:" + k]).filter(Boolean);
  const allClaims = docsOut.flatMap((d) => d.claims || []);
  const verdictRows = (claims, v) => { const m = new Map((v?.claims || []).map((x) => [x.i, x])); return claims.map((c, i) => { const x = m.get(i); return { ...c, verdict: x ? x.verdict : "unchecked", now: x?.now || "", evidence: x?.evidence || [] }; }); };

  const areas = AREAS.map((a) => {
    const code = by["read:" + a.key], verify = by["verify:" + a.key];
    const claims = allClaims.filter((c) => c.area === a.key);
    const first = claims.slice(0, CLAIM_CAP), rest = chunk(claims.slice(CLAIM_CAP), CLAIM_CAP);
    const feats = code?.features || [];
    const vmap = new Map((verify?.features || []).map((v) => [v.i, v]));
    const features = [], refuted = [];
    feats.forEach((f, i) => {
      const v = vmap.get(i);
      if (!v) { features.push({ ...f, verdict: "unchecked" }); return; }
      if (v.verdict === "refuted") { refuted.push({ name: f.name, desc: f.desc, note: v.note || "" }); return; }
      const fix = v.verdict === "corrected";
      features.push({ ...f, desc: fix && v.desc ? v.desc : f.desc, status: fix && v.status ? v.status : f.status, evidence: v.evidence?.length ? v.evidence : f.evidence, verdict: v.verdict, note: v.note || "" });
    });
    for (const f of verify?.additions || []) features.push({ ...f, verdict: "added" });
    const cl = [...verdictRows(first, verify), ...rest.flatMap((part, k) => verdictRows(part, by[`claims:${a.key}:${k + 2}`]))];
    return { ...a, summary: code?.summary || "", notes: [...(code?.notes || []), ...(verify?.notes || [])], features, refuted, claims: cl, readOk: !!code, verifyOk: !!verify };
  });

  const only = {};
  for (const key of ["strategy", "release"]) {
    const claims = allClaims.filter((c) => c.area === key);
    only[key] = chunk(claims, CLAIM_CAP).flatMap((part, k) => verdictRows(part, by[`claims:${key}:${k + 1}`]));
  }
  const critic = by["critic"] || null;
  // 점검자가 찾은 누락 기능은 해당 영역 끝에 붙인다 (독립 검증은 거치지 않았다)
  if (critic) for (const f of critic.missing || []) { const a = areas.find((x) => x.key === f.area) || areas[areas.length - 1]; const { area, ...rest } = f; a.features.push({ ...rest, verdict: "critic" }); }
  const kinds = { docs: 0, read: 0, verify: 0, claims: 0, critic: 0 };
  for (const l of Object.keys(by)) { const k = l.split(":")[0]; if (k in kinds) kinds[k]++; }
  const spec = { loadedAt: new Date().toISOString(), areas, only, docs: docsOut.flatMap((d) => d.docs || []), decisions: docsOut.flatMap((d) => d.decisions || []), numbers: docsOut.flatMap((d) => d.numbers || []), critic, agents: Object.keys(by).length, agentKinds: kinds };
  mkdirSync(SPEC_DIR, { recursive: true });
  writeFileSync(`${SPEC_DIR}/spec.json`, JSON.stringify(spec, null, 1), "utf8");
  return spec;
}
const spec = JOURNAL ? loadSpec(JOURNAL) : readJson(`${SPEC_DIR}/spec.json`);

// ───────────────────────── 사전 ─────────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x) => Number(x || 0).toLocaleString("ko-KR");
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const APP_SHORT = { wine: "와인", sake: "사케", beer: "맥주", whisky: "위스키", tradition: "전통주", spirits: "증류주", 전체: "전체 앱" };
const CAT_KO = { wine: "와인", sake: "사케", beer: "맥주", whisky: "위스키", traditional: "전통주", makgeolli: "막걸리", soju: "소주", brandy: "브랜디", gin: "진", rum: "럼", tequila: "데킬라", baijiu: "백주", liqueur: "리큐르", vodka: "보드카", highball: "하이볼", spirits: "기타 증류주" };
const STATUS = { 구현: "impl", 부분: "part", 꺼짐: "off", 계획: "plan", 죽은코드: "dead" };
const FV = { confirmed: "검증 확인", corrected: "검증 교정", added: "검증 추가", unchecked: "미검증", critic: "점검자 추가" };
const CV = { current: "그대로", changed: "바뀜", stale: "낡음", unimplemented: "코드에 없음", nocode: "확인 불가", done: "끝남", pending: "남음", unchecked: "미검증" };
const CVC = { current: "impl", changed: "part", stale: "dead", unimplemented: "dead", nocode: "off", done: "impl", pending: "part", unchecked: "off" };
const KST = new Date(prog.at).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

const SECTION_LABEL = { confidence: "인식 신뢰도", community: "집단 평점", price: "가격 카드(예상 가격대·시세)", sakenowa: "일본 현지 평가(사케노와)", cellar: "와인장 담기", buy: "구매 안내", nearby: "근처에서 마실 곳", vintage: "빈티지 비교", taste: "플레이버 시그니처·시음 노트", specs: "제원", window: "음용 적기", history: "히스토리 연표", story: "스토리·생산자", pairing: "페어링", rating: "출처별 평점", serving: "서빙(온도·숙성)", glass: "잔 추천", gear: "도구 추천", prep: "준비 타이머", similar: "비슷한 술", trivia: "알고 마시면 더 맛있는 이야기", tips: "음용 팁", deep: "최신 정보 더 찾기(웹 검색)" };
// lib/features.js — 코드 기본값은 모두 꺼짐(환경변수 "1" 이어야 켜진다)
const FLAGS = [
  { env: "NEXT_PUBLIC_LIVE_PRICE", name: "실시간 시세", covers: "셀러 가치 · 목표가 · 6개월 가격 추이 · 특가 알림 구독 · 빈티지별 가격 비교. 결과 화면의 최저가·판매가(데일리샷으로 확인된 값)는 이 스위치와 무관하게 나온다.", why: "값을 가져올 창구가 없다 — 네이버 쇼핑 검색 API 가 2026-07 말 종료됐고, 국내법상 온라인 판매가 막힌 주종은 종합몰에 없다. 켜 두면 알림이 오지 않는데 \"알려 드린다\"고 적게 된다.", on: "스마트오더 플랫폼(데일리샷 등) 제휴 또는 Wine-Searcher 유료 API" },
  { env: "NEXT_PUBLIC_BARCODE_SCAN", name: "바코드 스캔", covers: "바코드 읽기 → 술 찾기", why: "읽는 것은 정상이나 \"바코드 → 술\" 대조표가 없다. 지금 카탈로그에 연결된 바코드는 1건뿐이라 켜면 찍을 때마다 \"등록되지 않은 바코드\"가 뜬다.", on: "상용 바코드 DB 연결, 또는 라벨 분석 때 번호를 모아 대조표가 쌓인 뒤" },
  { env: "NEXT_PUBLIC_MULTILINGUAL", name: "언어 바꾸기 (한국어·English·日本語)", covers: "화면 언어 전환", why: "한 화면에 두 언어가 섞이면 사용자가 고장으로 읽는다. 번역이 없는 항목은 한국어 원문이 그대로 나오게 되어 있다(localizeResult). 2026-10-02 결정으로 서술문 번역은 한국어로 둔다 — 지금 켜면 이름·나라·제원만 바뀌고 이야기는 한국어로 남는다.", on: "켜기 전에 사용자 결정 필요 (전통주 앱은 이 스위치와 무관하게 한국어·영어를 낸다)" },
  { env: "NEXT_PUBLIC_FONT_SCALE", name: "글자 크기 조절", covers: "글자 크게·작게", why: "치수가 px 로 짜여 있어 글자만 키우면 칸이 따라오지 않는다. zoom 은 fixed·vw/vh·safe-area 를 어긋나게 한다.", on: "globals.css 의 px 치수를 rem 으로 바꾼 뒤" },
];
// 코드 점검에서 나온 위험 — 독립 검증자의 메모 중 핵심을 추려 적고, "직접 확인"은 작성자가 코드·DB 에서 다시 확인한 것이다.
const RISKS = [
  { sev: "높음", t: "공개하면 누구나 호출할 수 있는 쓰기·삭제·유료 API", d: "app/api/catalog 의 import · merge(삭제 동반) · cleanup(삭제) · seed(유료 AI 호출) · images · sakenowa · rakuten 라우트와 /api/naver/ping 에는 인증 검사가 없고, middleware(proxy) 파일도 없다. harvest · backfill · 크론 3개 · 바코드 수동 연결만 CRON_SECRET 이 설정돼 있을 때 Bearer 를 검사한다(미설정이면 열려 있다).", ev: ["app/api/catalog/import/route.js:40", "app/api/catalog/merge/route.js:128", "app/api/catalog/seed/route.js:37", "app/api/cron/harvest/route.js:21"], by: "직접 확인" },
  { sev: "높음", t: "재적재 한 번에 검증 결과가 옛 값으로 되돌아간다", d: "POST /api/catalog/import 는 data/seed-*.json 항목으로 result 전체를 덮어쓴다(saveCatalog 의 $set). 뼈대(stub) 보호는 stub 항목에만 걸려 있다. 지금 seed 1,317건이 모두 DB 의 기존 문서와 키가 같고 그중 1,276건이 웹 조사로 검증된 문서라, 한 번 호출하면 정정이 사라지는데 verified 표시만 남는다. 위 인증 문제와 겹쳐 아무나 부를 수 있다. 조사 원본(data/research/_work/out/*.json 784개)이 남아 있어 다시 반영할 길은 있다.", ev: ["app/api/catalog/import/route.js:60-92", "lib/catalog.js:158-191"], by: "직접 확인 (코드 + DB 대조, 읽기만)" },
  { sev: "높음", t: "사용자 구분이 없다", d: "셀러·스캔 기록·취향 문답이 owner 'local' 한 벌(앱 단위 공용)로 저장돼, 공개하면 모든 방문자의 기록이 섞인다. 내 정보 서랍은 “지금 기록은 이 기기에만 저장됩니다”라고 적지만 사실이 아니다. 로그인·19세 인증·구독 표시는 껍데기다. sessions/[id] 의 조회·삭제는 id 만 알면 된다.", ev: ["app/api/preferences/route.js:18", "app/api/recommend/route.js:49", "components/AccountDrawer.js:127"], by: "검증자 확인 (owner 기본값은 직접 확인)" },
  { sev: "높음", t: "사진 업로드 API 가 열려 있다", d: "app/api/upload 는 인증·크기·형식 검사 없이 받은 이미지를 Cafe24 호스팅에 FTP 로 올린다(FTP 설정이 있을 때). 외부에서 호스팅에 파일을 올릴 수 있다.", ev: ["app/api/upload/route.js:9-21"], by: "직접 확인" },
  { sev: "중간", t: "GET 이 DB 에 쓴다", d: "さけのわ·라쿠텐 일괄 작업은 dryRun=1 이 없으면 GET 도 적용(쓰기)한다. /api/analyze 의 barcode 필드는 인증 없이 linkBarcode 를 불러 임의 유효 EAN 을 술에 붙일 수 있다.", ev: ["app/api/catalog/sakenowa/route.js:60", "app/api/catalog/rakuten/route.js:60", "app/api/analyze/route.js"], by: "검증자 확인" },
  { sev: "중간", t: "내 정보 서랍에 코드 글자가 보인다", d: "언어 안내문이 중괄호 없이 적혀 화면에 “MULTILINGUAL ? t(…) : t(…)” 글자가 그대로 나온다. 언어 칸은 스위치와 상관없이 늘 보인다.", ev: ["components/AccountDrawer.js:114-118"], by: "직접 확인" },
  { sev: "중간", t: "/guide 가 꺼 둔 기능을 약속한다", d: "“시세가 내려가면 특가 알림을 드립니다”(셀러 안내) — 실시간 시세 스위치가 꺼져 있어 알림 UI 가 없다. lib/features.js 가 경고한 “켜져 있는 것이 없는 것보다 나쁘다” 상태다.", ev: ["app/guide/page.js:121", "lib/features.js:57-86"], by: "직접 확인" },
  { sev: "중간", t: "분석 프롬프트의 주종 목록이 둘로 갈린다", d: "시스템 프롬프트는 16종을 말하는데 JSON 스키마 예시에는 12종만 있어 막걸리·보드카·리큐르·하이볼이 빠져 있다. 새로 찍은 술의 주종 판별에 영향을 줄 수 있다.", ev: ["lib/prompts.js:28", "lib/prompts.js:60"], by: "직접 확인" },
  { sev: "낮음", t: "수확 크론이 매일 돌지만 하는 일이 없다", d: "재료인 네이버 쇼핑 검색이 종료돼 삽입이 0건이다. /api/shop 입구는 네이버 또는 11번가 키가 있어야 열려, 둘 다 없으면 데일리샷 경로에도 닿지 못한다(지금은 네이버 이미지 검색 키가 있어 영향 없음).", ev: ["vercel.json:11", "app/api/shop/route.js:31"], by: "검증자 확인" },
  { sev: "낮음", t: "화면 문구·안내 몇 곳이 사실과 다르다", d: "취향 문답의 “여덟 문항·와인” 고정 문구(맥주·위스키·스피리츠는 6문항), /plan 의 정적 완료 표시(바코드 ‘완료’인데 꺼짐), 서비스 워커 알림 문구가 와인 앱 고정. /plan 은 URL 만 알면 열리는 내부 보고 페이지라 배포 전 삭제 대상이다.", ev: ["components/TasteQuiz.js", "app/plan/page.js", "public/sw.js"], by: "검증자 확인" },
];
const CRONS = [
  { path: "/api/cron/dailyshot", utc: "00:30", kst: "09:30", st: "작동", cls: "impl", what: "셀러·위시에 담긴 술(최대 400건)의 데일리샷 최저가를 새로 받아 색인과 가격 이력(최근 60점)을 갱신한다." },
  { path: "/api/cron/deals", utc: "01:00", kst: "10:00", st: "일부", cls: "part", what: "셀러·위시(최대 300건) 최저가를 확인해 이력을 쌓고 특가를 푸시로 알린다. 구독 화면이 실시간 시세 스위치 뒤에 있어 받는 사람이 거의 없다." },
  { path: "/api/cron/harvest", utc: "02:00", kst: "11:00", st: "꺼짐", cls: "off", what: "새 술을 수집해 뼈대로 넣는다. 재료인 네이버 쇼핑 검색이 종료돼 삽입이 0건이다." },
];

// ───────────────────────── 조각 ─────────────────────────
const T = prog.totals;
const infoFilled = T.verified + T.structured;
const featAll = spec.areas.flatMap((a) => a.features);
const statusCount = (arr) => { const c = { 구현: 0, 부분: 0, 꺼짐: 0, 계획: 0, 죽은코드: 0 }; for (const f of arr) c[f.status] = (c[f.status] || 0) + 1; return c; };
const SC = statusCount(featAll);

function pill(label, cls) { return `<span class="pill s-${cls}">${esc(label)}</span>`; }

function summaryTiles() {
  const tiles = [
    { big: `${pc(infoFilled, T.total)}%`, label: "정보가 채워진 술", sub: `${n(T.total)}종 중 ${n(infoFilled)}종 · 웹 조사 ${n(T.verified)} + 판매처 구조화 ${n(T.structured)}` },
    { big: `${pc(T.photoHosted, T.total)}%`, label: "우리 호스팅 사진", sub: `${n(T.photoHosted)}장 · 사진 없음 ${n(T.photoNone)}종` },
    { big: n(featAll.length), label: "앱 기능", sub: `구현 ${SC.구현} · 부분 ${SC.부분} · 꺼짐 ${SC.꺼짐} · 계획 ${SC.계획}${SC.죽은코드 ? ` · 죽은 코드 ${SC.죽은코드}` : ""}` },
    { big: "6", label: "앱 (소스 하나)", sub: "와인 · 사케 · 맥주 · 위스키 · 전통주 · 증류주" },
  ];
  return `<div class="tiles">${tiles.map((t) => `<div class="tile"><b>${esc(t.big)}</b><span>${esc(t.label)}</span><small>${esc(t.sub)}</small></div>`).join("")}</div>`;
}

function barInfo(c) {
  const t = c.total || 1, ab = c.A + c.B;
  const seg = (v, cls, label) => (v ? `<i class="${cls}" style="width:${(v / t) * 100}%" title="${esc(label)} ${n(v)}종"></i>` : "");
  return `<div class="bar" role="img" aria-label="확정 ${n(ab)} 부분 ${n(c.C)} 구조화 ${n(c.structured)} 이름만 ${n(c.nameOnly)} (전체 ${n(c.total)})">${seg(ab, "seg-a", "웹 조사 확정(A·B)")}${seg(c.C, "seg-c", "웹 조사 부분(C)")}${seg(c.structured, "seg-s", "판매처 구조화")}${seg(c.nameOnly, "seg-n", "이름 색인만")}</div>`;
}
function barPhoto(c) {
  const t = c.total || 1;
  const seg = (v, cls, label) => (v ? `<i class="${cls}" style="width:${(v / t) * 100}%" title="${esc(label)} ${n(v)}종"></i>` : "");
  return `<div class="bar" role="img" aria-label="우리 호스팅 ${n(c.photoHosted)} 외부 주소 ${n(c.photoExternal)} 없음 ${n(c.photoNone)}">${seg(c.photoHosted, "ph-h", "우리 호스팅")}${seg(c.photoExternal, "ph-e", "외부 주소")}${seg(c.photoNone, "ph-n", "사진 없음")}</div>`;
}
function progressRow(c, isTotal = false) {
  const appName = isTotal ? "" : (apps.find((a) => a.key === c.app)?.name || c.app);
  return `<tr${isTotal ? ' class="total"' : ""}>
    <th scope="row"><b>${esc(c.name)}</b>${appName ? `<small>${esc(appName)}</small>` : ""}</th>
    <td class="num">${n(c.total)}</td>
    <td class="barcell">${barInfo(c)}<span class="pct">${pc(c.verified + c.structured, c.total)}%</span></td>
    <td class="num">${n(c.A + c.B)}</td><td class="num">${n(c.C)}</td><td class="num">${n(c.structured)}</td><td class="num">${n(c.nameOnly)}</td>
    <td class="barcell">${barPhoto(c)}<span class="pct">${pc(c.photoHosted, c.total)}%</span></td>
    <td class="num">${n(c.photoNone)}</td>
    <td class="num">${n(c.full)}</td>
  </tr>`;
}
function progressTable() {
  return `<div class="legend" aria-hidden="true">
    <span><i class="seg-a"></i>웹 조사 확정(A·B)</span><span><i class="seg-c"></i>웹 조사 부분(C)</span><span><i class="seg-s"></i>판매처 구조화</span><span><i class="seg-n"></i>이름 색인만</span>
    <span class="sep"></span><span><i class="ph-h"></i>사진 우리 호스팅</span><span><i class="ph-e"></i>외부 주소</span><span><i class="ph-n"></i>사진 없음</span></div>
  <div class="scroll"><table class="ptable"><thead><tr>
    <th scope="col">주종</th><th scope="col" class="num">전체</th><th scope="col">정보 채움</th><th scope="col" class="num">확정</th><th scope="col" class="num">부분</th><th scope="col" class="num">구조화</th><th scope="col" class="num">이름만</th><th scope="col">공개 사진</th><th scope="col" class="num">사진 없음</th><th scope="col" class="num">이야기(full)</th></tr></thead>
  <tbody>${prog.categories.map((c) => progressRow(c)).join("")}${progressRow({ ...T, name: "합계" }, true)}</tbody></table></div>
  <p class="foot">기준: 앱이 보여 주는 항목(notDrink·중복 제외) ${n(T.total)}종. 정보 채움 = 웹 조사 검증 + 판매처 구조화. 확정 = 권위 있는 출처 둘 이상(A) 또는 한 출처·일반 지식과 일치(B), 부분(C) = 확인하지 못한 부분은 서술을 줄이거나 뺀 것. 합계는 문서 단위 계산과 DB 집계를 따로 세어 맞춰 봤다${prog.mismatch?.length ? " — 불일치: " + esc(prog.mismatch.join(", ")) : " (일치)"}. 측정 ${esc(KST)} KST.</p>`;
}
function appTotalsTable() {
  return `<div class="scroll"><table class="ptable small"><thead><tr><th scope="col">앱</th><th scope="col" class="num">술</th><th scope="col">정보 채움</th><th scope="col">공개 사진</th><th scope="col">다루는 주종</th></tr></thead><tbody>${prog.apps.map((a) => {
    const prof = apps.find((x) => x.key === a.key);
    return `<tr><th scope="row"><b>${esc(prof?.name || a.name)}</b></th><td class="num">${n(a.total)}</td><td class="barcell">${barInfo(a)}<span class="pct">${pc(a.verified + a.structured, a.total)}%</span></td><td class="barcell">${barPhoto(a)}<span class="pct">${pc(a.photoHosted, a.total)}%</span></td><td style="min-width:17rem">${esc((prof?.categories || []).map((c) => CAT_KO[c] || c).join(" · "))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function pipelineCards() {
  const m = prog.manifest, r = prog.research;
  const cards = [
    { t: "웹 조사 · 검증", s: `${n(T.verified)} / ${n(T.total)} (${pc(T.verified, T.total)}%)`, d: `확정 ${n(T.A + T.B)} · 부분 ${n(T.C)}. 조사한 항목의 66%(1,890종)에서 기존 정보를 하나 이상 고쳤고(고친 값 4,895건), 출처로 확인되지 않아 뺀 주장이 5,996건이다. 근거·정정 내역은 문서마다 catalog.verified 에 있다.`, k: "impl" },
    { t: "와인 판매처 구조화", s: `${n(T.structured)}종`, d: "웹 조사가 못 닿은 와인 중 판매처(데일리샷) 짝이 이름까지 꽉 맞는 것의 지역·품종·시음 노트·페어링·Vivino 평점을 모델 없이 옮겼다. 판매처 서술문은 베끼지 않고 사실만.", k: "impl" },
    { t: "이름 색인 (출처 없음)", s: `${n(T.nameOnly)}종`, d: `대부분 와인(${n(prog.categories.find((c) => c.key === "wine")?.nameOnly)}종) — 판매처가 취급하지 않아 채울 출처가 없다. 삭제하지 않고 추정 맛 수치 ${n(T.stripped)}종분만 걷어 이름·주종·가격대·사진만 남겼다(되돌릴 수 있음).`, k: "part" },
    { t: "사진", s: `${n(T.photoHosted)}장 공개 (${pc(T.photoHosted, T.total)}%)`, d: `눈으로 이름의 그 상품인지 확인한 것만 Cafe24(/app/img/wine/catalog/)에 올렸다. 거절 ${n(m.status.rejected || 0)} · 없음 ${n(m.status.missing || 0)} · 받기 실패 ${n(m.status.failed || 0)}. 거절·죽은 주소 ${n(T.imageRejected)}종의 옛 주소는 걷었다(imageRejected 로 되돌릴 수 있음). 사진은 제3자 저작물이라 출처(imageSource·imageOrigin)를 남겼다.`, k: "part" },
    { t: "영어 · 일본어", s: "이름·정형 필드만", d: `용어집으로 이름·나라·제원 등 정형 필드를 채웠다(${(prog.engines || []).map((e) => `${e._id || "표시 없음"} ${n(e.n)}`).join(", ")}). 서술문(고유 문장 약 6.2만 개)은 한국어로 둔다 — 2026-10-02 사용자 결정(로컬 기계번역은 번역의 약 2/3가 의미가 바뀌어 쓰지 않았다).`, k: "off" },
    { t: "가격", s: `가격대 ${n(T.priceBand)}종`, d: "가격은 \"N만원대\"로만 보여 준다. 실제 판매가가 아닌 추정치는 화면에 \"예상 가격대\"와 안내 문구로 밝힌다(미커밋). 실시간 시세 기능군은 스위치로 꺼져 있다.", k: "part" },
    { t: "조사 비용", s: `API 환산 $${n(r.costTotal)}`, d: `조사 $${n(r.costResearch)} · 사진 찾기 $${n(r.costFind)} · 사진 확인 $${n(r.costImageCheck)}. 묶음 ${n(r.batchesOk)}개 완료(실패 ${r.batchesFailed}). 주간 사용량 15% → 약 ${Math.round((prog.usage?.sevenDay ?? 0.6) * 100)}% (10-02 아침 측정).`, k: "off" },
  ];
  return `<div class="cards">${cards.map((c) => `<section class="pcard"><div class="pc-h"><h3>${esc(c.t)}</h3>${pill(c.k === "impl" ? "진행됨" : c.k === "part" ? "일부" : "참고", c.k)}</div><p class="pc-s">${esc(c.s)}</p><p>${esc(c.d)}</p></section>`).join("")}</div>`;
}

function decisions() {
  const items = [
    { t: "검증 결과 보호", d: "POST /api/catalog/import 한 번이면 검증된 1,276종의 result 가 옛 seed 값으로 되돌아간다(인증도 없다). 검증된 문서는 건너뛰도록 막는 가드와 관리용 API 인증을 넣을지 결정이 필요하다." },
    { t: "이야기가 남은 와인 4종", d: "본템피 몬테풀치아노 다브루초 · 운두라가 시부미 카르메네르 · 로버트 바일 주니어 리슬링 트로켄 · 월류봉 하우스 디저트 와인. 조사에서 정체를 밝히지 못했는데 이야기가 남아 있다. 이야기를 걷는 쪽을 권한다(백업을 남기므로 되돌릴 수 있다)." },
    { t: "언어 바꾸기 스위치", d: "서술문이 한국어로 남아 있어 NEXT_PUBLIC_MULTILINGUAL 을 켜면 한 화면에 두 언어가 섞인다. 코드 주석은 바로 이 상태를 켜지 않는 이유로 적고 있다. 켤지 말지 결정이 필요하다." },
    { t: "커밋", d: `마지막 커밋은 ${esc(prog.git.lastCommit)}. 가격 안내 문구(화면 3개 파일)·스크립트·.gitignore 등 ${n(prog.git.uncommitted)}건이 커밋되지 않았다.` },
  ];
  return `<ul class="decide">${items.map((i) => `<li><b>${esc(i.t)}</b><span>${i.t === "커밋" ? i.d : esc(i.d)}</span></li>`).join("")}</ul>`;
}

function featHtml(area, f, i) {
  const id = `${area.prefix}-${String(i + 1).padStart(2, "0")}`;
  const appsL = (f.apps?.length ? f.apps : ["전체"]).map((a) => APP_SHORT[a] || a);
  const ev = (f.evidence || []).filter(Boolean);
  const hay = [f.name, f.desc, f.statusNote, f.note, (f.external || []).join(" "), appsL.join(" "), ev.join(" ")].join(" ").toLowerCase();
  const cls = STATUS[f.status] || "off";
  const evHtml = ev.length ? `<div class="ev"><code>${esc(ev[0])}</code>${ev.length > 1 ? `<details><summary>근거 ${ev.length - 1}개 더</summary>${ev.slice(1).map((e) => `<code>${esc(e)}</code>`).join("")}</details>` : ""}</div>` : "";
  const ext = f.external?.length ? `<div class="ext">연동: ${f.external.map((e) => `<span>${esc(e)}</span>`).join("")}</div>` : "";
  const note = [f.statusNote, f.verdict === "corrected" || f.verdict === "refuted" ? f.note : ""].filter(Boolean).join(" · ");
  return `<article class="feat" id="${id}" data-area="${area.key}" data-status="${esc(f.status)}" data-apps="${esc(appsL.join("|"))}" data-hay="${esc(hay)}">
    <div class="f-id">${id}</div>
    <div class="f-main"><h4>${esc(f.name)}</h4><p>${esc(f.desc)}</p>${note ? `<p class="f-note">${esc(note)}</p>` : ""}${ext}${evHtml}</div>
    <div class="f-side">${pill(f.status, cls)}<span class="vd v-${esc(f.verdict)}">${esc(FV[f.verdict] || "")}</span><div class="apps">${appsL.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div></div>
  </article>`;
}
function areaHtml(a) {
  const c = statusCount(a.features);
  return `<section class="area" id="a-${a.key}" data-area="${a.key}">
    <div class="area-h"><h3>${esc(a.title)} <span class="cnt">${a.features.length}</span></h3><div class="mini">${Object.entries(c).filter(([, v]) => v).map(([k, v]) => `<span class="pill s-${STATUS[k]}">${esc(k)} ${v}</span>`).join("")}</div></div>
    ${a.summary ? `<p class="area-sum">${esc(a.summary)}</p>` : ""}
    <div class="flist">${a.features.map((f, i) => featHtml(a, f, i)).join("") || '<p class="empty">이 영역은 읽기에 실패해 목록이 없다.</p>'}</div>
    ${a.notes?.length ? `<details class="notes"><summary>한계·위험·메모 ${a.notes.length}건</summary><ul>${a.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
  </section>`;
}
function filterBar() {
  const chips = [["all", "전체", featAll.length], ...Object.keys(STATUS).filter((k) => SC[k]).map((k) => [k, k, SC[k]])];
  return `<div class="filters"><label class="sr" for="q">기능 검색</label><input id="q" type="search" placeholder="기능 · 파일 · 서비스 이름으로 찾기" autocomplete="off">
    <div class="chipbar" role="group" aria-label="상태로 거르기">${chips.map(([k, l, v], i) => `<button type="button" class="fchip${i === 0 ? " on" : ""}" data-st="${esc(k)}" aria-pressed="${i === 0}">${esc(l)} <b>${v}</b></button>`).join("")}</div>
    <p id="fcount" class="foot" aria-live="polite">기능 ${featAll.length}개 모두 보는 중</p></div>`;
}

function appMatrix() {
  const prof = Object.fromEntries(apps.map((a) => [a.key, a]));
  const order = ["wine", "sake", "beer", "tradition", "whisky", "spirits"].filter((k) => prof[k]);
  const head = order.map((k) => `<th scope="col">${esc(prof[k].name)}</th>`).join("");
  const row = (label, fn) => `<tr><th scope="row">${esc(label)}</th>${order.map((k) => `<td>${fn(prof[k], k)}</td>`).join("")}</tr>`;
  const sw = (hex) => `<span class="sw" style="background:${esc(hex)}" title="${esc(hex)}"></span>`;
  const appStat = (k) => prog.apps.find((a) => a.key === k) || {};
  const sections = [...new Set(order.flatMap((k) => prof[k].layout.result || []))];
  return `<div class="scroll"><table class="ptable matrix"><thead><tr><th scope="col"></th>${head}</tr></thead><tbody>
    ${row("한 줄 소개", (p) => esc(p.tagline))}
    ${row("다루는 주종", (p) => esc(p.categories.map((c) => CAT_KO[c] || c).join(" · ")))}
    ${row("화면 언어", (p) => esc((p.locales || [p.locale]).map((l) => ({ ko: "한국어", en: "English", ja: "日本語" }[l] || l)).join(" · ")))}
    ${row("색 · 서체", (p) => `${sw(p.theme.accent)}${sw(p.theme.bg)} <small>${esc(p.theme.fontSet)}${p.theme.pattern ? " · " + esc(p.theme.pattern) : ""}</small>`)}
    ${row("앱 전용 문구", (p) => (p.copyKeys ? `${p.copyKeys}개` : "기준 문구 그대로"))}
    ${row("술 수 · 정보 채움", (p, k) => `${n(appStat(k).total)}종 · ${pc((appStat(k).verified || 0) + (appStat(k).structured || 0), appStat(k).total)}%`)}
    ${row("결과 화면 조각", (p) => `${(p.layout.result || []).length}개`)}
  </tbody></table></div>
  <h4 class="sub">결과 화면 구성 — 앱마다 무엇을 어떤 순서로 보여 주나</h4>
  <p class="foot">숫자는 그 앱의 결과 화면에서 위에서부터 몇 번째 조각인지다. 빈칸은 그 앱에서 뜻이 없어 뺀 조각이다(예: 사케에는 빈티지별 가격을 넣지 않는다). 순서는 lib/apps/*.js 의 layout.result, 조각 정의는 components/ResultScreen.js.</p>
  <div class="scroll"><table class="ptable matrix small"><thead><tr><th scope="col">조각</th>${head}</tr></thead><tbody>${sections.map((s) => `<tr><th scope="row">${esc(SECTION_LABEL[s] || s)}</th>${order.map((k) => { const i = (prof[k].layout.result || []).indexOf(s); return `<td class="num">${i >= 0 ? i + 1 : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function flagsHtml() {
  return `<div class="flags">${FLAGS.map((f) => `<section class="flag"><div class="pc-h"><h4>${esc(f.name)}</h4>${pill("꺼짐", "off")}</div><p class="flag-env"><code>${esc(f.env)}</code> = 1 일 때 켜짐 (코드 기본값: 꺼짐)</p><p><b>포함:</b> ${esc(f.covers)}</p><p><b>왜 껐나:</b> ${esc(f.why)}</p><p><b>켜는 조건:</b> ${esc(f.on)}</p></section>`).join("")}</div>
  <p class="foot">이 PC 의 .env.local 에는 위 네 스위치가 설정돼 있지 않다(기본값 적용). 실제 배포 환경(Vercel 등)의 값은 확인하지 못했다.</p>`;
}
function cronHtml() {
  return `<div class="scroll"><table class="ptable small"><thead><tr><th scope="col">경로</th><th scope="col">실행(UTC · KST)</th><th scope="col">상태</th><th scope="col">하는 일</th></tr></thead><tbody>${CRONS.map((c) => `<tr><td><code>${esc(c.path)}</code></td><td>${c.utc} · ${c.kst}</td><td>${pill(c.st, c.cls)}</td><td>${esc(c.what)}</td></tr>`).join("")}</tbody></table></div><p class="foot">vercel.json 의 crons 정의. 역할·상태는 각 라우트 코드를 읽어 적었다. 앱 여섯이 같은 DB 를 쓰므로 배포마다 같은 크론이 따로 돈다.</p>`;
}

function risksHtml() {
  const sevCls = { 높음: "dead", 중간: "part", 낮음: "off" };
  return `<div class="claims">${RISKS.map((r) => `<article class="claim risk"><div class="c-v">${pill(r.sev, sevCls[r.sev])}<small>${esc(r.by)}</small></div><div class="c-m"><b>${esc(r.t)}</b><p>${esc(r.d)}</p></div><div class="c-n">${r.ev.map((e) => `<code>${esc(e)}</code>`).join("")}</div></article>`).join("")}</div>`;
}

function claimRows(list, { skipCurrent = false } = {}) {
  const rows = list.filter((c) => !(skipCurrent && (c.verdict === "current" || c.verdict === "nocode" || c.verdict === "unchecked")));
  if (!rows.length) return '<p class="empty">해당 없음</p>';
  return `<div class="claims">${rows.map((c) => `<article class="claim"><div class="c-v">${pill(CV[c.verdict] || c.verdict, CVC[c.verdict] || "off")}<small>${esc(c.areaTitle || "")}</small></div><div class="c-m"><b>${esc(c.topic)}</b><p>${esc(c.claim)}</p><small class="src">${esc(c.file)}${c.docStatus ? " · 문서상 " + esc(c.docStatus) : ""}</small></div><div class="c-n">${c.now ? `<p>${esc(c.now)}</p>` : ""}${(c.evidence || []).slice(0, 2).map((e) => `<code>${esc(e)}</code>`).join("")}</div></article>`).join("")}</div>`;
}
function allClaimsFlat() {
  const t = Object.fromEntries(AREAS.map((a) => [a.key, a.title]));
  t.strategy = "전략·결정"; t.release = "배포·남은 작업";
  return [...spec.areas.flatMap((a) => a.claims.map((c) => ({ ...c, areaTitle: a.title }))), ...Object.entries(spec.only).flatMap(([k, v]) => v.map((c) => ({ ...c, areaTitle: t[k] })))];
}
function verdictCounts(list) { const c = {}; for (const x of list) c[x.verdict] = (c[x.verdict] || 0) + 1; return c; }

function docsHtml() {
  const flat = allClaimsFlat();
  const base = (s) => String(s || "").split("/").pop();
  return `<div class="scroll"><table class="ptable small docs"><thead><tr><th scope="col">파일</th><th scope="col">날짜</th><th scope="col">종류</th><th scope="col">요지</th><th scope="col" class="num">뽑은 주장</th></tr></thead><tbody>${(spec.docs || []).map((d) => `<tr><th scope="row"><code>${esc(d.file)}</code></th><td>${esc(d.date || "")}</td><td>${esc(d.kind || "")}</td><td>${esc(d.gist)}</td><td class="num">${flat.filter((c) => base(c.file) === base(d.file)).length || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

// ───────────────────────── 문서 ─────────────────────────
const LIGHT = { bg: "#f0f5f2", surface: "#ffffff", surface2: "#e6eee9", ink: "#13211a", ink2: "#46584e", ink3: "#6f8077", line: "#cfdbd4", line2: "#e1eae5", accent: "#1a6a4f", accentInk: "#ffffff", accentSoft: "#d9eae1", ok: "#1b7a4c", okBg: "#d9eee3", warn: "#8f5505", warnBg: "#f5e6cb", off: "#475a69", offBg: "#e0e7ed", plan: "#4a4fa3", planBg: "#e3e4f5", dead: "#9a2e29", deadBg: "#f3dcda", segA: "#1a6a4f", segC: "#79b69b", segS: "#3a77a7", segN: "#c4cfc8", phH: "#1a6a4f", phE: "#c58a2b", phN: "#c4cfc8", code: "#e8efeb" };
const DARK = { bg: "#0d1612", surface: "#141f1a", surface2: "#1b2923", ink: "#e3ede7", ink2: "#a2b3aa", ink3: "#7c8e85", line: "#2a3b33", line2: "#22322b", accent: "#5bc59b", accentInk: "#06130d", accentSoft: "#1d3a2f", ok: "#70d4a1", okBg: "#1a3a2b", warn: "#e6b25a", warnBg: "#3a2c12", off: "#9fb5c7", offBg: "#23323d", plan: "#abaef1", planBg: "#2a2c55", dead: "#f19c96", deadBg: "#402423", segA: "#4fb88f", segC: "#2f6b55", segS: "#5b9ccc", segN: "#34453d", phH: "#4fb88f", phE: "#d9a24a", phN: "#34453d", code: "#1a2822" };
const tokens = (o) => Object.entries(o).map(([k, v]) => `--${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`).join(";");

const CSS = `
:root{${tokens(LIGHT)};--font:"IBM Plex Sans KR","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,"Cascadia Mono",Consolas,monospace;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${tokens(DARK)};color-scheme:dark}}
:root[data-theme="dark"]{${tokens(DARK)};color-scheme:dark}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 var(--font);word-break:keep-all;overflow-wrap:break-word;-webkit-text-size-adjust:100%}
a{color:var(--accent)}
code{font:12.5px/1.5 var(--mono);background:var(--code);padding:1px 6px;border-radius:3px;word-break:break-all;color:var(--ink)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:1120px;margin:0 auto;padding-inline:16px}
.nav{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;gap:16px;align-items:center;min-height:48px}
.nav .brand{font-weight:700;white-space:nowrap}
.nav ul{display:flex;gap:2px;list-style:none;margin:0;padding:0;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none}
.nav ul::-webkit-scrollbar{display:none}
.nav li a{display:block;padding:6px 10px;border-radius:4px;color:var(--ink2);text-decoration:none;font-size:13.5px;white-space:nowrap}
.nav li a:hover,.nav li a.on{background:var(--surface2);color:var(--ink)}
.theme{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:4px;padding:5px 10px;cursor:pointer;white-space:nowrap}
.theme:focus-visible,.fchip:focus-visible,#q:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
header.top{padding-block:40px 8px}
header.top h1{font-size:clamp(26px,4.2vw,38px);line-height:1.2;margin:0 0 10px;letter-spacing:-.01em;text-wrap:balance}
header.top .lead{max-width:62ch;color:var(--ink2);margin:0 0 6px;font-size:16px}
header.top .meta{font-size:13px;color:var(--ink3);margin:0}
section.blk{padding-block:34px 6px}
h2{font-size:22px;line-height:1.3;margin:0 0 6px;letter-spacing:-.005em;text-wrap:balance}
h2+.sub-lead{margin:0 0 18px;color:var(--ink2);max-width:70ch}
h3{font-size:17px;margin:0;line-height:1.35}
h4{font-size:15px;margin:0;line-height:1.4}
h4.sub{margin:26px 0 4px}
.foot{font-size:12.5px;color:var(--ink3);margin:10px 0 0;max-width:90ch}
.empty{color:var(--ink3);font-size:13.5px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:22px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tile b{font-size:34px;line-height:1.1;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.tile span{font-weight:600}
.tile small{color:var(--ink3);font-size:12.5px;line-height:1.5}
.decide{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px}
.decide li{display:grid;grid-template-columns:11rem minmax(0,1fr);gap:4px 16px;padding:10px 14px;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.decide li b{color:var(--warn)}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--surface)}
.ptable{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
.ptable th,.ptable td{padding:8px 12px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--line2)}
.ptable thead th{font-size:12px;color:var(--ink3);font-weight:600;letter-spacing:.02em;background:var(--surface2);white-space:nowrap;position:sticky;top:0}
.ptable tbody tr:last-child th,.ptable tbody tr:last-child td{border-bottom:0}
.ptable th[scope=row]{font-weight:500;position:sticky;left:0;background:var(--surface);z-index:1;min-width:6.5rem}
.ptable th[scope=row] b{display:block;font-weight:600}
.ptable th[scope=row] small{display:block;color:var(--ink3);font-size:11.5px;font-weight:400}
.ptable .num{text-align:right;white-space:nowrap}
.ptable tr.total th,.ptable tr.total td{background:var(--surface2);font-weight:700;border-top:2px solid var(--line)}
.ptable.small{font-size:13px}
.docs th[scope=row]{min-width:14rem;max-width:18rem;vertical-align:top}
.docs td{vertical-align:top}
.docs code{word-break:normal;overflow-wrap:anywhere}
.ptable.matrix td{min-width:9rem;font-size:13px}
.ptable.matrix td.num{min-width:4.5rem;text-align:center}
.barcell{min-width:210px;white-space:nowrap}
.barcell .bar{display:inline-flex;width:150px;height:12px;background:var(--seg-n);border-radius:2px;overflow:hidden;vertical-align:middle}
.barcell .bar:has(.ph-h),.barcell .bar:has(.ph-e),.barcell .bar:has(.ph-n){background:var(--ph-n)}
.bar i{display:block;height:100%}
.seg-a{background:var(--seg-a)}.seg-c{background:var(--seg-c)}.seg-s{background:var(--seg-s)}.seg-n{background:var(--seg-n)}
.ph-h{background:var(--ph-h)}.ph-e{background:var(--ph-e)}.ph-n{background:var(--ph-n)}
.pct{display:inline-block;width:3.2em;text-align:right;font-weight:600;margin-left:6px}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--ink2);margin:0 0 10px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{display:inline-block;width:12px;height:12px;border-radius:2px}
.legend .sep{width:1px;background:var(--line);height:14px}
.sw{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid var(--line);vertical-align:-2px;margin-right:4px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:6px}
.pcard,.flag{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:14px 16px;min-width:0}
.pcard p,.flag p{margin:6px 0 0;font-size:13.5px;color:var(--ink2)}
.pcard .pc-s{font-size:19px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.pc-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.flags{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px}
.flag-env code{font-size:12px}
.pill{display:inline-block;font-size:12px;font-weight:600;line-height:1;padding:4px 9px;border-radius:99px;white-space:nowrap}
.s-impl{background:var(--ok-bg);color:var(--ok)}.s-part{background:var(--warn-bg);color:var(--warn)}.s-off{background:var(--off-bg);color:var(--off)}.s-plan{background:var(--plan-bg);color:var(--plan)}.s-dead{background:var(--dead-bg);color:var(--dead)}
.filters{position:sticky;top:49px;z-index:10;background:var(--bg);padding:10px 0 8px;border-bottom:1px solid var(--line);margin-bottom:6px}
#q{width:100%;max-width:520px;font:inherit;font-size:14px;padding:9px 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--ink)}
.chipbar{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.fchip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink2);padding:5px 12px;border-radius:99px;cursor:pointer}
.fchip b{font-variant-numeric:tabular-nums;margin-left:3px}
.fchip.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.area{padding-top:26px}
.area-h{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:6px}
.cnt{font-size:13px;font-weight:600;color:var(--ink3);margin-left:6px;font-variant-numeric:tabular-nums}
.mini{display:flex;flex-wrap:wrap;gap:6px}
.area-sum{color:var(--ink2);max-width:80ch;margin:10px 0 4px;font-size:14px}
.feat{display:grid;grid-template-columns:3.6rem minmax(0,1fr) 11.5rem;gap:4px 18px;padding:13px 0;border-bottom:1px solid var(--line2)}
.feat[hidden]{display:none}
.f-id{font:12px/1.8 var(--mono);color:var(--ink3)}
.f-main p{margin:3px 0 0;font-size:14px;color:var(--ink2)}
.f-main p.f-note{color:var(--warn);font-size:13px}
.ev,.ext{margin-top:6px;font-size:12.5px;color:var(--ink3);display:flex;flex-wrap:wrap;gap:4px 6px;align-items:baseline}
.ev details{display:contents}
.ev summary{cursor:pointer;color:var(--accent);font-size:12.5px}
.ext span{background:var(--surface2);padding:1px 7px;border-radius:3px;color:var(--ink2)}
.f-side{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.vd{font-size:11.5px;color:var(--ink3)}
.v-corrected,.v-added,.v-critic{color:var(--warn)}
.apps{display:flex;flex-wrap:wrap;gap:4px}
.chip{font-size:11.5px;border:1px solid var(--line);border-radius:3px;padding:1px 6px;color:var(--ink2);background:var(--surface)}
.notes{margin-top:10px;font-size:13px;color:var(--ink2)}
.notes summary{cursor:pointer;color:var(--accent)}
.notes ul{margin:6px 0 0;padding-left:1.2rem}
.claims{display:grid;gap:0;border:1px solid var(--line);border-radius:6px;background:var(--surface);overflow:hidden}
.claim{display:grid;grid-template-columns:8.5rem minmax(0,1.1fr) minmax(0,1fr);gap:6px 18px;padding:12px 14px;border-bottom:1px solid var(--line2)}
.claim:last-child{border-bottom:0}
.c-v{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.c-v small,.src{color:var(--ink3);font-size:12px}
.c-m p,.c-n p{margin:3px 0 0;font-size:13.5px;color:var(--ink2)}
.c-n code{display:inline-block;margin:6px 6px 0 0}
.cnts{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 14px}
details.fold{margin-top:14px;border:1px solid var(--line);border-radius:6px;background:var(--surface)}
details.fold>summary{cursor:pointer;padding:10px 14px;font-weight:600}
details.fold>div{padding:0 14px 14px}
footer{margin-top:44px;padding-block:22px 48px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}
footer p{margin:4px 0;max-width:90ch}
@media (max-width:760px){
  body{font-size:14.5px}
  .decide li{grid-template-columns:1fr}
  .feat{grid-template-columns:1fr;gap:6px}
  .f-side{flex-direction:row;flex-wrap:wrap;align-items:center}
  .claim{grid-template-columns:1fr}
  .c-v{flex-direction:row;align-items:center}
  .nav .brand{display:none}
  .filters{top:49px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{.nav,.filters,.theme{display:none}.feat,.claim{break-inside:avoid}body{background:#fff}}
`;

const JS = `
(function(){
  var root=document.documentElement,btn=document.getElementById('theme');
  var modes=['auto','light','dark'],label={auto:'화면 설정 따름',light:'밝게',dark:'어둡게'};
  var cur='auto';
  try{cur=localStorage.getItem('bl-theme')||'auto'}catch(e){}
  function apply(m){if(m==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',m);if(btn)btn.textContent='화면: '+label[m];}
  apply(cur);
  if(btn)btn.addEventListener('click',function(){cur=modes[(modes.indexOf(cur)+1)%3];apply(cur);try{localStorage.setItem('bl-theme',cur)}catch(e){}});

  var feats=[].slice.call(document.querySelectorAll('.feat')),q=document.getElementById('q'),chips=[].slice.call(document.querySelectorAll('.fchip')),out=document.getElementById('fcount');
  var st='all';
  function run(){
    var t=(q&&q.value||'').trim().toLowerCase(),shown=0;
    feats.forEach(function(f){
      var ok=(st==='all'||f.getAttribute('data-status')===st)&&(!t||f.getAttribute('data-hay').indexOf(t)>-1);
      f.hidden=!ok;if(ok)shown++;
    });
    [].slice.call(document.querySelectorAll('.area')).forEach(function(a){
      var any=a.querySelector('.feat:not([hidden])');a.style.display=any?'':'none';
    });
    if(out)out.textContent=(t||st!=='all')?('조건에 맞는 기능 '+shown+'개 (전체 '+feats.length+'개)'):('기능 '+feats.length+'개 모두 보는 중');
  }
  if(q)q.addEventListener('input',run);
  chips.forEach(function(c){c.addEventListener('click',function(){
    st=c.getAttribute('data-st');chips.forEach(function(x){var on=x===c;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false')});run();
  })});

  var links=[].slice.call(document.querySelectorAll('.nav li a'));
  if('IntersectionObserver' in window){
    var map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.remove('on')});var a=map[e.target.id];if(a)a.classList.add('on')}})},{rootMargin:'-20% 0px -70% 0px'});
    Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el)});
  }
})();
`;

const flat = allClaimsFlat();
const cc = verdictCounts(flat);
const relClaims = (spec.only.release || []).map((c) => ({ ...c, areaTitle: "배포·남은 작업" }));
const order = { pending: 0, changed: 1, done: 2, current: 3, stale: 4, unimplemented: 5, nocode: 6, unchecked: 7 };
relClaims.sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9));
const stratClaims = (spec.only.strategy || []).map((c) => ({ ...c, areaTitle: "전략·결정" }));
const mismatchClaims = flat.filter((c) => ["changed", "stale", "unimplemented"].includes(c.verdict) && c.areaTitle !== "배포·남은 작업");
const refutedAll = spec.areas.flatMap((a) => a.refuted.map((r) => ({ ...r, area: a.title })));
const dateKst = KST.slice(0, 10);

const nav = [["status", "현황"], ["spec", "기능서"], ["apps", "앱 6종"], ["data", "데이터·연동"], ["todo", "남은 일"], ["check", "문서 대조"], ["src", "출처"]];
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>보틀 렌즈 기능·현황서</title>
<meta name="description" content="보틀 렌즈 앱의 주종별 진행 현황과 기능서 — 정리파일과 코드를 나란히 놓고 확인한 결과">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<nav class="nav" aria-label="목차"><div class="wrap"><span class="brand">보틀 렌즈</span><ul>${nav.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join("")}</ul><button type="button" class="theme" id="theme">화면: 화면 설정 따름</button></div></nav>
<main class="wrap">
<header class="top">
  <h1>보틀 렌즈 기능·현황서</h1>
  <p class="lead">술병 라벨을 찍으면 이름·맛·역사·페어링과 “N만원대” 가격대를 알려 주는 앱입니다. 엔진 하나로 주종별 앱 여섯(와인·사케·맥주·위스키·전통주·증류주)을 냅니다.</p>
  <p class="meta">기준 ${esc(dateKst)} · 코드 ${esc(prog.git.lastCommit.split(" ").slice(0, 2).join(" "))} + 미커밋 ${n(prog.git.uncommitted)}건 · 정리파일 ${(spec.docs || []).length}개와 코드를 나란히 읽고 영역별 독립 검증을 거침</p>
  ${summaryTiles()}
</header>

<section class="blk" id="status">
  <h2>진행 현황 — 주종별</h2>
  <p class="sub-lead">${n(T.total)}종을 앱 화면에 내보냅니다. 정보는 웹 조사로 대조·보강한 것과 판매처 구조화 정보로 채운 것으로 나뉘고, 출처를 못 찾은 항목은 이름 색인으로만 둡니다.</p>
  ${progressTable()}
  <h4 class="sub">앱별 합계</h4>
  ${appTotalsTable()}
  <h4 class="sub">데이터 작업 현황</h4>
  ${pipelineCards()}
  <h4 class="sub">지금 결정이 필요한 것</h4>
  ${decisions()}
</section>

<section class="blk" id="spec">
  <h2>기능서 — 앱에 어떤 기능이 있나</h2>
  <p class="sub-lead">기능 ${featAll.length}개를 일곱 영역으로 나눴습니다. 상태는 코드를 직접 따라가 정했습니다 — <b>구현</b>: 화면에서 API·lib 까지 실제로 이어짐 · <b>부분</b>: 일부 앱·조건에서만 · <b>꺼짐</b>: 코드는 있으나 스위치로 꺼 둠 · <b>계획</b>: 주석·문서에만 있음 · <b>죽은코드</b>: 어디서도 부르지 않음. 근거는 파일:줄입니다.</p>
  ${filterBar()}
  ${spec.areas.map(areaHtml).join("")}
  ${refutedAll.length ? `<details class="fold"><summary>독립 검증에서 코드로 확인되지 않아 뺀 항목 ${refutedAll.length}개</summary><div><ul>${refutedAll.map((r) => `<li><b>${esc(r.name)}</b> (${esc(r.area)}) — ${esc(r.note || r.desc)}</li>`).join("")}</ul></div></details>` : ""}
</section>

<section class="blk" id="apps">
  <h2>앱 6종 — 같은 엔진, 다른 껍데기</h2>
  <p class="sub-lead">스캔·분석·카탈로그·추천·셀러는 여섯 앱이 똑같이 쓰고, 색·서체·앱이 쓰는 말·결과 화면 구성만 앱마다 갈아끼웁니다(NEXT_PUBLIC_APP, lib/apps/*.js).</p>
  ${appMatrix()}
</section>

<section class="blk" id="data">
  <h2>데이터 · 외부 연동 · 스위치</h2>
  <p class="sub-lead">만들어 두었지만 지금은 내보내지 않는 기능은 lib/features.js 스위치 네 개로 꺼 둡니다. 코드를 지우지 않고 화면에서만 감춘 것입니다.</p>
  ${flagsHtml()}
  <h4 class="sub">정기 실행(크론)</h4>
  ${cronHtml()}
  <h4 class="sub">가격 출처 현황 (2026-10-01 확인)</h4>
  <div class="scroll"><table class="ptable small"><thead><tr><th scope="col">출처</th><th scope="col">상태</th><th scope="col">비고</th></tr></thead><tbody>
    <tr><th scope="row">데일리샷 내부 API</th><td>${pill("작동", "impl")}</td><td>유일하게 실시간 최저가가 나오는 출처. 막히면 끝나는 위험이 있어 제휴가 유일한 해소책. 와인은 이것 하나뿐.</td></tr>
    <tr><th scope="row">네이버 쇼핑 검색 API</th><td>${pill("종료", "dead")}</td><td>2026-07-31 영구 종료(SE05), 대체 API 없음. 이미지·웹 검색은 살아 있으나 NAVER API HUB 로 옮겨야 하고 마감은 2027-06-30.</td></tr>
    <tr><th scope="row">11번가 오픈 API</th><td>${pill("꺼짐", "off")}</td><td>서비스는 살아 있고 키(ELEVENST_KEY)가 없다. 키만 넣으면 lib/elevenst.js 가 켜진다. 택배 상품이 섞여 “참고가”로 따로 표시해야 한다.</td></tr>
    <tr><th scope="row">다나와 (ScraperAPI 경유)</th><td>${pill("일부", "part")}</td><td>위스키만 쓸 만하다. 와인은 6/20(30%)이고 세트가 많다.</td></tr>
  </tbody></table></div>
  <p class="foot">가격 조회 경로(app/api/shop/route.js): 데일리샷 → 네이버(종료) → 11번가(키 없음) → 다나와(위스키만). 2026-10-01 결정으로 가격은 “N만원대”로만 두고 실시간 조회는 더 넓히지 않는다.</p>
</section>

<section class="blk" id="todo">
  <h2>배포 전 점검 · 남은 일</h2>
  <p class="sub-lead">공개하기 전에 막아야 할 위험(코드 점검 결과)과, 남은 작업 문서(docs/남은작업.md·배포체크리스트.md·안드로이드출시.md 등)의 항목을 지금 코드·파일 상태에 맞춰 다시 확인한 결과입니다.</p>
  <h4 class="sub">코드 점검에서 나온 위험</h4>
  <p class="foot">지금은 개발 환경에서만 쓰고 있어 문제가 드러나지 않았을 뿐, 공개 배포 전에는 위 높음 항목을 먼저 막아야 합니다. “직접 확인”은 이 문서를 만든 쪽이 코드·DB 에서 한 번 더 확인한 것, “검증자 확인”은 독립 검증자가 코드를 읽고 적은 것입니다.</p>
  ${risksHtml()}
  <h4 class="sub">문서 기준 남은 일</h4>
  <div class="cnts">${["pending", "done", "changed", "stale", "unimplemented", "nocode"].filter((k) => relClaims.some((c) => c.verdict === k)).map((k) => pill(`${CV[k]} ${relClaims.filter((c) => c.verdict === k).length}`, CVC[k])).join("")}</div>
  ${claimRows(relClaims)}
  <h4 class="sub">전략·결정 (문서가 말하는 방향과 현재 방향)</h4>
  ${claimRows(stratClaims)}
</section>

<section class="blk" id="check">
  <h2>정리파일과 코드가 어긋난 곳</h2>
  <p class="sub-lead">정리파일에서 뽑은 주장 ${flat.length}개를 코드에 비춰 판정했습니다. 그대로 ${cc.current || 0} · 바뀜 ${cc.changed || 0} · 낡음 ${cc.stale || 0} · 코드에 없음 ${cc.unimplemented || 0} · 코드로 확인 불가(전략·수치) ${cc.nocode || 0} · 남은 일 ${(cc.pending || 0) + (cc.done || 0)}${cc.unchecked ? ` · 미검증 ${cc.unchecked}` : ""}. 아래는 그대로가 아닌 것입니다 — 이 문서(기능서)가 앞선 정리파일보다 우선합니다.</p>
  ${claimRows(mismatchClaims)}
</section>

<section class="blk" id="src">
  <h2>출처 — 읽은 정리파일</h2>
  <p class="sub-lead">아래 문서를 모두 읽었고, 날짜가 오래된 것은 지금 코드와 다를 수 있어 코드로 다시 확인했습니다.</p>
  ${docsHtml()}
  ${spec.critic?.uncited?.length ? `<details class="fold"><summary>기능 근거로 인용되지 않은 코드 파일 ${spec.critic.uncited.length}개 (누락 점검자 확인)</summary><div><ul>${spec.critic.uncited.map((u) => `<li><code>${esc(u.file)}</code> — ${esc(u.why)}</li>`).join("")}</ul></div></details>` : ""}
</section>
</main>
<footer><div class="wrap">
  <p><b>만든 방법</b> 정리파일 6묶음과 코드 7영역을 각각 따로 읽고, 영역마다 독립 검증자가 반박을 기본값으로 코드를 다시 열어 확인한 뒤, 근거로 인용되지 않은 파일을 누락 점검자가 훑었습니다(에이전트 ${spec.agents ?? "여럿"}개 — 정리파일 읽기 ${spec.agentKinds?.docs ?? "-"} · 코드 읽기 ${spec.agentKinds?.read ?? "-"} · 독립 검증 ${(spec.agentKinds?.verify ?? 0) + (spec.agentKinds?.claims ?? 0)} · 누락 점검 ${spec.agentKinds?.critic ?? "-"}). 진행 수치는 DB 를 직접 센 값입니다(scripts/_progress-stats.mjs).</p>
  <p><b>한계</b> 코드를 읽어 정한 상태라 화면을 직접 조작해 본 결과와 다를 수 있습니다. 스위치·환경변수는 코드 기본값 기준이며 실제 배포 환경의 값은 확인하지 못했습니다. 개발 서버·배포 서버에는 접속하지 않았습니다.</p>
  <p>생성 ${esc(KST)} KST · scripts/_progress-stats.mjs + scripts/_overview-html.mjs</p>
</div></footer>
<script>${JS}</script>
</body>
</html>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`저장: ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)}KB) · 기능 ${featAll.length}개 (${Object.entries(SC).map(([k, v]) => `${k} ${v}`).join(" · ")}) · 문서 주장 ${flat.length}개 ${JSON.stringify(cc)}`);
