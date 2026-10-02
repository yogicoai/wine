// 조사로 고친 내용 통계 — 기존 정보의 어떤 항목이 얼마나 틀렸는가 (최종 보고용, 모델 호출 없음)
//   node --env-file=.env.local scripts/_report-corrections.mjs [--cat sake]
import { MongoClient } from "mongodb";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CAT = arg("--cat");
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const q = { "verified.by": "web-research", notDrink: { $ne: true } };
if (CAT) q.category = CAT;
const docs = await col.find(q, { projection: { name: 1, category: 1, verified: 1 } }).toArray();

// 필드 이름을 큰 묶음으로 — "specs[정미율]" → specs, "alcohol / specs.도수" → alcohol
const bucket = (f) => {
  const s = String(f || "").toLowerCase();
  if (/alcohol|도수/.test(s)) return "도수";
  if (/country|국가/.test(s)) return "국가";
  if (/region|산지|지역/.test(s)) return "지역·산지";
  if (/producer|생산자|양조장|winery/.test(s)) return "생산자";
  if (/vintage|빈티지|연도|year/.test(s)) return "빈티지·연도";
  if (/story/.test(s)) return "이야기(story)";
  if (/tasting|맛|향/.test(s)) return "맛·향";
  if (/history/.test(s)) return "연혁";
  if (/spec/.test(s)) return "상세(specs)";
  if (/pair|food|안주/.test(s)) return "안주";
  if (/type|종류|등급/.test(s)) return "종류·등급";
  if (/trivia/.test(s)) return "트리비아";
  return "기타";
};
const byB = {}, byCat = {}, ex = {};
let withCorr = 0, totalCorr = 0, totalRem = 0, level = { A: 0, B: 0, C: 0 }, status = {};
for (const d of docs) {
  const v = d.verified || {};
  const c = v.corrections || [];
  level[v.level] = (level[v.level] || 0) + 1; status[v.status] = (status[v.status] || 0) + 1;
  if (c.length) withCorr++;
  totalCorr += c.length; totalRem += (v.removed || []).length;
  const seen = new Set();
  for (const x of c) {
    const b = bucket(x.field); byB[b] = (byB[b] || 0) + 1;
    (byCat[d.category] ||= { n: 0, c: 0, r: 0, withC: 0 }).c++;
    if (!seen.has(b)) { seen.add(b); (ex[b] ||= []).push({ name: d.name, field: x.field, was: String(x.was).slice(0, 50), now: String(x.now).slice(0, 50), why: String(x.why).slice(0, 110) }); }
  }
  (byCat[d.category] ||= { n: 0, c: 0, r: 0, withC: 0 }); byCat[d.category].n++; byCat[d.category].r += (v.removed || []).length; if (c.length) byCat[d.category].withC++;
}
console.log(`조사된 ${docs.length}종 · 등급 A ${level.A || 0} B ${level.B || 0} C ${level.C || 0} · 상태 ${Object.entries(status).map(([k, v]) => `${k} ${v}`).join(" ")}`);
console.log(`기존 정보를 고친 항목 ${withCorr}종 (${Math.round((withCorr / docs.length) * 100)}%) · 고친 값 ${totalCorr}건(항목당 ${(totalCorr / docs.length).toFixed(1)}) · 근거 없어 뺀 주장 ${totalRem}건(항목당 ${(totalRem / docs.length).toFixed(1)})`);
console.log("\n── 고친 필드 종류 ──");
for (const [k, v] of Object.entries(byB).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(10)} ${String(v).padStart(5)}건`);
console.log("\n── 주종별 ──");
for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(11)} ${String(v.n).padStart(4)}종 · 고침이 있는 항목 ${v.withC} (${Math.round((v.withC / v.n) * 100)}%) · 고친 값 ${v.c} · 뺀 주장 ${v.r}`);
console.log("\n── 눈에 띄는 정정 예 (도수·국가·생산자·빈티지) ──");
for (const b of ["도수", "국가", "생산자", "빈티지·연도"]) for (const x of (ex[b] || []).slice(0, 4)) console.log(`  [${b}] ${x.name.slice(0, 26)}: ${x.was} → ${x.now}   (${x.why})`);
await client.close();
process.exit(0);
