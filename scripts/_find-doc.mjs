// 이름 조각으로 카탈로그 문서 찾기 (점검용)
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");
for (const q of process.argv.slice(2)) {
  const docs = await col.find({ name: { $regex: q } }, { projection: { name: 1, key: 1, tier: 1, "i18n.en.name": 1 } }).limit(6).toArray();
  console.log(`\n[${q}] ${docs.length}건`);
  for (const d of docs) console.log(`  ${d.name} · key=${d.key} · ${d.tier} · en=${d.i18n?.en?.name || "-"}`);
}
await client.close();
