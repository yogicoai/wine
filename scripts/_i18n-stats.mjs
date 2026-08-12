// 주종별 번역층 현황 — 어디까지 됐고 무엇이 남았는지
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

const rows = await col.aggregate([
  { $match: { tier: "full" } },
  { $group: {
      _id: "$category",
      n: { $sum: 1 },
      en: { $sum: { $cond: [{ $ifNull: ["$i18n.en", false] }, 1, 0] } },
      ja: { $sum: { $cond: [{ $ifNull: ["$i18n.ja", false] }, 1, 0] } },
  } },
  { $sort: { n: -1 } },
]).toArray();

let tn = 0, te = 0, tj = 0;
console.log("주종         정식    영어   일본어");
for (const r of rows) {
  tn += r.n; te += r.en; tj += r.ja;
  console.log(`${String(r._id).padEnd(12)}${String(r.n).padStart(4)}${String(r.en).padStart(7)}${String(r.ja).padStart(8)}`);
}
console.log(`${"합계".padEnd(11)}${String(tn).padStart(5)}${String(te).padStart(7)}${String(tj).padStart(8)}`);
await client.close();
