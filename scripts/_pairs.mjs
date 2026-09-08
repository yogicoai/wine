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
for (const r of rows) {
  let m = null;
  try { m = await dailyshotFor(r.name, { category: cat }); } catch {}
  if (!m) {
    try { m = await searchAndMatch(r.name, { category: cat }); } catch {}
    await new Promise((s) => setTimeout(s, 200));
  }
  const low = m?.low || m?.price || 0;
  if (!low) continue;
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
console.log(`${pairs.length}쌍 → scripts/_pairs-${cat}.json`);
await c.close();
process.exit(0);
