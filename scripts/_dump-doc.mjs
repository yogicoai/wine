// 문서 하나의 result 를 그대로 찍는다 (번역·점검용)
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
const doc = await col.findOne({ key: process.argv[2] });
if (!doc) console.log("없음");
else console.log(JSON.stringify(doc.result, null, 1));
await client.close();
