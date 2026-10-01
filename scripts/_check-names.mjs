// 이름 몇 개가 실제로 붙는지 본다.
//   node --env-file=.env.local scripts/_check-names.mjs [--cat=wine] "이름1" "이름2" ...
// 주종을 안 주면 위스키다. 위스키가 아닌 이름은 반드시 --cat 을 줘야 의미가 있다.
import { dailyshotFor, searchAndMatch, searchName } from "../lib/dailyshot.js";

const args = process.argv.slice(2);
const catArg = args.find((a) => a.startsWith("--cat="));
const cat = catArg ? catArg.slice(6) : "whisky";
const names = args.filter((a) => !a.startsWith("--cat="));

for (const n of names) {
  const q = searchName(n, cat);
  let m = null, how = "";
  try { m = await dailyshotFor(n, { category: cat }); if (m) how = "색인"; } catch (e) { console.log("  터짐:", e.message); }
  if (!m) { try { m = await searchAndMatch(n, { category: cat }); if (m) how = "검색"; } catch (e) { console.log("  터짐:", e.message); } }
  const low = m?.low || m?.price || 0;
  const arrow = q === n ? "" : `  →  ${q}`;
  console.log(`${low ? "○" : "✗"} [${cat}] ${n}${arrow}`);
  console.log(`    ${low ? low.toLocaleString() + "원 · " + how + " · " + m.name : "못 붙음"}`);
}
process.exit(0);
