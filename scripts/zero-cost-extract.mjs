// 비용 없이 DB 안에서 더 뽑기 — 모델 호출 없음.
//
//   node --env-file=.env.local scripts/zero-cost-extract.mjs            보기만
//   node --env-file=.env.local scripts/zero-cost-extract.mjs --apply    적기 (먼저 data/backup/zero-cost-2026-10-02.json 에 원래 값을 남긴다)
//
// ① Vivino 평점 → result.ratings (결과 화면 '출처별 평점' 카드)
//    판매처(데일리샷) 짝의 vivino 점수·평가 수·기준일을 옮긴다. 이름이 꽉 맞는 짝만(부피·연도·도수·일반 낱말을 걷은 이름이 같음).
//    이미 Vivino 가 제원이나 평점에 있으면 건너뛴다. 평가 수가 적으면(30건 미만) 믿기 어려워 넣지 않는다.
// ② 조사 시세(priceInfo)로 가격대 맞추기 — 판매처 가격 근거(priceBandBasis)가 없는 술만.
//    우리가 조사해 둔 국내 시장가 범위의 가운데 값으로 가격대를 매긴다. 신뢰도 60 미만이면 쓰지 않는다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const BACKUP = "data/backup/zero-cost-2026-10-02.json";
const GEN = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리)/g;
const core = (s) => String(s || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ").replace(/\b(19|20)\d{2}\b/g, " ").replace(GEN, " ").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const bandOf = (p) => (p <= 20000 ? 1 : p <= 50000 ? 2 : p <= 100000 ? 3 : p <= 300000 ? 4 : 5);
const LABEL = { 1: "2만원 이하", 2: "2~5만원", 3: "5~10만원", 4: "10~30만원", 5: "30만원 이상" };

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const base = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };
const now = new Date();
const ops = [], backup = [];

// ① Vivino
const vdocs = await col.find({ ...base, "sourceFacts.dailyshot.vivino.score": { $exists: true } }, { projection: { name: 1, category: 1, "result.specs": 1, "result.ratings": 1, "sourceFacts.dailyshot.name": 1, "sourceFacts.dailyshot.vivino": 1 } }).toArray();
const vs = { cand: vdocs.length, loose: 0, few: 0, already: 0, add: 0 }, vEx = [];
for (const d of vdocs) {
  const ds = d.sourceFacts.dailyshot, v = ds.vivino || {};
  if (!(core(d.name) && core(d.name) === core(ds.name))) { vs.loose++; continue; }
  const cnt = Number(v.review_count || 0), score = Number(v.score);
  if (!(score > 0 && score <= 5) || cnt < 30) { vs.few++; continue; }
  const specs = d.result?.specs || [], ratings = Array.isArray(d.result?.ratings) ? d.result.ratings : [];
  if (specs.some((s) => /vivino|비비노/i.test(s.label || "")) || ratings.some((r) => /vivino|비비노/i.test(r.source || ""))) { vs.already++; continue; }
  const when = v.score_date ? ` · ${String(v.score_date).slice(0, 7)} 기준` : "";
  const entry = { source: "Vivino", score: `${score.toFixed(1)} / 5 (평가 ${cnt.toLocaleString("ko-KR")}건${when})` };
  vs.add++;
  if (vEx.length < 6) vEx.push(`${d.name}: ${entry.score}`);
  backup.push({ _id: d._id, name: d.name, kind: "ratings", ratings: d.result?.ratings ?? null });
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { "result.ratings": [...ratings, entry], ratingsFill: { at: now, source: "dailyshot-vivino" } } } } });
}

// ② 조사 시세 → 가격대 — 기본은 하지 않는다(--with-priceinfo 일 때만). 10-02 점검에서 조사 시세 자체가 틀린 예가 있었다(메이커스 마크 시세 6~8만 vs 판매처 31,900원)
const WITH_PI = process.argv.includes("--with-priceinfo");
const pdocs = !WITH_PI ? [] : await col.find({ ...base, "priceInfo.krwLow": { $gt: 0 }, priceBandBasis: { $exists: false } }, { projection: { name: 1, category: 1, priceBand: 1, "result.priceBand": 1, priceInfo: 1 } }).toArray();
const ps = { cand: pdocs.length, lowConf: 0, same: 0, d1: 0, d2: 0 }, pEx = [];
for (const d of pdocs) {
  const pi = d.priceInfo;
  if (pi.confidence != null && Number(pi.confidence) < 60) { ps.lowConf++; continue; }
  const lo = Number(pi.krwLow), hi = Number(pi.krwHigh || pi.krwLow);
  const mid = (lo + hi) / 2, nb = bandOf(mid), was = Number(d.priceBand);
  const diff = Number.isFinite(was) ? Math.abs(was - nb) : 9;
  const basis = { by: "priceInfo", low: lo, high: hi, asOf: pi.asOf || null, confidence: pi.confidence ?? null, at: now, ...(diff ? { was: Number.isFinite(was) ? was : null } : {}) };
  const set = { priceBandBasis: basis };
  if (diff) {
    set.priceBand = nb;
    if (d.result && d.result.priceBand != null) set["result.priceBand"] = nb;
    backup.push({ _id: d._id, name: d.name, kind: "priceBand", priceBand: d.priceBand ?? null, resultPriceBand: d.result?.priceBand ?? null });
    if (diff >= 2) ps.d2++; else ps.d1++;
    if (pEx.length < 8) pEx.push(`${d.name} (${d.category}) ${LABEL[was] || "없음"} → ${LABEL[nb]} · 시세 ${lo.toLocaleString()}~${hi.toLocaleString()}원${pi.volume ? " " + pi.volume : ""}`);
  } else ps.same++;
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: set } } });
}

console.log(`① Vivino 평점: 후보 ${vs.cand} → 넣을 것 ${vs.add} (이름 짝 느슨 ${vs.loose} · 평가 30건 미만 ${vs.few} · 이미 있음 ${vs.already})`);
console.log("   예: " + vEx.join(" | "));
console.log(`② 조사 시세로 가격대: 후보 ${ps.cand} → 그대로 ${ps.same} · 한 구간 바뀜 ${ps.d1} · 두 구간 이상 ${ps.d2} (신뢰도 60 미만 ${ps.lowConf})`);
console.log("   예:\n   " + pEx.join("\n   "));
if (!APPLY) { console.log("\n보기만 했습니다. 적으려면 --apply"); await client.close(); process.exit(0); }
mkdirSync("data/backup", { recursive: true });
if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있습니다 — 두 번 적지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, docs: backup }, null, 1), "utf8");
const r = await col.bulkWrite(ops, { ordered: false });
console.log(`\n적었습니다 — ${r.modifiedCount}종 (백업 ${BACKUP})`);
await client.close();
process.exit(0);
