// 앱을 열 수 있는 상태인가 — 주종마다 세 숫자를 겹쳐 본다.
//   이야기  DB 에 이야기·페어링이 있다 (제가 손으로 채운 것)
//   가격    지금 데일리샷에 물으면 실시간 최저가가 붙는다 (_pairs-<주종>.json)
//   둘 다   두 가지가 모두 되는 술 — 화면이 비지 않는 술이다
//
//   node --env-file=.env.local scripts/_launch-ready.mjs
import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "node:fs";

const APPS = {
  위스키: ["whisky"],
  맥주: ["beer"],
  스피리츠: ["brandy", "gin", "rum", "tequila", "baijiu", "liqueur", "vodka", "highball"],
  와인: ["wine"],
  사케: ["sake"],
  전통주: ["traditional", "makgeolli", "soju"],
};

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const F = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };
const STORY = { "result.story": { $nin: [null, ""] } };

const rows = [];
for (const [app, cats] of Object.entries(APPS)) {
  let total = 0, story = 0, price = 0, both = 0, missing = [];
  for (const cat of cats) {
    const p = `scripts/_pairs-${cat}.json`;
    if (!existsSync(p)) { missing.push(cat); continue; }
    const priced = new Set(JSON.parse(readFileSync(p, "utf8")).map((x) => x.ours));
    const docs = await col
      .find({ ...F, category: cat }, { projection: { name: 1, "result.story": 1 } })
      .toArray();
    for (const d of docs) {
      const hasStory = !!d.result?.story;
      const hasPrice = priced.has(d.name);
      total++;
      if (hasStory) story++;
      if (hasPrice) price++;
      if (hasStory && hasPrice) both++;
    }
  }
  rows.push({ app, total, story, price, both, missing });
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
console.log("앱          카탈로그   이야기      실시간가격    둘 다 되는 술");
for (const r of rows) {
  if (r.missing.length && !r.total) { console.log(`${r.app.padEnd(8)}  (측정 전: ${r.missing.join(",")})`); continue; }
  console.log(
    `${r.app.padEnd(8)} ${String(r.total.toLocaleString()).padStart(7)}종 ` +
    `${String(pct(r.story, r.total)).padStart(4)}%  ` +
    `${String(pct(r.price, r.total)).padStart(4)}% (${String(r.price).padStart(4)})  ` +
    `${String(r.both).padStart(5)}종 (${pct(r.both, r.total)}%)` +
    (r.missing.length ? `   ※ ${r.missing.join(",")} 측정 전` : "")
  );
}
await c.close();
process.exit(0);
