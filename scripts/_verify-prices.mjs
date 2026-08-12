// 시세 검수 — 붙인 값이 말이 되는지 본다.
//
// 조사는 기계가 했다. 기계가 지어낸 값을 그대로 쓰면 앱의 신뢰가 무너지므로,
// 사람이 볼 만한 형태로 추려 낸다. 여기서 걸리는 것은 다시 조사한다.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const cat = process.argv[2];

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const q = { tier: "full", priceInfo: { $exists: true } };
if (cat && cat !== "all") q.category = cat;
const docs = await col.find(q, {
  projection: { name: 1, category: 1, priceBand: 1, priceInfo: 1 },
}).toArray();

console.log(`시세 보유 ${docs.length}건${cat ? ` (${cat})` : ""}\n`);
if (!docs.length) { await client.close(); process.exit(0); }

const bandOf = (lo, hi) => {
  const mid = lo && hi ? (lo + hi) / 2 : lo || hi;
  if (!mid) return null;
  if (mid < 20_000) return 1;
  if (mid < 50_000) return 2;
  if (mid < 100_000) return 3;
  if (mid < 300_000) return 4;
  return 5;
};

const issues = { 값없음: [], 범위과다: [], 용량없음: [], 근거없음: [], 낮은신뢰: [], 대역불일치: [] };
let confSum = 0, withUsd = 0;

for (const d of docs) {
  const p = d.priceInfo || {};
  const lo = Number(p.krwLow) || 0;
  const hi = Number(p.krwHigh) || 0;
  confSum += Number(p.confidence) || 0;
  if (p.usdLow || p.usdHigh) withUsd++;

  if (!lo && !hi) issues.값없음.push(d.name);
  else if (lo && hi && hi / lo > 3) issues.범위과다.push(`${d.name} (${lo.toLocaleString()}~${hi.toLocaleString()})`);
  if (!p.volume) issues.용량없음.push(d.name);
  if (!p.basis) issues.근거없음.push(d.name);
  if ((Number(p.confidence) || 0) < 60) issues.낮은신뢰.push(`${d.name} (${p.confidence})`);

  const calc = bandOf(lo, hi);
  if (calc && d.priceBand && Math.abs(calc - d.priceBand) >= 2) {
    issues.대역불일치.push(`${d.name}: 대역 ${d.priceBand} vs 시세 ${calc} (${lo.toLocaleString()}~${hi.toLocaleString()})`);
  }
}

console.log(`평균 신뢰도 ${(confSum / docs.length).toFixed(1)} · 해외가 보유 ${withUsd}\n`);
for (const [k, v] of Object.entries(issues)) {
  console.log(`${k}: ${v.length}건`);
  for (const x of v.slice(0, 12)) console.log(`  · ${x}`);
  if (v.length > 12) console.log(`  … 외 ${v.length - 12}건`);
}

// 값이 제대로 붙었는지 눈으로 볼 수 있게 몇 개 보여 준다
console.log("\n표본:");
for (const d of docs.slice(0, 8)) {
  const p = d.priceInfo;
  console.log(`  ${d.name}: ${(p.krwLow || 0).toLocaleString()}~${(p.krwHigh || 0).toLocaleString()}원 · ${p.volume || "?"} · ${p.basis || "?"} · 신뢰 ${p.confidence}`);
}
await client.close();
