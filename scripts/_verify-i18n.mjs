// 사케 i18n 층 검수 — ja 원어 이름·shopKeyword 한국어 유지·similar 미포함 확인
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

const total = await col.countDocuments({ category: "sake", tier: "full" });
const withEn = await col.countDocuments({ category: "sake", tier: "full", "i18n.en": { $exists: true } });
const withJa = await col.countDocuments({ category: "sake", tier: "full", "i18n.ja": { $exists: true } });
console.log(`사케 정식 ${total} · en ${withEn} · ja ${withJa}`);

// ja 이름이 일본 문자(가나·한자)를 포함하는 비율
const docs = await col.find(
  { category: "sake", "i18n.ja": { $exists: true } },
  { projection: { name: 1, "i18n.ja.name": 1, "i18n.en.name": 1, "i18n.ja.foodPairing": 1, "i18n.ja.similar": 1, "i18n.en.similar": 1 } },
).toArray();

let jaNative = 0, koShop = 0, shopTotal = 0, similarLeak = 0;
const samples = [];
for (const d of docs) {
  const ja = d.i18n?.ja?.name || "";
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(ja)) jaNative++;
  for (const p of d.i18n?.ja?.foodPairing || []) {
    shopTotal++;
    if (/[가-힣]/.test(p.shopKeyword || "")) koShop++;
  }
  if (d.i18n?.ja?.similar || d.i18n?.en?.similar) similarLeak++;
  if (samples.length < 6) samples.push(`${d.name} → ja「${ja}」 en「${d.i18n?.en?.name}」`);
}
console.log(`ja 원어 표기 ${jaNative}/${docs.length} · shopKeyword 한국어 ${koShop}/${shopTotal} · similar 유출 ${similarLeak}`);
for (const s of samples) console.log("  " + s);
await client.close();
