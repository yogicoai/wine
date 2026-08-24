// 전통주 카탈로그의 이름을 상품명으로 되돌린다.
//
// 데일리샷 대조에서 전통주만 6% 였다. 대조기 탓이 아니라 우리 쪽 이름 탓이다 —
// 데일리샷에 우리술이 2,361종 있는데 우리가 가진 이름이 검색어가 못 된다.
//
//   ① 로마자로만 적힌 것 160종
//        Boksoondoga Son Makgeolli · Andong Soju · Bekseju
//   ② 쇼핑몰 목록 제목이 그대로 들어온 것
//        "대용량으로 넉넉하게 즐기는 고창명산품복분자 고창 복분자주"
//        "안동소주일품 40도 유리병 증류식소주 전통주 안동소주"
//
// ①은 되돌릴 길이 있다. 데일리샷 우리술 2,361종이 영문명을 100% 갖고 있어서,
// 로마자끼리 맞추면 한글 상품명이 딸려 온다. 우리가 손으로 옮기는 것보다
// 정확하다 — 그쪽이 제조사가 표기한 이름이기 때문이다.
//
// ②는 여기서 손대지 않는다. 광고 문구에서 상품명만 떼어 내는 일은 규칙으로
// 되지 않고, 잘못 자르면 멀쩡한 이름을 망가뜨린다. 사람이 보고 정해야 한다.
//
// 쓰는 법
//   node --env-file=.env.local scripts/_tradition-names.mjs          눈으로만
//   node --env-file=.env.local scripts/_tradition-names.mjs --apply  실제로 적는다

import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const KOREAN = ["traditional", "makgeolli", "soju"];

/**
 * 로마자를 맞대 볼 수 있는 모양으로.
 *
 * 로마자 표기는 띄어쓰기와 하이픈이 제각각이고(Son Makgeolli / Sonmakgeolli),
 * 대소문자도 섞인다. 다 지우고 소문자로 눕혀 놓고 본다. 용량·도수처럼 이름이
 * 아닌 꼬리도 떼어 낸다.
 */
function key(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|%)/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * 데일리샷 상품명에서 우리 이름으로 쓸 부분만 남긴다.
 *
 * 그쪽 이름에는 장사 사정이 붙어 있다 — "[봉투값 별도] 진로 1924 헤리티지",
 * "[8/26(수) 앵콜 마감] 삼해 소주", "백세주 375ml", "고소리술 29%".
 * 그대로 옮기면 우리 카탈로그에 남의 가게 사정이 들어온다.
 *
 * 다만 뒤에 붙은 숫자를 다 떼면 안 된다. 화요 17 · 죽력고 32 · 미르 40 은
 * 그 숫자가 이름이다. 용량과 도수는 단위가 붙어 있어 갈라낼 수 있다.
 */
function tidy(raw) {
  return String(raw || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s*\d+(\.\d+)?\s*(ml|l|리터)\s*$/i, " ")
    .replace(/\s*\d+(\.\d+)?\s*(%|도)\s*$/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");

// 데일리샷 우리술의 영문명 → 한글 상품명
const index = new Map();
for (const d of await db
  .collection("dailyshot")
  .find({ category: "우리술", nameEn: { $nin: [null, ""] } }, { projection: { name: 1, nameEn: 1 } })
  .toArray()) {
  const k = key(d.nameEn);
  if (!k) continue;
  // 같은 로마자에 여럿이 걸리면 가장 짧은 이름을 쓴다 — 세트·기획이 아니라
  // 기본 제품일 확률이 높다.
  const name = tidy(d.name);
  if (!name) continue;
  const prev = index.get(k);
  if (!prev || name.length < prev.length) index.set(k, name);
}
console.log(`데일리샷 우리술 영문명 ${index.size}가지\n`);

// 우리 카탈로그에서 로마자로만 된 이름
const docs = await db
  .collection("catalog")
  .find({ category: { $in: KOREAN }, name: { $not: /[가-힣]/ } }, { projection: { name: 1, category: 1 } })
  .sort({ name: 1 })
  .toArray();

let hit = 0;
const writes = [];
for (const d of docs) {
  const found = index.get(key(d.name));
  if (!found) continue;
  hit++;
  console.log(`  ${d.name.slice(0, 34).padEnd(36)} → ${found}`);
  writes.push({
    updateOne: {
      filter: { _id: d._id },
      // 원래 이름을 지우지 않고 옆에 남긴다. 되돌릴 길을 없애면 안 되고,
      // 영어 화면에서는 그 이름이 그대로 쓸모가 있다.
      update: { $set: { name: found, nameEn: d.name, nameFixedAt: new Date() } },
    },
  });
}

console.log(`\n로마자 이름 ${docs.length}종 중 ${hit}종을 되찾았다 (${Math.round((hit / docs.length) * 100)}%)`);

if (!APPLY) {
  console.log("눈으로만 봤습니다. 실제로 적으려면 --apply");
} else if (writes.length) {
  const r = await db.collection("catalog").bulkWrite(writes, { ordered: false });
  console.log(`적었습니다 — ${r.modifiedCount}종`);
}

await client.close();
