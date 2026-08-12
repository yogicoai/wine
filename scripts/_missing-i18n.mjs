// 번역층이 빠진 정식 항목 목록 (점검용)
// 사용: node scripts/_missing-i18n.mjs <lang> [category]
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const [lang = "ja", cat] = process.argv.slice(2);
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");
const q = { tier: "full", [`i18n.${lang}`]: { $exists: false } };
if (cat) q.category = cat;
const docs = await col.find(q, { projection: { name: 1, key: 1, category: 1 } }).toArray();
console.log(`${lang} 없는 정식 항목 ${docs.length}건${cat ? ` (${cat})` : ""}`);
for (const d of docs.slice(0, 40)) console.log(`  [${d.category}] ${d.name} · ${d.key}`);
if (docs.length > 40) console.log(`  … 외 ${docs.length - 40}건`);
await client.close();
