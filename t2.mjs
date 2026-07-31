import { MongoClient } from "mongodb";
import fs from "node:fs";
import { findLooseMatch, tokenize } from "./lib/match.js";
const uri = fs.readFileSync(".env.local", "utf8").match(/MONGODB_URI=(.*)/)[1].trim();
const c = new MongoClient(uri); await c.connect();
const rows = await c.db("winelens").collection("catalog")
  .find({}, { projection: { name: 1, category: 1 } }).toArray();
await c.close();

const cands = rows.map(r => ({ name: r.name, category: r.category, tokens: tokenize(r.name) }));

// 1) 자기 자신을 찾는가
let selfMiss = 0;
for (const r of cands) {
  const m = findLooseMatch(r.name, cands);
  if (!m) { if (selfMiss < 8) console.log("  자기 못 찾음:", r.name); selfMiss++; }
}
console.log(`자기 자신 못 찾는 항목: ${selfMiss} / ${cands.length}`);

// 2) 서로 다른 이름인데 같은 술로 붙는 쌍 (사케·위스키 위주로 확인)
const seen = new Set(); let pairs = 0;
for (const r of cands) {
  const others = cands.filter(x => x.name !== r.name);
  const m = findLooseMatch(r.name, others);
  if (!m) continue;
  const k = [r.name, m.candidate.name].sort().join("||");
  if (seen.has(k)) continue;
  seen.add(k); pairs++;
  if (pairs <= 30) console.log(`  붙음: ${r.name}  ==  ${m.candidate.name}   [${r.category}/${m.candidate.category}]`);
}
console.log(`서로 다른 이름끼리 붙는 쌍: ${pairs}`);
