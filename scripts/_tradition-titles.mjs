// 쇼핑몰 목록 제목에서 상품명을 되찾는다 — 전통주 카탈로그의 두 번째 문제.
//
// 이름 자리에 광고 문구가 통째로 들어와 있다.
//   "대용량으로 넉넉하게 즐기는 고창명산품복분자 고창 복분자주"
//   "안동소주일품 40도 유리병 증류식소주 전통주 안동소주"
//   "송명섭이 직접 빚은 생 막걸리 6도"
// 한글이지만 검색어가 못 된다. 데일리샷에 우리술이 2,361종 있어도 못 만난다.
//
// 규칙으로 자르지 않는다. "대용량으로 넉넉하게 즐기는" 같은 수식어는 끝이 없고,
// 잘못 자르면 멀쩡한 이름을 망가뜨린다. 대신 반대로 간다 — 데일리샷의 상품명이
// 이 제목 "안에 통째로 들어 있는지" 본다. 들어 있다면 그것이 이 술의 이름이다.
//
// 방향이 평소와 반대라는 점이 중요하다. lib/dailyshot.js 의 대조는 우리 이름의
// 낱말이 상대에게 다 있어야 하는데, 여기서는 상대의 낱말이 우리에게 다 있어야
// 한다. 제목이 이름보다 길기 때문이다.
//
// 쓰는 법
//   node --env-file=.env.local scripts/_tradition-titles.mjs          눈으로만
//   node --env-file=.env.local scripts/_tradition-titles.mjs --apply  실제로 적는다

import { MongoClient } from "mongodb";
import { tokenize, isWeakToken } from "../lib/match.js";

const APPLY = process.argv.includes("--apply");
const KOREAN = ["traditional", "makgeolli", "soju"];

/** 데일리샷 상품명에서 장사 사정을 뗀다 */
function tidy(raw) {
  return String(raw || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s*\d+(\.\d+)?\s*(ml|l|리터)\s*$/i, " ")
    .replace(/\s*\d+(\.\d+)?\s*(%|도)\s*$/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 후보 이름의 글자가 제목 안에 다 있는가.
 *
 * 낱말만 보면 한 글자짜리가 사라진다. "안동소주 일품 진"의 "진"은 토큰이
 * 되지 못해, "전통 증류식 소주 안동소주 일품 40도"가 "일품 진"으로 바뀔 뻔했다.
 * 둘은 다른 술이고 값도 다르다. 글자로 한 번 더 본다.
 */
function charsFit(candidate, title) {
  const have = new Set(String(title).replace(/\s/g, ""));
  return [...String(candidate).replace(/\s/g, "")].every((ch) => have.has(ch));
}

/** 도수 — 다르면 다른 술이다 */
function abv(text) {
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:%|도(?![수가-힣]))/);
  return m ? Number(m[1]) : null;
}

// 제목 하나에 술이 둘 — "복순도가 손막걸리 +빨간쌀 막걸리".
// 어느 쪽 이름을 골라도 나머지 하나를 잃는다. 사람이 정해야 한다.
const TWO_DRINKS = /[+＋]|\s&\s/;

/** 이 제목이 손볼 만한가 — 이미 상품명처럼 짧으면 건드리지 않는다 */
function messy(name) {
  const t = tokenize(name);
  return t.length >= 4 || name.length >= 14;
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");

// 데일리샷 우리술 상품명 — 이름이 될 후보들
const pool = [];
for (const d of await db
  .collection("dailyshot")
  .find({ category: "우리술" }, { projection: { name: 1 } })
  .toArray()) {
  const name = tidy(d.name);
  const tokens = tokenize(name);
  // 낱말 하나짜리 이름은 아무 제목에나 걸린다. 둘 이상이어야 특정이 된다.
  if (tokens.length < 2) continue;
  // 품종·등급 같은 흔한 말만으로 된 이름도 마찬가지다 ("생 막걸리")
  if (!tokens.some((t) => !isWeakToken(t))) continue;
  pool.push({ name, tokens, raw: d.name });
}
// 긴 이름부터 본다 — 더 구체적인 쪽이 맞는 이름이다
pool.sort((a, b) => b.tokens.length - a.tokens.length || b.name.length - a.name.length);
console.log(`데일리샷 우리술 이름 후보 ${pool.length}가지\n`);

const docs = await db
  .collection("catalog")
  .find({ category: { $in: KOREAN }, name: /[가-힣]/ }, { projection: { name: 1 } })
  .sort({ name: 1 })
  .toArray();

let looked = 0;
const writes = [];
for (const d of docs) {
  if (!messy(d.name)) continue;
  if (TWO_DRINKS.test(d.name)) continue;
  looked++;
  const have = new Set(tokenize(d.name));
  const ours = abv(d.name);
  // 상대의 낱말이 우리 제목에 전부 있어야 하고, 글자도 다 있어야 하고,
  // 도수를 양쪽이 밝히면 같아야 한다.
  const found = pool.find((p) => {
    if (!p.tokens.every((t) => have.has(t))) return false;
    if (!charsFit(p.name, d.name)) return false;
    const theirs = abv(p.raw);
    return !(ours != null && theirs != null && ours !== theirs);
  });
  if (!found) continue;
  // 이미 같은 이름이면 손댈 것이 없다
  if (found.name === d.name) continue;

  console.log(`  ${d.name.slice(0, 40).padEnd(42)} → ${found.name}`);
  writes.push({
    updateOne: {
      filter: { _id: d._id },
      // 원래 제목은 남긴다. 되돌릴 길을 없애면 안 되고, 검색어로는 여전히 쓸모가 있다.
      update: { $set: { name: found.name, listTitle: d.name, nameFixedAt: new Date() } },
    },
  });
}

console.log(`\n손볼 만한 제목 ${looked}종 중 ${writes.length}종을 되찾았다`);

if (!APPLY) {
  console.log("눈으로만 봤습니다. 실제로 적으려면 --apply");
} else if (writes.length) {
  const r = await db.collection("catalog").bulkWrite(writes, { ordered: false });
  console.log(`적었습니다 — ${r.modifiedCount}종`);
}

await client.close();
