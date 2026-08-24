// 색인에 없는 것을 데일리샷 검색으로 한 번 훑어 채운다.
//
// 색인은 목록 API 를 훑어 만든 것이라 품절·비노출 상품이 빠져 있다. 그런 것도
// 검색에는 걸린다 — 위스키 미매칭의 23%, 맥주의 18% 가 그렇게 찾아진다.
//
// 앱은 이미 화면에서 못 찾으면 검색으로 넘어가지만, 그때마다 0.4 초를 기다리고
// 남의 서버를 두드린다. 미리 한 번 훑어 두면 그 값이 색인에 담기므로 다음부터는
// 기다림도 요청도 없다.
//
//   node --env-file=.env.local scripts/_dailyshot-backfill.mjs
//   node --env-file=.env.local scripts/_dailyshot-backfill.mjs wine

import { MongoClient } from "mongodb";
import { dailyshotFor, searchAndMatch } from "../lib/dailyshot.js";

const only = process.argv[2];
const APPS = {
  whisky: ["whisky"],
  wine: ["wine"],
  beer: ["beer"],
  sake: ["sake"],
  tradition: ["traditional", "makgeolli", "soju"],
  spirits: ["brandy", "gin", "rum", "tequila", "baijiu", "liqueur", "vodka", "highball", "spirits"],
};

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const t0 = Date.now();
let looked = 0;
let found = 0;

for (const [app, cats] of Object.entries(APPS)) {
  if (only && only !== app) continue;
  const docs = await col
    .find({ category: { $in: cats } }, { projection: { name: 1, category: 1 } })
    .sort({ name: 1 })
    .toArray();

  let miss = 0;
  let got = 0;
  for (const d of docs) {
    if (await dailyshotFor(d.name, { category: d.category })) continue;
    miss++;
    looked++;
    if (await searchAndMatch(d.name, { category: d.category })) {
      got++;
      found++;
    }
    // 남의 서버다. 화면에서 부르는 것과 같은 속도로만 두드린다.
    await new Promise((z) => setTimeout(z, 350));
    if (miss % 200 === 0) console.log(`  ${app} ${miss}건째 · 찾음 ${got}`);
  }
  console.log(`${app.padEnd(10)} 미매칭 ${String(miss).padStart(5)}건 중 ${String(got).padStart(4)}건 찾음`);
}

console.log(`\n끝. ${looked}건 훑어 ${found}건 채웠다 · ${((Date.now() - t0) / 60000).toFixed(1)}분`);
await client.close();
process.exit(0);
