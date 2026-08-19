// 데일리샷 색인이 우리 카탈로그와 얼마나 맞물리는가 — 붙이기 전의 눈검사.
//
// 값을 못 찾는 것은 조용히 지나가므로 해가 없다. 문제는 엉뚱한 값을 가격이라고
// 내놓는 것이고, 그것은 목표가 알림을 잘못 울린다. 그래서 적중률만 세지 않고
// 무엇에 붙었는지를 통째로 찍어 눈으로 본다.
//
// 쓰는 법
//   node --env-file=.env.local scripts/_dailyshot-match.mjs wine
//   node --env-file=.env.local scripts/_dailyshot-match.mjs all
//   node --env-file=.env.local scripts/_dailyshot-match.mjs wine 40      앞 40개만
//   node --env-file=.env.local scripts/_dailyshot-match.mjs wine 40 --miss  못 찾은 것도 본다

import { MongoClient } from "mongodb";
import { dailyshotFor } from "../lib/dailyshot.js";

const [catArg, nArg, ...flags] = process.argv.slice(2);
const LIMIT = Number(nArg) || 0;
const SHOW_MISS = flags.includes("--miss");

const CATS = catArg && catArg !== "all"
  ? [catArg]
  : ["wine", "sake", "beer", "whisky", "traditional", "makgeolli", "soju", "spirits"];

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");

console.log(`데일리샷 색인 ${await db.collection("dailyshot").countDocuments()}건\n`);

const totals = { hit: 0, all: 0 };

for (const cat of CATS) {
  let docs = await db
    .collection("catalog")
    .find({ category: cat }, { projection: { name: 1, "result.volume": 1, priceBand: 1 } })
    .sort({ name: 1 })
    .toArray();
  if (!docs.length) continue;
  if (LIMIT) docs = docs.slice(0, LIMIT);

  const rows = [];
  let hit = 0;
  for (const d of docs) {
    const got = await dailyshotFor(d.name, { category: cat, volume: d.result?.volume });
    if (got) hit++;
    if (got || SHOW_MISS) rows.push([d.name, got]);
  }
  totals.hit += hit;
  totals.all += docs.length;

  const pct = ((hit / docs.length) * 100).toFixed(0);
  console.log(`── ${cat}  ${hit}/${docs.length} (${pct}%) ──────────────────`);
  for (const [name, got] of rows) {
    if (!got) {
      console.log(`  ✗ ${name}`);
      continue;
    }
    // 붙은 이름을 나란히 찍는다 — 다른 술에 붙은 것은 여기서만 보인다
    const same = name.replace(/\s/g, "") === got.name.replace(/\s/g, "");
    console.log(
      `  ${same ? "·" : "→"} ${name.slice(0, 28).padEnd(30)} ${got.name.slice(0, 30).padEnd(32)}` +
        ` ${String(got.low).padStart(8)}원 ${String(got.sellers).padStart(4)}곳 ${got.volume || "-"}`
    );
  }
  console.log("");
}

console.log(`합계 ${totals.hit}/${totals.all} (${((totals.hit / totals.all) * 100).toFixed(0)}%)`);
await client.close();
// lib/dailyshot.js 가 lib/mongodb.js 로 제 연결을 따로 연다. 그쪽은 앱이 살아 있는
// 동안 계속 쓰라고 만든 것이라 닫는 문이 없어, 여기서 끊지 않으면 스크립트가 안 끝난다.
process.exit(0);
