import { MongoClient } from "mongodb";
import { dailyshotFor } from "../wine/lib/dailyshot.js";

const HEAD = { "user-agent": "ClaudeBot", "dailyshot-web": "1", "encrypted-web": "1", accept: "application/json" };
const cat = process.argv[2] || "wine";
const N = Number(process.argv[3] || 25);

const c = new MongoClient(process.env.MONGODB_URI); await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col.find({ category: cat }, { projection: { name: 1, category: 1 } }).sort({ hits: -1, name: 1 }).toArray();
const misses = [];
for (const d of docs) {
  if (misses.length >= N) break;
  if (!(await dailyshotFor(d.name, { category: d.category }))) misses.push(d.name);
}

console.log(`못 찾은 것 ${N}개를 데일리샷 검색에 직접 물어본다\n`);
let there = 0, absent = 0;
for (const name of misses) {
  try {
    const r = await fetch(`https://api.dailyshot.co/items/search/?q=${encodeURIComponent(name)}&page=1&page_size=3`, { headers: HEAD, signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    const top = j.results?.[0];
    if (j.count > 0) { there++; console.log(`  있음  ${name.slice(0,26).padEnd(28)} → ${String(top?.name).slice(0,32).padEnd(34)} (${j.count}건)`); }
    else { absent++; console.log(`  없음  ${name.slice(0,26)}`); }
  } catch { console.log(`  ERR  ${name}`); }
  await new Promise(z => setTimeout(z, 400));
}
console.log(`\n검색에 있음 ${there} · 없음 ${absent}`);
await c.close(); process.exit(0);
