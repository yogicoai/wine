// 우리 술의 로마자 이름을 한글 상품명으로 — 손으로 적은 표를 적용한다.
//
// 데일리샷 영문명 대조(scripts/_tradition-names.mjs)로 34종을 되찾았지만,
// 대중 브랜드는 그쪽 영문명이 한글 그대로라 안 잡혔다 — 참이슬의 영문명이
// "참이슬 오리지널 360ml" 이다. 그래서 data/korean-names.json 에 손으로 적었다.
//
// 잘못 적어도 엉뚱한 값이 붙지는 않는다. 이름을 바꾼 뒤에도 lib/dailyshot.js 의
// 대조를 한 번 더 거치기 때문에, 틀린 이름은 그냥 아무것도 못 찾는다.
//
//   node --env-file=.env.local scripts/_korean-names.mjs          눈으로만
//   node --env-file=.env.local scripts/_korean-names.mjs --apply  실제로 적는다

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dailyshotFor } from "../lib/dailyshot.js";

const APPLY = process.argv.includes("--apply");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAP = JSON.parse(readFileSync(`${ROOT}/data/korean-names.json`, "utf-8"));

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col
  .find(
    { category: { $in: ["traditional", "makgeolli", "soju"] }, name: { $not: /[가-힣]/ } },
    { projection: { name: 1, category: 1 } }
  )
  .sort({ name: 1 })
  .toArray();

let mapped = 0;
let priced = 0;
const writes = [];
for (const d of docs) {
  const ko = MAP[d.name];
  if (!ko) continue;
  mapped++;
  // 바꾼 이름으로 값이 붙는지도 함께 본다 — 붙으면 표기가 맞다는 증거다
  const hit = await dailyshotFor(ko, { category: d.category });
  if (hit) priced++;
  console.log(
    `  ${hit ? "값" : "  "} ${d.name.slice(0, 34).padEnd(36)} → ${ko.padEnd(20)}` +
      (hit ? ` ${hit.name.slice(0, 26)}` : "")
  );
  writes.push({
    updateOne: {
      filter: { _id: d._id },
      update: { $set: { name: ko, nameEn: d.name, nameFixedAt: new Date() } },
    },
  });
}

console.log(`\n표에 있는 것 ${mapped}종 · 그중 값까지 붙는 것 ${priced}종`);
if (!APPLY) console.log("눈으로만 봤습니다. 실제로 적으려면 --apply");
else if (writes.length) {
  const r = await col.bulkWrite(writes, { ordered: false });
  console.log(`적었습니다 — ${r.modifiedCount}종`);
}
await client.close();
process.exit(0);
