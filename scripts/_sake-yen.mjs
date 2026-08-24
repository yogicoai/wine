// 조사 근거 문장에 적힌 일본 현지가를 꺼내 priceInfo 에 옮긴다.
//
// 사케 화면에는 "일본 현지가" 자리가 이미 있는데(components/ResultScreen.js 의
// price-abroad), priceInfo.jpyLow / jpyHigh 를 채운 적이 없어 한 번도 뜨지 않았다.
// 값은 있었다 — 시세를 조사할 때 근거 문장에 엔화를 적어 두었기 때문이다.
//
// 다만 그 문장에는 다른 등급의 값도 함께 적혀 있다.
//   "水芭蕉 純米大吟醸 720ml ¥3,300~4,000(박스 포함 ¥4,000). 하위/상위 등급은
//    별도 SKU 로 제외(翠 ¥2,200~3,060, 40 ¥5,500 …)"
// 뒤쪽 숫자를 집으면 다른 술의 값이 붙는다. 그래서 문장에서 처음 나오는
// 엔화 하나만 본다 — 조사할 때 그 술의 값을 먼저 적었기 때문이다.
//
// 쓰는 법
//   node --env-file=.env.local scripts/_sake-yen.mjs          눈으로만 본다
//   node --env-file=.env.local scripts/_sake-yen.mjs --apply  실제로 적는다

import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");

// "¥1,425~1,980" · "¥2,024" · "1800ml ¥42,000~53,000"
// 앞에 붙은 용량도 함께 집는다 — 720ml 와 1800ml 는 값이 두 배 넘게 다르다.
const YEN = /(?:(\d{3,4})\s*ml\s*)?[¥￥]\s*([\d,]+)(?:\s*[~〜-]\s*[¥￥]?\s*([\d,]+))?/;

function pick(basis) {
  const m = String(basis || "").match(YEN);
  if (!m) return null;
  const n = (s) => (s ? Number(String(s).replace(/,/g, "")) : null);
  const low = n(m[2]);
  const high = n(m[3]);
  if (!low || low < 300) return null; // 세 자리 밑은 값이 아니라 다른 숫자다
  return { ml: n(m[1]), low, high: high && high > low ? high : null };
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col
  .find(
    { category: "sake", "priceInfo.basis": { $exists: true } },
    { projection: { name: 1, priceInfo: 1 } }
  )
  .sort({ name: 1 })
  .toArray();

let found = 0;
let odd = 0;
const writes = [];

for (const d of docs) {
  const p = d.priceInfo || {};
  if (p.jpyLow) continue; // 이미 있는 것은 건드리지 않는다
  const got = pick(p.basis);
  if (!got) continue;
  found++;

  // 용량이 어긋나면 눈에 띄게 표시한다. 1800ml 값을 720ml 병값으로 쓰면
  // 두 배 넘게 부풀려진다.
  const ourMl = Number(String(p.volume || "").match(/(\d{3,4})\s*ml/i)?.[1]) || null;
  const clash = got.ml && ourMl && got.ml !== ourMl;
  if (clash) odd++;

  const label = got.high ? `¥${got.low.toLocaleString()}~${got.high.toLocaleString()}` : `¥${got.low.toLocaleString()}`;
  console.log(
    `${clash ? "⚠" : " "} ${d.name.slice(0, 22).padEnd(24)} ${label.padEnd(18)}` +
      ` ${String(got.ml ? got.ml + "ml" : "-").padEnd(8)} 우리 ${p.volume || "-"}`
  );
  if (clash) console.log(`     └ ${String(p.basis).slice(0, 130)}`);

  if (!clash) {
    writes.push({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { "priceInfo.jpyLow": got.low, ...(got.high ? { "priceInfo.jpyHigh": got.high } : {}) } },
      },
    });
  }
}

console.log(`\n찾음 ${found}종 · 용량 어긋남 ${odd}종 · 적을 것 ${writes.length}종`);

if (!APPLY) {
  console.log("눈으로만 봤습니다. 실제로 적으려면 --apply");
} else if (writes.length) {
  const r = await col.bulkWrite(writes, { ordered: false });
  console.log(`적었습니다 — ${r.modifiedCount}종`);
}

await client.close();
