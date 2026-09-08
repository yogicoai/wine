// 표의 이름 짝이 정말 그 상품에 붙는지 하나씩 확인하고, 안 되는 것은 빼낸다.
//   node --env-file=.env.local scripts/_alias-verify.mjs [--fix]
//
// 빼내는 것:
//   · 적용해도 값이 안 붙는 것          — 표가 틀렸다
//   · 목표와 다른 상품에 붙은 것        — 가장 위험하다
//   · 세트·바이알에 붙은 것
import { readFileSync, writeFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { dailyshotFor, searchAndMatch } from "../lib/dailyshot.js";

const fix = process.argv.includes("--fix");
const TABLE = "data/dailyshot-alias.json";
const BAD = /세트|패키지|기획|묶음|바이알|미니어처|증정|전용잔/;
// 이름 끝의 용량은 떼고 견준다. 판정이 "페트론 아네호 750ml"를 골랐는데 대조가
// "페트론 아네호 700ml"를 집는 일이 잦은데, 둘은 같은 병의 다른 크기라 이름이
// 어긋난 것이 아니다. 크기가 값에 맞는지는 matchIn 의 VOLUMES 가 이미 본다.
const flat = (s) =>
  String(s)
    .replace(/\d+(\.\d+)?\s*(ml|l|리터)\b/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");

const table = JSON.parse(readFileSync(TABLE, "utf8"));
const names = Object.keys(table);
if (!names.length) { console.log("표가 비어 있습니다"); process.exit(0); }

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const ok = [], bad = [];
for (const ours of names) {
  const doc = await col.findOne({ name: ours }, { projection: { category: 1 } });
  const cat = doc?.category;
  if (!cat) { bad.push({ ours, 왜: "카탈로그에 없는 이름" }); continue; }

  let m = null;
  try { m = await dailyshotFor(ours, { category: cat }); } catch {}
  if (!m) {
    try { m = await searchAndMatch(ours, { category: cat }); } catch {}
    await new Promise((s) => setTimeout(s, 180));
  }
  const low = m?.low || m?.price || 0;
  const got = m?.name || "";
  const want = table[ours];

  if (!low) { bad.push({ ours, want, 왜: "적용해도 값이 안 붙음" }); continue; }
  if (BAD.test(got)) { bad.push({ ours, want, got, 왜: "세트·바이알에 붙음" }); continue; }
  if (!flat(got).includes(flat(want)) && !flat(want).includes(flat(got))) {
    bad.push({ ours, want, got, 왜: `다른 상품에 붙음 → ${got}` });
    continue;
  }
  ok.push({ ours, want, got, won: low });
}

console.log(`표 ${names.length}건 — 통과 ${ok.length} · 떨어짐 ${bad.length}`);
bad.forEach((b) => console.log(`  ✗ ${b.ours}  →  ${b.want || "?"}   ${b.왜}`));
if (ok.length) {
  console.log("");
  ok.slice(0, 12).forEach((o) => console.log(`  ○ ${o.ours}  →  ${o.got}  ${o.won.toLocaleString()}원`));
}

if (fix && bad.length) {
  const next = {};
  for (const o of ok) next[o.ours] = o.want;
  writeFileSync(TABLE, JSON.stringify(next, null, 1) + "\n", "utf8");
  console.log(`\n떨어진 ${bad.length}건을 표에서 뺐습니다 — 지금 ${ok.length}건`);
}
await c.close();
process.exit(0);
