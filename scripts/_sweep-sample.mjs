// 앱별 실시간 가격 붙는 비율을 표본으로 잰다.
//   node --env-file=.env.local scripts/_sweep-sample.mjs wine 150
import { MongoClient } from "mongodb";
import { dailyshotFor, searchAndMatch } from "../lib/dailyshot.js";

const cat = process.argv[2];
const size = Number(process.argv[3] || 120);
const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const rows = await col
  .aggregate([
    { $match: { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat } },
    { $sample: { size } },
    { $project: { name: 1 } },
  ])
  .toArray();

let live = 0;
for (const r of rows) {
  let m = null;
  try { m = await dailyshotFor(r.name, { category: cat }); } catch {}
  if (!m) {
    try { m = await searchAndMatch(r.name, { category: cat }); } catch {}
    await new Promise((s) => setTimeout(s, 200));
  }
  if (m?.low || m?.price) live++;
}
console.log(`${cat.padEnd(12)} 표본 ${String(rows.length).padStart(4)}종 중 ${String(live).padStart(4)}종 — ${Math.round((live / rows.length) * 100)}%`);
await c.close();
process.exit(0);
