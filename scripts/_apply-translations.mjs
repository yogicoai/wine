// 번역 결과를 문서의 i18n.{lang} 에 심는다.
// 사용: node apply-translations.mjs <translations.json>
// 형식: { translations: [{ key, en: {...}, ja: {...} }] }
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const ALLOWED = new Set([
  "name", "type", "region", "country", "basis", "tastingNotes", "story", "winery",
  "pairingTip", "avoidPairing", "trivia", "servingTemp", "servingNote", "aging",
  "tips", "specs", "history", "foodPairing",
]);

const data = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const rows = data.translations || data;

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

let applied = 0, missed = 0;
for (const row of rows) {
  const doc = await col.findOne({ key: row.key }, { projection: { _id: 1, "result.foodPairing": 1 } });
  if (!doc) { console.log(`⚠ 없음: ${row.key}`); missed++; continue; }

  const set = {};
  for (const lang of ["en", "ja"]) {
    const layer = row[lang];
    if (!layer || typeof layer !== "object") continue;
    const clean = {};
    for (const [k, v] of Object.entries(layer)) {
      if (!ALLOWED.has(k) || v == null) continue;
      clean[k] = v;
    }
    // 페어링의 shopKeyword 는 네이버용 한국어 — 번역이 덮었으면 원문으로 복구
    if (Array.isArray(clean.foodPairing) && Array.isArray(doc.result?.foodPairing)) {
      clean.foodPairing = clean.foodPairing.map((p, i) => ({
        ...p,
        shopKeyword: doc.result.foodPairing[i]?.shopKeyword ?? p.shopKeyword,
      }));
    }
    if (Object.keys(clean).length) set[`i18n.${lang}`] = clean;
  }
  if (!Object.keys(set).length) continue;
  await col.updateOne({ _id: doc._id }, { $set: set });
  applied++;
}
console.log(`번역 적용 ${applied} · 못 찾음 ${missed}`);
await client.close();
