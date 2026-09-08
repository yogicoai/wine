// 색인에 담아 둔 값이 지금도 맞는지 표본으로 잰다 — 13일 묵은 값의 실제 오차.
import { MongoClient } from "mongodb";
import { livePrice } from "../lib/dailyshot.js";

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("dailyshot");
const rows = await col
  .aggregate([
    { $match: { itemId: { $exists: true }, price: { $gt: 10000 }, category: "위스키" } },
    { $sample: { size: 30 } },
    { $project: { _id: 0, name: 1, itemId: 1, price: 1 } },
  ])
  .toArray();

let gone = 0, moved = 0, same = 0;
const diffs = [];
for (const r of rows) {
  const live = await livePrice(r.itemId);
  await new Promise((s) => setTimeout(s, 200));
  if (!live) { gone++; console.log(`✗ ${r.name.slice(0, 34).padEnd(36)} 지금은 파는 곳 없음 (색인 ${r.price.toLocaleString()}원)`); continue; }
  const d = live.low - r.price;
  const pct = Math.round((d / r.price) * 100);
  if (Math.abs(pct) >= 3) {
    moved++;
    diffs.push(pct);
    console.log(`△ ${r.name.slice(0, 34).padEnd(36)} ${r.price.toLocaleString()} → ${live.low.toLocaleString()}원  ${pct > 0 ? "+" : ""}${pct}%`);
  } else same++;
}
console.log("");
console.log(`표본 ${rows.length}종 — 그대로 ${same} · 값 바뀜 ${moved} · 사라짐 ${gone}`);
if (diffs.length) {
  const avg = Math.round(diffs.reduce((a, b) => a + Math.abs(b), 0) / diffs.length);
  console.log(`바뀐 것의 평균 차이 ${avg}%`);
}
await c.close();
process.exit(0);
