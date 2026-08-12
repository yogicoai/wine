// 가격대가 빠진 항목 채우기 — DB 와 curation.json 양쪽에.
// 사용: node scripts/_fix-bands.mjs "이름=대역" "이름=대역" …
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const CURATION = "c:/Users/WeMA1/Desktop/wine-main/data/curation.json";

const pairs = process.argv.slice(2).map((s) => {
  const i = s.lastIndexOf("=");
  return { name: s.slice(0, i), band: Number(s.slice(i + 1)) };
});

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const curation = JSON.parse(readFileSync(CURATION, "utf-8"));
const byName = new Map(curation.map((c) => [c.name, c]));

for (const { name, band } of pairs) {
  const doc = await col.findOne({ name }, { projection: { _id: 1, name: 1 } });
  if (!doc) { console.log(`⚠ 없음: ${name}`); continue; }
  await col.updateOne({ _id: doc._id }, { $set: { priceBand: band, "result.priceBand": band } });
  const cur = byName.get(name);
  if (cur) cur.priceBand = band;
  else { const add = { name, priceBand: band }; curation.push(add); byName.set(name, add); }
  console.log(`✓ ${name} → 대역 ${band}`);
}

writeFileSync(CURATION, JSON.stringify(curation, null, 1), "utf-8");
console.log(`curation.json 갱신 (총 ${curation.length}건)`);
await client.close();
