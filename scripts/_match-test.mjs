// 실시간 가격이 실제로 몇 %나 붙는지 표본으로 재 본다.
//   node --env-file=.env.local scripts/_match-test.mjs whisky 40
import { MongoClient } from "mongodb";
import { searchAndMatch } from "../lib/dailyshot.js";

const cat = process.argv[2] || "whisky";
const size = Number(process.argv[3] || 40);

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const F = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat };
const rows = await col
  .aggregate([{ $match: F }, { $sample: { size } }, { $project: { name: 1 } }])
  .toArray();

let hit = 0, live = 0;
for (const r of rows) {
  let m = null;
  try {
    m = await searchAndMatch(r.name, { category: cat });
  } catch {}
  const low = m?.low || m?.price || 0;
  if (m) hit++;
  if (low > 0) live++;
  const mark = low > 0 ? "○" : m ? "△" : "✗";
  const tail = low
    ? `${low.toLocaleString()}원${m.sellers ? ` · ${m.sellers}곳` : ""}`
    : m
    ? "매칭만 (가격 없음)"
    : "못 찾음";
  console.log(`${mark} ${r.name.slice(0, 32).padEnd(34)} ${tail}`);
}

console.log("");
console.log(
  `표본 ${rows.length}종 — 상품 매칭 ${hit}종(${Math.round(
    (hit / rows.length) * 100
  )}%) · 실시간 가격 ${live}종(${Math.round((live / rows.length) * 100)}%)`
);
await c.close();
process.exit(0);
