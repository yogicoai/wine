// 카탈로그 품질 전수 점검 — 정식 분석 항목이 화면을 제대로 채울 수 있는지 본다.
//
// 화면은 없는 값을 조용히 건너뛰므로, 빠진 것이 있어도 눈에 잘 띄지 않는다.
// 그래서 여기서 한 번에 센다.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col.find({ tier: "full" }, {
  projection: {
    name: 1, category: 1, priceBand: 1, priceInfo: 1, image: 1, "i18n.en": 1, "i18n.ja": 1,
    "result.tasteProfile": 1, "result.foodPairing": 1, "result.similar": 1,
    "result.tastingNotes": 1, "result.story": 1, "result.specs": 1, "result.history": 1,
    "result.servingTemp": 1, "result.tips": 1, "result.liquidColor": 1,
  },
}).toArray();

const miss = {
  맛축: [], 페어링: [], 유사주: [], 시음노트: [], 스토리: [],
  제원: [], 역사: [], 음용온도: [], 팁: [], 색: [], 가격대: [],
};
for (const d of docs) {
  const r = d.result || {};
  if (!(r.tasteProfile?.length >= 3)) miss.맛축.push(d.name);
  if (!(r.foodPairing?.length >= 1)) miss.페어링.push(d.name);
  if (!(r.similar?.length >= 1)) miss.유사주.push(d.name);
  if (!r.tastingNotes) miss.시음노트.push(d.name);
  if (!r.story) miss.스토리.push(d.name);
  if (!(r.specs?.length >= 1)) miss.제원.push(d.name);
  if (!(r.history?.length >= 1)) miss.역사.push(d.name);
  if (!r.servingTemp) miss.음용온도.push(d.name);
  if (!(r.tips?.length >= 1)) miss.팁.push(d.name);
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(r.liquidColor || ""))) miss.색.push(d.name);
  if (!d.priceBand) miss.가격대.push(d.name);
}

console.log(`정식 분석 ${docs.length}건\n`);
console.log("항목        빠진 수   예시");
for (const [k, v] of Object.entries(miss)) {
  const ex = v.slice(0, 3).join(" · ");
  console.log(`${k.padEnd(10)}${String(v.length).padStart(6)}   ${ex}`);
}

const stubs = await col.countDocuments({ tier: "stub" });
const withImg = docs.filter((d) => d.image).length;
const withPrice = docs.filter((d) => d.priceInfo).length;
const withEn = docs.filter((d) => d.i18n?.en).length;
const withJa = docs.filter((d) => d.i18n?.ja).length;
console.log(`\n뼈대 ${stubs} · 사진 ${withImg} · 시세 ${withPrice} · 영어 ${withEn} · 일본어 ${withJa}`);
await client.close();
