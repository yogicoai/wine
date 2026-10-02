// 조사 데이터 보고서를 HTML 한 장으로 만든다.
//   node --env-file=.env.local scripts/_data-report.mjs      (수치 → data/research/_work/spec/data-report.json)
//   node scripts/_data-report-html.mjs [--out docs/데이터-현황-보고.html]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "docs/데이터-현황-보고.html");
// --artifact <경로> : 공유용 페이지(Artifact)로도 쓴다 — 문서 뼈대(doctype·head·body)는 게시할 때 씌워지므로 내용만 쓴다
const ART = arg("--artifact");
// 2026-10-02 오후에 DB 에 반영한 정리 (scripts/audit-apply.mjs · scripts/pair-band-fix.mjs 로그와 백업 기준)
const TODAY = { auditFixes: 23, auditDocs: 14, bandFixed: 242, bandBefore: 85, pairsUnlinked: 5, dupHidden: 1, vivino: 561, enNames: 987, pairing: 83, nonwineFill: 22 };
const R = JSON.parse(readFileSync("data/research/_work/spec/data-report.json", "utf8"));
// 가격대 정확도 대조(있을 때만) — data/research/_work/spec/_band-check.mjs 가 만든다
const BC = (() => { try { return JSON.parse(readFileSync("data/research/_work/spec/band-check.json", "utf8")); } catch { return null; } })();
// Opus 표본 재검증(있을 때만) — scripts/audit-report.mjs 가 만든다
const AU = (() => { try { return JSON.parse(readFileSync("data/research/_work/audit-report.json", "utf8")); } catch { return null; } })();
const pct1 = (x) => (x == null ? "-" : `${(x * 100).toFixed(1)}%`);
const FIELD_AU = { country: "국가", region: "지역·산지", producer: "생산자", type: "종류", alcohol: "도수", vintage: "빈티지", specs: "제원", history: "역사 연표", story: "이야기", winery: "생산자 소개", trivia: "트리비아", aging: "숙성", 기타: "기타" };
// 비용 없는 DB 대조(있을 때만) — data/research/_work/spec/_db-crosscheck.mjs 가 만든다
const XC = (() => { try { return JSON.parse(readFileSync("data/research/_work/spec/db-crosscheck.json", "utf8")); } catch { return null; } })();
function crossHtml() {
  if (!XC) return "";
  const row = (e) => `<tr><th scope="row">${esc(e.name)}<small style="display:block;color:var(--ink3);font-weight:400">${esc(CAT_KO[e.cat] || e.cat)} · ${esc(e.level || "")} 등급</small></th><td>${esc(e.ours)}</td><td>${esc(e.theirs)}</td><td>${esc(e.ds)}</td></tr>`;
  return `<h3>판매처 데이터와 전수 대조 (비용 0)</h3>
  <p class="sub">모델을 부르지 않고 DB 안의 두 출처를 맞춰 봤습니다. 웹 조사로 검증한 값과, 판매처(데일리샷) 색인이 가진 값입니다.</p>
  <div class="kv">
    <div><span>국가 비교</span><b>${n(XC.ctry.compared)}종 · 일치 ${pc(XC.ctry.agree, XC.ctry.compared)}%</b></div>
    <div><span>도수 비교</span><b>${n(XC.abv.compared)}종 · 일치 ${pc(XC.abv.agree, XC.abv.compared)}%</b></div>
  </div>
  <h3>국가가 다른 ${n(XC.ctry.disagree.length)}종</h3>
  ${table(["술", "우리 DB", "판매처", "판매처 상품명"], XC.ctry.disagree.map(row))}
  <p class="foot">다른 곳은 대부분 우리 값이 더 정확하다. 스톨리치나야는 지금 라트비아에서 만들고, 크라켄은 트리니다드 토바고산 럼이며, 라벨 5 버번 배럴은 스카치다. 도수가 다른 ${n(XC.abv.disagree.length)}종은 빈티지마다 도수가 다른 와인이 대부분이다. 판매처 쪽 오기도 섞여 있다(예: 샤또 라투르 16%). 상품을 잘못 이은 경우도 있다(예: 더 라인 ↔ 라인 39).</p>`;
}
function auditHtml() {
  if (!AU) return "";
  const lvRows = ["A", "B", "C"].map((lv) => { const t = AU.byLevel[lv]; const d = t.correct + t.wrong + t.partly; return `<tr><th scope="row">${lv} 등급</th><td class="num">${n(t.items)}</td><td class="num">${n(t.claims)}</td><td class="num">${n(t.correct)}</td><td class="num">${n(t.wrong)}</td><td class="num">${n(t.partly)}</td><td class="num">${n(t.unverifiable)}</td><td class="num"><b>${d ? pct1((t.wrong + t.partly) / d) : "-"}</b></td><td class="num">${n(t.itemsWithError)}/${n(t.items)}</td></tr>`; });
  const t = AU.all, d = t.correct + t.wrong + t.partly;
  lvRows.push(`<tr class="total"><th scope="row">합계</th><td class="num">${n(t.items)}</td><td class="num">${n(t.claims)}</td><td class="num">${n(t.correct)}</td><td class="num">${n(t.wrong)}</td><td class="num">${n(t.partly)}</td><td class="num">${n(t.unverifiable)}</td><td class="num"><b>${d ? pct1((t.wrong + t.partly) / d) : "-"}</b></td><td class="num">${n(t.itemsWithError)}/${n(t.items)}</td></tr>`);
  const fRows = Object.entries(AU.byField).sort((a, b) => b[1].claims - a[1].claims).map(([k, f]) => { const dd = f.correct + f.wrong + f.partly; return `<tr><th scope="row">${esc(FIELD_AU[k] || k)}</th><td class="num">${n(f.claims)}</td><td class="num">${n(f.wrong + f.partly)}</td><td class="num">${n(f.unverifiable)}</td><td class="num">${dd ? pct1((f.wrong + f.partly) / dd) : "-"}</td></tr>`; });
  const probs = AU.problems.map((x) => `<tr><td>${x.verdict === "wrong" ? "틀림" : "일부"}</td><th scope="row">${esc(x.name)}<small style="display:block;color:var(--ink3);font-weight:400">${esc(CAT_KO[x.category] || x.category)} · ${esc(x.level)} 등급</small></th><td>${esc(FIELD_AU[x.field] || x.field)}</td><td>${esc(x.claim)}</td><td>${esc(x.correct)}</td><td>${x.source ? `<code>${esc(String(x.source).replace(/^https?:\/\//, "").slice(0, 60))}</code>` : ""}</td></tr>`);
  return `<h3>Opus 표본 재검증</h3>
  <p class="sub">웹 조사로 검증한 술 중 ${n(AU.itemsPlanned)}종을 등급별로 무작위로 뽑았고, 그중 ${n(AU.itemsDone)}종(A ${n(AU.byLevel.A.items)} · B ${n(AU.byLevel.B.items)} · C ${n(AU.byLevel.C.items)})을 다른 모델(${esc(AU.models.join(", "))})이 처음부터 다시 확인했습니다${AU.missing?.length ? `(나머지 ${n(AU.missing.length)}종은 도중에 멈춤)` : ""}. 우리가 붙인 출처는 넘기지 않고 스스로 출처를 찾게 했습니다. 맛 표현·페어링 같은 주관적 서술은 빼고 사실 주장만 봤습니다.</p>
  <div class="kv">
    <div><span>확인한 주장</span><b>${n(t.claims)}개 (술 ${n(t.items)}종)</b></div>
    <div><span>틀림 · 일부 틀림</span><b>${n(t.wrong)} · ${n(t.partly)}</b></div>
    <div><span>확인 불가(출처 없음)</span><b>${n(t.unverifiable)}</b></div>
    <div><span>주장 오류율</span><b>${pct1(AU.errorRate)} (95% ${AU.errorCI ? AU.errorCI.map(pct1).join("~") : "-"})</b></div>
    <div><span>등급 비중으로 가중한 오류율</span><b>${pct1(AU.weightedErrorRate)}</b></div>
    <div><span>틀린 곳이 하나라도 있는 술</span><b>${pct1(AU.itemErrorShare)} (${n(t.itemsWithError)}/${n(t.items)})</b></div>
    <div><span>재검증에 쓴 것</span><b>검색 ${n(AU.searches)} · 열람 ${n(AU.fetches)} · 구독 사용량(API 환산 $${AU.cost}, 실제 결제 없음)</b></div>
    <div><span>DB 에 반영</span><b>32종에 재검증 기록 · 14종 23곳 수정</b></div>
  </div>
  ${table(["등급", "술", "주장", "맞음", "틀림", "일부", "확인 불가", "오류율", "틀린 술"], lvRows, [1, 2, 3, 4, 5, 6, 7, 8])}
  <h3>칸별</h3>
  ${table(["칸", "주장", "틀림·일부", "확인 불가", "오류율"], fRows, [1, 2, 3, 4])}
  ${probs.length ? `<h3>틀렸거나 일부 틀린 주장 ${n(probs.length)}개</h3>${table(["판정", "술", "칸", "우리 DB 의 주장", "재검증이 찾은 값", "근거"], probs)}` : ""}
  <p class="foot">오류율 = (틀림 + 일부 틀림) ÷ 판정이 난 주장. 확인 불가는 분모에서 뺐다. 표본이 ${n(t.items)}종이라 구간이 넓다 — 대략의 수준을 보는 값이다. ${AU.missing?.length ? `결과가 없는 술 ${AU.missing.length}종: ${esc(AU.missing.map((m) => m.name).join(", "))}.` : ""}</p>`;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x) => Number(x || 0).toLocaleString("ko-KR");
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const kst = (t) => (t ? new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16) : "-");
const CAT_KO = { wine: "와인", sake: "사케", beer: "맥주", whisky: "위스키", traditional: "전통주", makgeolli: "막걸리", soju: "소주", brandy: "브랜디", gin: "진", rum: "럼", tequila: "데킬라", baijiu: "백주", liqueur: "리큐르", vodka: "보드카", highball: "하이볼", spirits: "기타 증류주" };
const FIELD_KO = { specs: "제원", history: "역사 연표", alcohol: "도수", story: "이야기", tastingNotes: "시음 노트", region: "지역·산지", producer: "생산자", winery: "생산자 소개", trivia: "트리비아", type: "종류", country: "국가", foodPairing: "페어링 음식", tips: "음용 팁", ratings: "출처별 평점", servingTemp: "음용 온도", aging: "숙성", vintage: "빈티지", tasteProfile: "맛 축", similar: "비슷한 술", pairingTip: "페어링 팁", name: "이름", category: "주종", basis: "판단 근거", servingNote: "서빙 메모", avoidPairing: "피할 음식", liquidColor: "술 색" };
const T = R.shown, V = R.ver, X = R.extra, W = R.work;
const bar = (v, max, cls = "") => `<span class="hbar ${cls}"><i style="width:${max ? Math.max(0.5, (v / max) * 100) : 0}%"></i></span>`;
// numIdx: 오른쪽 정렬할(숫자) 열 번호
const table = (head, rows, numIdx = []) => `<div class="scroll"><table class="t"><thead><tr>${head.map((h, i) => `<th scope="col"${numIdx.includes(i) ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const chars = (c) => (!c ? "" : c < 1000 ? `${n(c)}자` : `${n(Math.round(c / 1000))}천 자`);

// ── 1. 칸별 ──
const maxPts = Math.max(...R.fields.map((f) => f.points));
const fieldRows = R.fields.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td class="num">${n(f.docs)}</td><td class="num">${pc(f.docs, T)}%</td><td class="num"><b>${n(f.points)}</b></td><td>${bar(f.points, maxPts)}</td><td class="num">${chars(f.chars)}</td></tr>`);
fieldRows.push(`<tr><th scope="row">가격대(N만원대)</th><td class="num">${n(X.priceBand)}</td><td class="num">${pc(X.priceBand, T)}%</td><td class="num"><b>${n(X.priceBand)}</b></td><td>${bar(X.priceBand, maxPts)}</td><td></td></tr>`);
fieldRows.push(`<tr><th scope="row">조사 시세(가격 범위)</th><td class="num">${n(X.priceInfo)}</td><td class="num">${pc(X.priceInfo, T)}%</td><td class="num"><b>${n(X.priceInfo)}</b></td><td>${bar(X.priceInfo, maxPts)}</td><td></td></tr>`);
fieldRows.push(`<tr class="total"><th scope="row">합계</th><td></td><td></td><td class="num"><b>${n(R.totalPoints)}</b></td><td></td><td class="num">${n(Math.round(R.fields.reduce((a, f) => a + f.chars, 0) / 10000))}만 자</td></tr>`);

// ── 2. 주종별 ──
const cats = Object.entries(R.byCat).sort((a, b) => b[1].items - a[1].items);
const catRows = cats.map(([k, c]) => `<tr><th scope="row">${esc(CAT_KO[k] || k)}</th><td class="num">${n(c.items)}</td><td class="num">${n(c.verified)}</td><td class="num">${n(c.structured)}</td><td class="num"><b>${n(c.points)}</b></td><td class="num">${c.items ? (c.points / c.items).toFixed(1) : "-"}</td><td class="num">${n(c.story)}</td><td class="num">${n(c.history)}</td><td class="num">${n(c.pairing)}</td><td class="num">${n(c.specs)}</td></tr>`);
const tot = cats.reduce((t, [, c]) => { for (const k of Object.keys(c)) t[k] = (t[k] || 0) + c[k]; return t; }, {});
catRows.push(`<tr class="total"><th scope="row">합계</th><td class="num">${n(tot.items)}</td><td class="num">${n(tot.verified)}</td><td class="num">${n(tot.structured)}</td><td class="num"><b>${n(tot.points)}</b></td><td class="num">${(tot.points / tot.items).toFixed(1)}</td><td class="num">${n(tot.story)}</td><td class="num">${n(tot.history)}</td><td class="num">${n(tot.pairing)}</td><td class="num">${n(tot.specs)}</td></tr>`);

// ── 3. 출처 ──
const totalCites = R.topDomains.reduce((a, x) => a + x.n, 0);
const topShare = pc(R.topDomains.slice(0, 12).reduce((a, x) => a + x.n, 0), V.sources);
const domMax = R.topDomains[0]?.n || 1;
const domRows = R.topDomains.slice(0, 15).map((x, i) => `<tr><td class="num">${i + 1}</td><th scope="row"><code>${esc(x.d)}</code></th><td class="num">${n(x.n)}</td><td class="num">${pc(x.n, V.sources)}%</td><td>${bar(x.n, domMax)}</td></tr>`);
const srcDist = [["0건", V.srcPerDoc["0"]], ["1건", V.srcPerDoc["1"]], ["2건", V.srcPerDoc["2"]], ["3건 이상", V.srcPerDoc["3+"]]];
const corrMax = Math.max(...R.corrBy.map((x) => x.n), ...R.remBy.map((x) => x.n));
const corrRows = R.corrBy.slice(0, 8).map((x) => `<tr><th scope="row">${esc(FIELD_KO[x.f] || x.f)}</th><td class="num">${n(x.n)}</td><td>${bar(x.n, corrMax, "warn")}</td></tr>`);
const remRows = R.remBy.slice(0, 8).map((x) => `<tr><th scope="row">${esc(FIELD_KO[x.f] || x.f)}</th><td class="num">${n(x.n)}</td><td>${bar(x.n, corrMax, "dead")}</td></tr>`);

// ── 4. 컬렉션 ──
const COL_KO = { catalog: "술 정보(카탈로그)", dailyshot: "판매처 가격 색인(데일리샷)", sessions: "스캔 기록", cellar: "셀러(내 술)", preferences: "취향 문답 답", wanted: "못 찾은 술 목록", deal_notices: "특가 알림 기록", drink_notices: "음용 적기 알림 기록", ratings: "집단 평점", push_subscriptions: "푸시 구독" };
const colRows = R.collections.map((c) => `<tr><th scope="row"><code>${esc(c.name)}</code></th><td>${esc(COL_KO[c.name] || "")}</td><td class="num">${n(c.n)}</td></tr>`);

const photoSrcKo = { dailyshot: "데일리샷", "naver-shopping": "네이버쇼핑", agent: "에이전트 수집", research: "조사 에이전트" };
const tiles = [
  { big: n(T), label: "술 항목", sub: `앱 6종이 보여 주는 술 (숨긴 술 아님·중복 ${n(R.excluded)}종 제외)` },
  { big: n(R.totalPoints), label: "쓰여 있는 데이터 값", sub: `술 한 종에 평균 ${(R.totalPoints / T).toFixed(1)}개 · 글 약 ${n(Math.round(R.fields.reduce((a, f) => a + f.chars, 0) / 10000))}만 자` },
  { big: n(V.docs), label: "웹 조사로 검증한 술", sub: `출처 ${n(V.sources)}건 · 정정 ${n(V.corrections)} · 뺀 주장 ${n(V.removed)}` },
  { big: n(X.photoHosted), label: "확인해 올린 사진", sub: `${pc(X.photoHosted, T)}% · ${(R.photo.liveBytes / 1048576).toFixed(1)}MB` },
  { big: n(R.dsIndex.total), label: "판매처 가격 색인", sub: `데일리샷 상품 · 가격 있음 ${n(R.dsIndex.withPrice)}` },
];

const CSS = `
:root{--bg:#f0f5f2;--surface:#fff;--surface2:#e6eee9;--ink:#13211a;--ink2:#46584e;--ink3:#6f8077;--line:#cfdbd4;--line2:#e1eae5;--accent:#1a6a4f;--accent-ink:#fff;--warn:#a1610b;--dead:#a5352f;--bar:#1a6a4f;--bar-bg:#e1eae5;--code:#e8efeb;--font:"IBM Plex Sans KR","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0d1612;--surface:#141f1a;--surface2:#1b2923;--ink:#e3ede7;--ink2:#a2b3aa;--ink3:#7c8e85;--line:#2a3b33;--line2:#22322b;--accent:#5bc59b;--accent-ink:#06130d;--warn:#e6b25a;--dead:#f19c96;--bar:#4fb88f;--bar-bg:#22322b;--code:#1a2822;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1612;--surface:#141f1a;--surface2:#1b2923;--ink:#e3ede7;--ink2:#a2b3aa;--ink3:#7c8e85;--line:#2a3b33;--line2:#22322b;--accent:#5bc59b;--accent-ink:#06130d;--warn:#e6b25a;--dead:#f19c96;--bar:#4fb88f;--bar-bg:#22322b;--code:#1a2822;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 var(--font);word-break:keep-all;overflow-wrap:break-word}
.wrap{max-width:1040px;margin:0 auto;padding-inline:16px}
header.top{padding-block:40px 6px}
h1{font-size:clamp(26px,4vw,36px);line-height:1.2;margin:0 0 10px;text-wrap:balance}
.lead{color:var(--ink2);max-width:66ch;margin:0 0 6px;font-size:16px}
.meta{font-size:13px;color:var(--ink3);margin:0}
section{padding-block:30px 4px}
h2{font-size:21px;margin:0 0 6px;text-wrap:balance}
h3{font-size:15.5px;margin:22px 0 6px}
p.sub{margin:0 0 14px;color:var(--ink2);max-width:72ch}
.foot{font-size:12.5px;color:var(--ink3);margin:8px 0 0;max-width:88ch}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:20px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tile b{font-size:28px;line-height:1.15;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.tile span{font-weight:600}
.tile small{color:var(--ink3);font-size:12px;line-height:1.5}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--surface)}
.t{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
.t th,.t td{padding:7px 12px;text-align:left;border-bottom:1px solid var(--line2);vertical-align:middle}
.t thead th{font-size:12px;color:var(--ink3);font-weight:600;background:var(--surface2);white-space:nowrap}
.t tbody tr:last-child th,.t tbody tr:last-child td{border-bottom:0}
.t th[scope=row]{font-weight:500;white-space:nowrap}
.t .num{text-align:right;white-space:nowrap}
.t tr.total th,.t tr.total td{background:var(--surface2);font-weight:700}
.hbar{display:inline-block;width:160px;height:10px;background:var(--bar-bg);border-radius:2px;overflow:hidden;vertical-align:middle}
.hbar i{display:block;height:100%;background:var(--bar)}
.hbar.warn i{background:var(--warn)}.hbar.dead i{background:var(--dead)}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.two>div{min-width:0}
.note{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:12px 16px;font-size:14px;color:var(--ink2)}
.note b{color:var(--ink)}
.note ul{margin:6px 0 0;padding-left:1.2rem}
code{font:12.5px/1.5 var(--mono);background:var(--code);padding:1px 6px;border-radius:3px;color:var(--ink)}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 18px;margin:4px 0 0;padding:12px 16px;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.kv div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--line2);padding:3px 0;font-size:13.5px}
.kv b{font-variant-numeric:tabular-nums}
footer{margin-top:40px;padding-block:20px 44px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}
footer p{margin:4px 0;max-width:88ch}
.summary{padding-block:26px 4px}
.sum{margin:8px 0 0;padding:16px 20px 16px 36px;background:var(--surface);border:1px solid var(--line);border-radius:6px;display:grid;gap:10px}
.sum li{color:var(--ink2);line-height:1.7}
.sum li b{color:var(--ink)}
@media (max-width:640px){.hbar{width:90px}}
`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>보틀 렌즈 데이터 보고</title>
<meta name="description" content="보틀 렌즈 DB 에 조사로 쌓인 데이터가 무엇이 몇 개인지 — 칸별·주종별·출처·사진·가격·번역·사용 기록">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<main class="wrap">
<header class="top">
  <h1>보틀 렌즈 데이터 보고</h1>
  <p class="lead">지금 DB 에 술 ${n(T)}종의 정보가 데이터 값 ${n(R.totalPoints)}개로 쓰여 있습니다. 그중 ${n(V.docs)}종은 웹 자료로 대조해 출처 ${n(V.sources)}건을 붙였고, 확인되지 않은 주장 ${n(V.removed)}건은 지웠습니다.</p>
  <p class="meta">기준 ${esc(kst(R.at))} KST · DB 를 직접 센 값(읽기만) · 데이터 값 = 글·숫자 칸은 1개, 목록 칸(연표·페어링·제원·팁·맛 축 등)은 원소 수만큼</p>
  <div class="tiles">${tiles.map((t) => `<div class="tile"><b>${esc(t.big)}</b><span>${esc(t.label)}</span><small>${esc(t.sub)}</small></div>`).join("")}</div>
</header>

<section class="summary">
  <h2>보고 요약</h2>
  <ol class="sum">
    <li><b>술 ${n(T)}종의 정보를 DB 에 쌓았습니다.</b> 데이터 값은 ${n(R.totalPoints)}개(술 한 종에 평균 ${(R.totalPoints / T).toFixed(0)}개)이고, 설명 글은 약 ${n(Math.round(R.fields.reduce((a, f) => a + f.chars, 0) / 10000))}만 자입니다. 제원 ${n(R.fields.find((f) => f.key === "specs")?.points)}줄 · 맛 축 ${n(R.fields.find((f) => f.key === "tasteProfile")?.points)}개 · 페어링 ${n(R.fields.find((f) => f.key === "foodPairing")?.points)}개 · 역사 연표 ${n(R.fields.find((f) => f.key === "history")?.points)}건이 들어 있습니다.</li>
    <li><b>${n(V.docs)}종(${pc(V.docs, T)}%)은 웹 자료로 하나하나 대조했습니다.</b> 출처 ${n(V.sources)}건을 붙였고, 기존 값 ${n(V.corrections)}건을 고쳤으며, 확인되지 않은 주장 ${n(V.removed)}건은 지웠습니다. 판매처 정보로 채운 술 ${n(Object.values(R.byCat).reduce((a, c) => a + c.structured, 0))}종을 더하면 정보가 채워진 술은 ${n(V.docs + Object.values(R.byCat).reduce((a, c) => a + c.structured, 0))}종(${pc(V.docs + Object.values(R.byCat).reduce((a, c) => a + c.structured, 0), T)}%)입니다.</li>
    <li><b>사진 ${n(X.photoHosted)}장(${pc(X.photoHosted, T)}%)</b>을 이름의 그 상품인지 확인한 뒤 우리 서버에 올렸습니다.</li>
    <li><b>가격</b>은 “N만원대” 가격대로 ${n(X.priceBand)}종에 있고, 판매처 가격 색인 ${n(R.dsIndex.total)}개를 갖고 있습니다.${BC ? ` 판매처 가격과 이어진 ${n(BC.A.all.n)}종은 실제 판매가와 ${pc(BC.A.all.exact, BC.A.all.n)}% 같은 구간입니다.` : ""}</li>
    ${AU ? `<li><b>신뢰도</b> — 다른 AI(Opus)가 표본 ${n(AU.itemsDone)}종을 처음부터 다시 확인한 결과 사실 주장의 오류율은 ${pct1(AU.errorRate)}였고, 나라·생산자·종류는 틀린 것이 없었습니다(틀린 곳은 연도·제원 같은 세부).${XC ? ` 판매처 데이터와 전수로 맞춰 보면 국가 ${pc(XC.ctry.agree, XC.ctry.compared)}% · 도수 ${pc(XC.abv.agree, XC.abv.compared)}%가 일치합니다.` : ""}</li>` : ""}
    <li><b>오늘(10-02) 바로잡은 것</b> — 재검증에서 나온 ${TODAY.auditFixes}곳(${TODAY.auditDocs}종), 가격대 ${n(TODAY.bandFixed)}종, 다른 상품과 잘못 이어진 판매처 짝 ${TODAY.pairsUnlinked}건, 같은 술이 두 칸을 차지한 중복 ${TODAY.dupHidden}건. 모두 원래 값을 백업해 두었습니다.</li>
    <li><b>오늘(10-02) 비용 없이 더한 것</b> — 이미 가진 판매처 데이터에서 이름이 꽉 맞는 짝만 골라 Vivino 평점 ${n(TODAY.vivino)}종, 영어 화면용 영문 상품명 ${n(TODAY.enNames)}종, 어울리는 음식 ${n(TODAY.pairing)}종을 채웠고, 와인 밖 술 ${TODAY.nonwineFill}종의 빈칸(종류·용량·시음 노트 등)도 채웠습니다. 모델 호출 없이 DB 안에서만 했습니다.</li>
    <li><b>남은 과제</b> — 판매처가 취급하지 않는 와인 962종은 이름·가격대만 있습니다. 영어·일본어는 이름·나라·제원만 번역했고 설명 글은 한국어입니다. 사용자 기록(스캔·셀러)은 아직 시험 수준입니다.</li>
  </ol>
</section>

<section>
  <h2>1. 무엇이 몇 개 쓰여 있나 — 칸별</h2>
  <p class="sub">술 정보 화면에 나오는 칸마다, 채워진 술이 몇 종이고 값이 몇 개인지입니다. 제원·맛 축·페어링·연표처럼 여러 줄로 된 칸이 데이터의 대부분을 차지합니다.</p>
  ${table(["칸", "채워진 술", "비율", "데이터 값", "", "글 분량"], fieldRows, [1, 2, 3, 5])}
  <p class="foot">비율은 술 ${n(T)}종 대비. 맛 축 수치 중 ${n(X.tasteEstimated)}종은 품종에서 짐작한 값이라 화면에 “짐작한 값”으로 밝힌다(출처 없는 와인 777종의 짐작값은 10-02 에 걷었다). 이름·주종처럼 모든 술에 있는 기본 칸은 세지 않았다.</p>
</section>

<section>
  <h2>2. 주종별 데이터</h2>
  <p class="sub">와인이 항목 수는 가장 많지만 판매처가 취급하지 않는 와인 962종은 이름 색인만 있어 술당 데이터 값이 낮습니다. 나머지 주종은 90% 이상이 웹 조사를 거쳤습니다.</p>
  ${table(["주종", "술", "웹 조사 검증", "판매처 구조화", "데이터 값", "술당 평균", "이야기", "연표", "페어링", "제원"], catRows, [1, 2, 3, 4, 5, 6, 7, 8, 9])}
</section>

<section>
  <h2>3. 검증과 출처 — 얼마나 믿을 수 있나</h2>
  <p class="sub">웹 조사는 술마다 자료를 찾아 기존 값과 대조하고, 출처로 확인한 것만 남겼습니다. 등급은 A 권위 있는 출처 둘 이상 · B 한 출처 또는 일반 지식과 일치 · C 일부만 확인(확인 못 한 부분은 줄이거나 뺌)입니다.</p>
  <div class="kv">
    <div><span>검증한 술</span><b>${n(V.docs)}종</b></div>
    <div><span>A 등급</span><b>${n(V.level.A)} (${pc(V.level.A, V.docs)}%)</b></div>
    <div><span>B 등급</span><b>${n(V.level.B)} (${pc(V.level.B, V.docs)}%)</b></div>
    <div><span>C 등급(부분)</span><b>${n(V.level.C)} (${pc(V.level.C, V.docs)}%)</b></div>
    <div><span>붙인 출처</span><b>${n(V.sources)}건</b></div>
    <div><span>술당 평균 출처</span><b>${(V.sources / V.docs).toFixed(1)}건</b></div>
    <div><span>고유 주소 · 도메인</span><b>${n(V.uniqueUrls)} · ${n(V.uniqueDomains)}</b></div>
    <div><span>서로 다른 사이트 2곳 이상</span><b>${n(V.multiDomainDocs)}종 (${pc(V.multiDomainDocs, V.docs)}%)</b></div>
    <div><span>출처가 받쳐 준 칸 표시</span><b>${n(V.usedCites)}건</b></div>
    <div><span>고친 값</span><b>${n(V.corrections)}건</b></div>
    <div><span>확인 못 해 뺀 주장</span><b>${n(V.removed)}건</b></div>
  </div>
  <h3>술마다 붙은 출처 수</h3>
  ${table(["출처 수", "술", "비율"], srcDist.map(([k, v]) => `<tr><th scope="row">${k}</th><td class="num">${n(v)}</td><td class="num">${pc(v, V.docs)}%</td></tr>`), [1, 2])}
  <h3>많이 쓰인 출처 사이트</h3>
  ${table(["순위", "사이트", "인용", "비율", ""], domRows, [0, 2, 3])}
  <p class="foot">상위 12개 사이트가 인용의 ${topShare}%이고 나머지는 ${n(V.uniqueDomains)}개 사이트에 흩어져 있다(한 사이트에 쏠리지 않았다). 판매처(데일리샷) 페이지는 제원·지역·품종 근거로는 쓸 만하지만 이야기·역사의 근거로는 약하다.</p>
  <div class="two">
    <div><h3>고친 값이 많은 칸</h3>${table(["칸", "건", ""], corrRows, [1])}</div>
    <div><h3>확인 못 해 뺀 주장이 많은 칸</h3>${table(["칸", "건", ""], remRows, [1])}</div>
  </div>
  <div class="note" style="margin-top:14px"><b>이 조사를 한 모델과 한계</b>
    <ul>
      <li>웹 조사 ${n(W.batches)}묶음은 모두 <b>${esc(Object.keys(W.models).join(", "))}</b> 가 했다(검색 ${n(W.searches)}회, ${esc(kst(W.from))} ~ ${esc(kst(W.to))} KST). 사진 찾기 ${n(W.imageFind.batches)}묶음은 ${esc(Object.keys(W.imageFind.models).join(", ") || "기록 없음")}, 사진 확인 ${n(W.imageCheck.batches)}묶음은 ${esc(Object.keys(W.imageCheck.models).join(", ") || "기록 없음")}.</li>
      <li>DB 에 넣기 전에 형식(칸 종류·길이·주소)과 출처 유무는 기계적으로 검사했다. 반면 “출처가 정말 그 말을 하는가”를 다른 모델이 다시 읽어 확인한 적은 없다.</li>
      <li>${AU ? "그래서 아래처럼 표본을 뽑아 다른 모델(Opus)로 다시 확인해 틀린 비율을 쟀다." : "그래서 정확도를 숫자로 말하려면 표본 재검증이 필요하다 — 검증한 술을 무작위로 골라 다른 모델(Opus)로 처음부터 다시 조사해 틀린 값의 비율을 잰다."}</li>
    </ul>
  </div>
  ${auditHtml()}
  ${crossHtml()}
</section>

<section>
  <h2>4. 판매처·가격 데이터</h2>
  <div class="kv">
    <div><span>판매처 가격 색인(데일리샷 상품)</span><b>${n(R.dsIndex.total)}개</b></div>
    <div><span>그중 가격 있음</span><b>${n(R.dsIndex.withPrice)}개</b></div>
    <div><span>그중 Vivino 평점 있음</span><b>${n(R.dsIndex.withVivino)}개</b></div>
    <div><span>판매처 상세 사실이 붙은 술</span><b>${n(X.dailyshotFacts)}종</b></div>
    <div><span>가격대(N만원대)가 있는 술</span><b>${n(X.priceBand)}종 (${pc(X.priceBand, T)}%)</b></div>
    <div><span>조사 시세(가격 범위)가 있는 술</span><b>${n(X.priceInfo)}종</b></div>
  </div>
  <p class="foot">가격은 2026-10-01 결정대로 “N만원대” 가격대로만 보여 준다. 판매처 색인은 결과 화면의 최저가 확인과 셀러 가격 이력에 쓰인다.</p>
  ${BC ? `<h3>가격대가 실제 값과 맞는가</h3>
  <p class="sub">판매처 가격이 이어진 술 ${n(BC.A.all.n)}종의 가격대를 실제 판매가로 다시 매겨 견줬습니다. 가격대 구간은 2만 이하 · 2~5만 · 5~10만 · 10~30만 · 30만 이상입니다.</p>
  ${table(["기준", "술", "같은 구간", "한 구간 차이", "두 구간 이상", "실제보다 낮게", "실제보다 높게"], [
    ["판매처 가격 (전체)", BC.A.all], ["판매처 가격 (표준 병 500~1000ml)", BC.A.std], ["웹 조사 검증된 술", BC.A.byVerified.yes], ["검증 안 된 술", BC.A.byVerified.no], ["조사 시세 범위의 가운데 값", BC.B.all],
    ...Object.entries(BC.A.byCat).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, t]) => [`· ${CAT_KO[k] || k}`, t]),
  ].map(([label, t]) => `<tr><th scope="row">${esc(label)}</th><td class="num">${n(t.n)}</td><td class="num"><b>${pc(t.exact, t.n)}%</b></td><td class="num">${pc(t.off1, t.n)}%</td><td class="num">${pc(t.off2, t.n)}%</td><td class="num">${pc(t.low, t.n)}%</td><td class="num">${pc(t.high, t.n)}%</td></tr>`), [1, 2, 3, 4, 5, 6])}
  <p class="foot">10-02 오후까지는 같은 구간이 ${TODAY.bandBefore}%였다. 한 구간 어긋난 것의 46%가 경계에서 20% 넘게 벗어난 실제 오류여서, 판매처 가격으로 ${n(TODAY.bandFixed)}종을 다시 매겼다(행사가·세트·미니·옛 빈티지·표준 병이 아닌 값은 근거로 쓰지 않음, 원래 값은 백업). 예: 실제 29,000원인 와인이 '10~30만원'으로 들어가 있었다. 남은 차이는 근거에서 뺀 값들이다.</p>` : ""}
</section>

<section>
  <h2>5. 사진</h2>
  <div class="kv">
    <div><span>우리 호스팅(Cafe24)에 올린 사진</span><b>${n(X.photoHosted)}종</b></div>
    <div><span>외부 주소가 남은 술</span><b>${n(X.photoExternal)}종</b></div>
    <div><span>사진 없음(주종 엠블럼으로 대신)</span><b>${n(X.photoNone)}종</b></div>
    ${Object.entries(R.photo.liveBySource).map(([k, v]) => `<div><span>올린 사진 출처 · ${esc(photoSrcKo[k] || k)}</span><b>${n(v)}장</b></div>`).join("")}
    <div><span>눈 확인에서 거른 사진</span><b>${n(R.photo.status.rejected || 0)}장</b></div>
    <div><span>틀린 옛 주소를 걷은 술</span><b>${n(X.imageRejected)}종</b></div>
  </div>
  <p class="foot">사진은 이름의 그 상품인지 눈으로 확인한 것만 올렸다. 판매처·브랜드의 사진이므로 문서마다 출처(imageSource·imageOrigin)를 남겼다.</p>
</section>

<section>
  <h2>6. 영어·일본어 번역</h2>
  <div class="kv">
    <div><span>영어 번역이 있는 술</span><b>${n(X.enDocs)}종 · 칸 ${n(X.enFields)}</b></div>
    <div><span>일본어 번역이 있는 술</span><b>${n(X.jaDocs)}종 · 칸 ${n(X.jaFields)}</b></div>
    <div><span>이야기까지 번역된 술</span><b>영어 ${n(X.enStory)} · 일본어 ${n(X.jaStory)}</b></div>
    <div><span>조사로 고쳐져 옛 번역을 지운 술</span><b>${n(X.i18nStale)}종</b></div>
  </div>
  <p class="foot">이름·나라·제원 같은 정형 칸만 용어집으로 번역했다. 서술문(이야기·역사 등)은 2026-10-02 결정으로 한국어로 둔다.</p>
</section>

<section>
  <h2>7. 앱 사용 기록</h2>
  <p class="sub">사용자가 쌓는 데이터는 아직 시험 수준입니다. 사용자 구분(로그인)이 없어 앱 단위로 한 벌씩 저장됩니다.</p>
  <div class="kv">
    <div><span>스캔 기록</span><b>${n(R.userData.sessions || 0)}건</b></div>
    <div><span>셀러에 담긴 술</span><b>${n(R.userData.cellar || 0)}건 (${esc(Object.entries(R.cellarByStatus).map(([k, v]) => `${{ have: "보유", wish: "위시", drunk: "마심" }[k] || k} ${v}`).join(" · "))})</b></div>
    <div><span>취향 문답 답</span><b>${n(R.userData.preferences || 0)}건</b></div>
    <div><span>못 찾은 술 목록</span><b>${n(R.userData.wanted || 0)}건</b></div>
    <div><span>특가·음용 적기 알림 기록</span><b>${n((R.userData.deal_notices || 0) + (R.userData.drink_notices || 0))}건</b></div>
  </div>
</section>

<section>
  <h2>8. DB 전체</h2>
  ${table(["컬렉션", "내용", "문서 수"], colRows, [2])}
  <p class="foot">catalog 전체 ${n(R.totalAll)}건 중 ${n(R.excluded)}건은 술이 아닌 상품·중복이라 화면에서 뺀다(지우지 않고 표시만).</p>
</section>

<section>
  <h2>9. 조사 작업 기록</h2>
  <div class="kv">
    <div><span>기간</span><b>${esc(kst(W.from))} ~ ${esc(kst(W.to))}</b></div>
    <div><span>조사 묶음</span><b>${n(W.batches)} (실패 ${n(W.failed)})</b></div>
    <div><span>처리한 술(중복 포함)</span><b>${n(W.entries)}</b></div>
    <div><span>웹 검색</span><b>${n(W.searches)}회</b></div>
    <div><span>모델 · 추론 강도</span><b>${esc(Object.keys(W.models).join(", "))} · ${esc(Object.entries(W.effort).map(([k, v]) => `${k} ${v}`).join(", "))}</b></div>
    <div><span>비용(API 환산)</span><b>조사 $${n(W.cost)} · 사진 찾기 $${n(W.imageFind.cost)} · 사진 확인 $${n(W.imageCheck.cost)}</b></div>
  </div>
</section>

<section>
  <h2>10. 되돌릴 수 있게 남긴 것</h2>
  <div class="kv">
    <div><span>걷은 짐작 맛 수치</span><b>${n(X.stripped)}종 (원래 값 보관)</b></div>
    <div><span>걷은 틀린 사진 주소</span><b>${n(X.imageRejected)}종 (원래 주소 보관)</b></div>
    ${R.backups.map((b) => `<div><span>백업 <code>${esc(b.f)}</code></span><b>${n(b.kb)}KB</b></div>`).join("")}
  </div>
  <p class="foot">정정 내역(고친 값·이유·출처)은 술마다 catalog.verified 에, 조사 원본은 data/research/_work/out/ 에 남아 있다.</p>
</section>
</main>
<footer><div class="wrap">
  <p>만든 방법: scripts/_data-report.mjs 가 DB 를 읽기만 해서 세고, scripts/_data-report-html.mjs 가 이 문서를 만든다. 앱 기능과 공개 전 위험은 docs/기능서-현황.html 에 있다.</p>
  <p>생성 ${esc(kst(R.at))} KST</p>
</div></footer>
</body>
</html>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`저장: ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)}KB)`);
if (ART) {
  const body = html
    .replace(/<!doctype html>\s*/i, "").replace(/<html[^>]*>\s*/i, "").replace(/<\/html>\s*$/i, "")
    .replace(/<head>\s*/i, "").replace(/<\/head>\s*/i, "")
    .replace(/<meta charset="utf-8">\s*/i, "").replace(/<meta name="viewport"[^>]*>\s*/i, "").replace(/<meta name="description"[^>]*>\s*/i, "")
    .replace(/<body>\s*/i, "").replace(/<\/body>\s*/i, "");
  mkdirSync(dirname(ART), { recursive: true });
  writeFileSync(ART, body, "utf8");
  console.log(`공유용: ${ART}`);
}
