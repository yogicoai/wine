// 카탈로그 오염 정리 — 하나하나 확인하고 손으로 판정한 목록이다.
//
// 정규식만으로 지우면 진짜 술을 잃는다. 실제로 그럴 뻔했다 —
// "내장산복분자주 골프1호 골드"와 "빌라골프 이글"은 이름에 '골프'가 들어가지만
// 둘 다 실존하는 술이다(11번가·와인21에서 판매 확인). 그래서 규칙이 아니라 목록으로 지운다.
//
// 사용: node scripts/_clean-pollution.mjs [--fix]

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const fix = process.argv.includes("--fix");

// 술이 아니다 — 지운다
const DELETE = [
  "칠레와인 이케아와인렉 천장렉",
  "고품질 몽 포트 캐릭터 쇼핑백 사무용품",
  "1865 카카오 튜브 골프백",
  "호주 빈티지 Decor BYO 와인 쿨러 캐리어",
  "스타벅스 애니버서리 사이렌 베어리스타 베어 스토퍼",
  "Le Creuset 샴페인 프로세코 크라운 병마개 스토퍼",
  "과일 진열대 팬트리 선반 편의점 스탠드 프레임",
  "술매대 양주 와인렉 업소용 편의점 보관대",
  "국내산 시럽푸어러 카페용품 오일푸어러",
  "와인샵진열대 술진열장 선반 캐비넷 편의점 주류매대",
  "-이태리(바스타일이오",
];

// 술은 맞는데 상품 목록의 사은품·묶음 표기가 이름에 붙었다 — 이름만 고친다
const RENAME = {
  "백제소주 45도 증류식소주+쇼핑백": "백제소주 45도",
  "백제소주 25도 +전용 +쇼핑백": "백제소주 25도",
  "로얄안동소주 전통주 45도 잔2 보자기": "로얄안동소주 45도",
  "양반 안동소주 50도 청자 호리병 잔1": "양반 안동소주 50도",
  ")1865 스페셜 에디션 비러브드 카베르네소비뇽": "1865 스페셜 에디션 비러브드 카베르네 소비뇽",
  "1865 마스터 블렌드 골프백": "1865 마스터 블렌드",
};

// 손대지 않는다 — 이름에 '골프'가 있지만 실존하는 술이다
const KEEP = ["내장산 복분자주 골프1호 골드 16도", "빌라골프 이글 샤르도네"];

// lib/nameClean.js 와 같은 규칙: 맨 뒤 괄호 한 덩어리만 떼고 정규화
function catalogKey(name, vintage) {
  let s = String(name || "").trim();
  const m = s.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (m && m[1].trim().length >= 2 && !/^\d+(\.\d+)?\s*(ml|mL|L|도|%|년)$/i.test(m[2].trim())) {
    s = m[1].trim();
  }
  s = s.toLowerCase().replace(/\b(19|20)\d{2}\b/g, "");
  s = [...s].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join("");
  return `${s.normalize("NFKC")}|${vintage || ""}`;
}

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

console.log(`손대지 않는 실존 제품: ${KEEP.join(" · ")}\n`);

let deleted = 0, renamed = 0, merged = 0, absent = 0;

for (const name of DELETE) {
  const doc = await col.findOne({ name }, { projection: { _id: 1, tier: 1 } });
  if (!doc) { absent++; continue; }
  if (doc.tier === "full") {
    console.log(`⚠ 정식 분석이라 건너뜀: ${name}`);
    continue;
  }
  if (fix) await col.deleteOne({ _id: doc._id });
  console.log(`${fix ? "삭제" : "삭제 예정"}: ${name}`);
  deleted++;
}

for (const [from, to] of Object.entries(RENAME)) {
  const doc = await col.findOne({ name: from }, { projection: { _id: 1, vintage: 1, tier: 1 } });
  if (!doc) { absent++; continue; }
  const newKey = catalogKey(to, doc.vintage);
  const clash = await col.findOne({ key: newKey, _id: { $ne: doc._id } }, { projection: { _id: 1, tier: 1 } });
  if (clash) {
    // 고친 이름이 이미 있다 — 뼈대 쪽을 버린다
    if (fix && doc.tier !== "full") await col.deleteOne({ _id: doc._id });
    console.log(`${fix ? "병합" : "병합 예정"}: ${from} → 이미 있는 ${to}`);
    merged++;
    continue;
  }
  if (fix) await col.updateOne({ _id: doc._id }, { $set: { name: to, key: newKey } });
  console.log(`${fix ? "개명" : "개명 예정"}: ${from} → ${to}`);
  renamed++;
}

console.log(`\n삭제 ${deleted} · 개명 ${renamed} · 병합 ${merged} · 이미 없음 ${absent}`);
if (!fix) console.log("(--fix 를 붙여야 실제로 반영됩니다)");
await client.close();
