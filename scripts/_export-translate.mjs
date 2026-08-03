// 번역 대상 내보내기 — 카테고리의 정식 항목에서 글 필드만 뽑아 배치 파일로.
// 사용: node export-translate.mjs <category> <배치크기> <출력폴더> [lang]
//   lang 이 이미 있는 항목은 건너뛴다 (재실행 안전)
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const [cat, sizeArg, outDir, lang] = process.argv.slice(2);
const size = Number(sizeArg || 8);
mkdirSync(outDir, { recursive: true });

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const filter = { category: cat, tier: "full" };
if (lang) filter[`i18n.${lang}`] = { $exists: false };

const docs = await col.find(filter, {
  projection: {
    key: 1, name: 1,
    "result.type": 1, "result.region": 1, "result.country": 1, "result.basis": 1,
    "result.tastingNotes": 1, "result.story": 1, "result.winery": 1,
    "result.pairingTip": 1, "result.avoidPairing": 1, "result.trivia": 1,
    "result.servingTemp": 1, "result.servingNote": 1, "result.aging": 1,
    "result.tips": 1, "result.specs": 1, "result.history": 1, "result.foodPairing": 1,
  },
}).sort({ name: 1 }).toArray();

const items = docs.map((d) => ({ key: d.key, name: d.name, ...d.result }));
let n = 0;
for (let i = 0; i < items.length; i += size) {
  n++;
  writeFileSync(`${outDir}/batch-${String(n).padStart(2, "0")}.json`,
    JSON.stringify(items.slice(i, i + size), null, 1), "utf-8");
}
console.log(`${items.length}종 → ${n}개 배치 (${outDir})`);
await client.close();
