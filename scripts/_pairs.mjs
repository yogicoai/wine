// 우리 이름 ↔ 실제로 붙은 데일리샷 상품을 나란히 뽑는다.
// 사람이나 검토 에이전트가 "같은 술이 맞나"를 판단할 재료다.
import { MongoClient } from "mongodb";
import { writeFileSync } from "node:fs";
import { dailyshotFor, searchAndMatch, searchName } from "../lib/dailyshot.js";

const cat = process.argv[2] || "whisky";
const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const rows = await col
  .find(
    { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat },
    { projection: { name: 1 } }
  )
  .sort({ name: 1 })
  .toArray();

const pairs = [];
const miss = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  let m = null;
  try { m = await dailyshotFor(r.name, { category: cat }); } catch {}
  if (!m) {
    try { m = await searchAndMatch(r.name, { category: cat }); } catch {}
    await new Promise((s) => setTimeout(s, 200));
  }
  const low = m?.low || m?.price || 0;
  if ((i + 1) % 300 === 0) console.log(`  … ${i + 1}/${rows.length} — 붙음 ${pairs.length}종`);
  if (!low) { miss.push(r.name); continue; }
  pairs.push({
    ours: r.name,
    q: searchName(r.name, cat),
    theirs: m.name,
    won: low,
    vol: m.volume || null,
    url: m.url,
  });
}

writeFileSync(`scripts/_pairs-${cat}.json`, JSON.stringify(pairs, null, 1), "utf8");
writeFileSync(`scripts/_miss-${cat}.txt`, miss.join("\n") + "\n", "utf8");
console.log(
  `${cat} ${rows.length}종 — 붙음 ${pairs.length}종 (${Math.round((pairs.length / rows.length) * 100)}%) · 못 붙음 ${miss.length}종`
);
console.log(`  쌍 → scripts/_pairs-${cat}.json · 못 붙은 것 → scripts/_miss-${cat}.txt`);
await c.close();
process.exit(0);
