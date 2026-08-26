// 앱과 같은 순서로 전량을 재 본다 — 색인 먼저, 없으면 검색.
//   node --env-file=.env.local scripts/_match-sweep.mjs whisky
// 못 찾은 것은 scripts/_miss-<앱>.txt 로 남긴다.
import { MongoClient } from "mongodb";
import { writeFileSync } from "node:fs";
import { dailyshotFor, searchAndMatch } from "../lib/dailyshot.js";

const cat = process.argv[2] || "whisky";
const GAP = 250;

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const rows = await col
  .find(
    { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat },
    { projection: { name: 1, priceBand: 1 } }
  )
  .sort({ name: 1 })
  .toArray();

const miss = [];
let byIndex = 0, bySearch = 0, live = 0;

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  let m = null, how = "";
  try {
    m = await dailyshotFor(r.name, { category: cat });
    if (m) how = "색인";
  } catch {}
  if (!m) {
    try {
      m = await searchAndMatch(r.name, { category: cat });
      if (m) how = "검색";
    } catch {}
    await new Promise((s) => setTimeout(s, GAP));
  }
  const low = m?.low || m?.price || 0;
  if (how === "색인") byIndex++;
  if (how === "검색") bySearch++;
  if (low > 0) live++;
  else miss.push(r.name);

  if ((i + 1) % 50 === 0)
    console.log(`  … ${i + 1}/${rows.length} — 붙음 ${live}종`);
}

writeFileSync(`scripts/_miss-${cat}.txt`, miss.join("\n") + "\n", "utf8");
console.log("");
console.log(`${cat} ${rows.length}종`);
console.log(`  색인에서 바로   ${byIndex}종`);
console.log(`  검색으로 찾음   ${bySearch}종`);
console.log(`  실시간 가격     ${live}종  (${Math.round((live / rows.length) * 100)}%)`);
console.log(`  못 붙음         ${miss.length}종  → scripts/_miss-${cat}.txt`);
await c.close();
process.exit(0);
