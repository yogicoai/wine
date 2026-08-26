// 고친 이름 다듬기가 실제로 붙는지 이름 몇 개로 확인한다.
import { dailyshotFor, searchAndMatch, searchName } from "../lib/dailyshot.js";

const names = process.argv.slice(2);
for (const n of names) {
  const q = searchName(n, "whisky");
  let m = null, how = "";
  try { m = await dailyshotFor(n, { category: "whisky" }); if (m) how = "색인"; } catch (e) { console.log("  터짐:", e.message); }
  if (!m) { try { m = await searchAndMatch(n, { category: "whisky" }); if (m) how = "검색"; } catch (e) { console.log("  터짐:", e.message); } }
  const low = m?.low || m?.price || 0;
  const arrow = q === n ? "" : `  →  ${q}`;
  console.log(`${low ? "○" : "✗"} ${n}${arrow}`);
  console.log(`    ${low ? low.toLocaleString() + "원 · " + how + " · " + m.name : "못 붙음"}`);
}
process.exit(0);
