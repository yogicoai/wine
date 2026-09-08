// 값이 안 붙는 술마다 데일리샷 검색 후보를 모아 둔다.
// 판단(같은 술인가)은 사람이나 검토 에이전트가 하고, 여기서는 재료만 모은다.
//
//   node --env-file=.env.local scripts/_gather-cand.mjs wine
//   → scripts/cand/_cand-wine.json
import { MongoClient } from "mongodb";
import { writeFileSync, mkdirSync } from "node:fs";
import { dailyshotFor, searchAndMatch, searchName } from "../lib/dailyshot.js";

const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const cat = process.argv[2];
if (!cat) throw new Error("주종을 적어 주세요");

// 세트·바이알은 낱병 값이 없다. 후보를 모아도 쓸 데가 없으므로 여기서 뺀다.
const SKIP = /[&+]|\d+종\s|바이알|슈터|미니어처|세트|패키지|기획/;

// 상표만 남기면 그쪽 표기가 드러난다. 너무 길게 물으면 검색이 아무것도 못 준다.
function shorten(name) {
  const t = searchName(name, cat).split(/\s+/).filter(Boolean);
  return t.slice(0, Math.min(3, t.length)).join(" ");
}

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const rows = await col
  .find(
    { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat },
    { projection: { name: 1, priceBand: 1, producer: 1, vintage: 1 } }
  )
  .sort({ name: 1 })
  .toArray();

const out = [];
let hit = 0, skipped = 0;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  let m = null;
  try { m = await dailyshotFor(r.name, { category: cat }); } catch {}
  if (!m) {
    try { m = await searchAndMatch(r.name, { category: cat }); } catch {}
    await new Promise((s) => setTimeout(s, 180));
  }
  if (m?.low || m?.price) { hit++; continue; }
  if (SKIP.test(r.name)) { skipped++; continue; }

  const q = shorten(r.name);
  let cands = [];
  try {
    const res = await fetch(`${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=8`, { headers: HEAD });
    cands = ((await res.json())?.results || [])
      .filter((x) => x?.top_product_id && Number(x.price) > 0)
      .slice(0, 6)
      .map((x) => ({ name: x.name, won: Number(x.price), vol: x.volume || null }));
  } catch {}
  await new Promise((s) => setTimeout(s, 180));

  out.push({
    ours: r.name,
    producer: r.producer || null,
    band: r.priceBand || null,
    asked: q,
    cands,
  });

  if ((i + 1) % 200 === 0) console.log(`  … ${i + 1}/${rows.length}`);
}

mkdirSync("scripts/cand", { recursive: true });
writeFileSync(`scripts/cand/_cand-${cat}.json`, JSON.stringify(out, null, 1), "utf8");
console.log(`${cat} — 붙음 ${hit} · 세트/바이알 건너뜀 ${skipped} · 후보 모음 ${out.length}건 → scripts/cand/_cand-${cat}.json`);
await c.close();
process.exit(0);
