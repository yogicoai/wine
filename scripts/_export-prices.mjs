// 시세 조사 대상 내보내기 — 아직 priceInfo 가 없는 정식 항목을 배치 파일로.
// 사용: node scripts/_export-prices.mjs <category|all> <배치크기> <출력폴더>
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const [cat, sizeArg, outDir] = process.argv.slice(2);
const size = Number(sizeArg || 10);
mkdirSync(outDir, { recursive: true });

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const filter = { tier: "full", priceInfo: { $exists: false } };
if (cat && cat !== "all") filter.category = cat;

const docs = await col.find(filter, {
  projection: {
    key: 1, name: 1, category: 1, producer: 1, vintage: 1, priceBand: 1,
    "result.type": 1, "result.region": 1, "result.country": 1, "result.alcohol": 1,
  },
}).sort({ category: 1, name: 1 }).toArray();

// 조사에 필요한 최소한만 넘긴다 — 본문을 통째로 주면 토큰만 먹는다
const items = docs.map((d) => ({
  key: d.key,
  name: d.name,
  category: d.category,
  producer: d.producer || null,
  vintage: d.vintage || null,
  type: d.result?.type || null,
  region: d.result?.region || null,
  country: d.result?.country || null,
  alcohol: d.result?.alcohol || null,
  ourBand: d.priceBand || null,
}));

let n = 0;
for (let i = 0; i < items.length; i += size) {
  n++;
  writeFileSync(`${outDir}/batch-${String(n).padStart(2, "0")}.json`,
    JSON.stringify(items.slice(i, i + size), null, 1), "utf-8");
}
console.log(`${items.length}종 → ${n}개 배치 (${outDir})`);
await client.close();
