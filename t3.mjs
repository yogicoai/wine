import { MongoClient } from "mongodb";
import fs from "node:fs";
import { findLooseMatch, tokenize } from "./lib/match.js";
const uri = fs.readFileSync(".env.local", "utf8").match(/MONGODB_URI=(.*)/)[1].trim();
const c = new MongoClient(uri); await c.connect();
const rows = await c.db("winelens").collection("catalog").find({}, { projection: { name: 1 } }).toArray();
await c.close();
const cands = rows.map(r => ({ name: r.name, tokens: tokenize(r.name) }));

// 한 술이 남의 이름과 몇 개나 붙는가 — 전부 센다
let total = 0; const worst = [];
for (const r of cands) {
  let n = 0;
  for (const o of cands) {
    if (o.name === r.name) continue;
    if (findLooseMatch(r.name, [o])) n++;
  }
  total += n;
  if (n >= 3) worst.push([n, r.name]);
}
console.log("서로 다른 이름이 같은 술로 붙는 총 횟수:", total);
worst.sort((a, b) => b[0] - a[0]);
console.log("가장 많이 붙는 이름:");
worst.slice(0, 12).forEach(([n, name]) => console.log(`  ${n}건  ${name}`));
