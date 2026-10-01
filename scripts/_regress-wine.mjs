// 규칙을 바꾼 뒤 예전에 붙던 와인이 그대로 붙는지 표본으로 본다.
//   node --env-file=.env.local scripts/_regress-wine.mjs 400
import { readFileSync } from "node:fs";
import { dailyshotFor, searchAndMatch } from "../lib/dailyshot.js";

const N = Number(process.argv[2] || 400);
const pairs = JSON.parse(readFileSync("scripts/_pairs-wine.json", "utf8"));
// 무작위 N 쌍 (섞어서 앞에서 N)
const pick = pairs.map((p) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).slice(0, N).map((x) => x[1]);

let same = 0, lost = 0, changed = 0;
const lostList = [], changedList = [];
for (const p of pick) {
  let m = null;
  try { m = await dailyshotFor(p.ours, { category: "wine" }); } catch {}
  if (!m) { try { m = await searchAndMatch(p.ours, { category: "wine" }); } catch {} await new Promise((s) => setTimeout(s, 150)); }
  const got = m?.name || "";
  if (!(m?.low || m?.price)) { lost++; lostList.push(p); }
  else if (got === p.theirs) same++;
  else { changed++; changedList.push({ ours: p.ours, before: p.theirs, after: got }); }
}
console.log(`와인 ${pick.length}쌍 — 그대로 ${same} · 이제 안 붙음 ${lost} · 다른 상품으로 바뀜 ${changed}`);
lostList.slice(0, 15).forEach((p) => console.log(`  ✗ ${p.ours}   (예전: ${p.theirs})`));
changedList.slice(0, 15).forEach((p) => console.log(`  ↔ ${p.ours}\n       ${p.before}  →  ${p.after}`));
process.exit(0);
