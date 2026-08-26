// 같은 술이 두 줄을 차지한 것을 찾는다 — 이름을 다듬고 띄어쓰기를 지워 견준다.
// 지우지 않고 보여만 준다. --apply 를 줘야 표시한다.
import { MongoClient } from "mongodb";
import { searchName } from "../lib/dailyshot.js";

const cat = process.argv[2] || "whisky";
const apply = process.argv.includes("--apply");

const key = (n) =>
  searchName(n, cat)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]/g, "");

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const rows = await col
  .find(
    { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, category: cat },
    { projection: { name: 1, result: 1, priceBand: 1 } }
  )
  .toArray();

const groups = new Map();
for (const r of rows) {
  const k = key(r.name);
  if (!k) continue;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

let n = 0;
for (const [, g] of groups) {
  if (g.length < 2) continue;
  // 남길 것을 고른다. 화면에 뜨는 이름이라 사람이 읽기 좋은 쪽이어야 한다.
  //   1. 이야기가 붙은 쪽
  //   2. 한글로 적힌 쪽 — "Springbank 10 Year Old"보다 "스프링뱅크 10년"이다
  //   3. 고쳐 쓸 필요가 없는 쪽 — searchName 이 손대지 않는 이름이 파는 쪽
  //      표기와 이미 같다는 뜻이다. "라프로익 쿼터캐스트"보다 "쿼터 캐스크"다
  //   4. 끝에 도수가 안 붙은 쪽 — "짐빔 화이트 40도"보다 "짐빔 화이트"다
  //   5. 짧은 쪽
  const score = (r) => {
    const n = r.name;
    const hangul = (n.match(/[가-힣]/g) || []).length;
    const latin = (n.match(/[A-Za-z]/g) || []).length;
    return [
      r.result?.story ? 1 : 0,
      hangul >= latin ? 1 : 0,
      searchName(n, cat) === n ? 1 : 0,
      /\d+\s*도(\s|$)/.test(n) ? 0 : 1,
    ];
  };
  g.sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return a.name.length - b.name.length;
  });
  const keep = g[0];
  console.log(`남김: ${keep.name}`);
  for (const d of g.slice(1)) {
    console.log(`   ↳ ${d.name}`);
    n++;
    if (apply) await col.updateOne({ _id: d._id }, { $set: { dupeOf: keep.name } });
  }
}
console.log("");
console.log(`같은 술이 두 줄인 것 ${n}건` + (apply ? " — 표시했습니다" : " (보기만 함, --apply 로 표시)"));
await c.close();
process.exit(0);
