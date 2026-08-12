// 번역이 붙지 못한 항목 구제 — 키가 바뀌어 못 찾은 것들을 이름으로 다시 잇는다.
// 사용: node scripts/_fix-missing-keys.mjs <translations.json>
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

const rows = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const list = Array.isArray(rows) ? rows : rows.translations || [];

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

// 키에서 이름을 되짚을 수는 없으니, 카탈로그 전체의 키 정규형을 만들어 대조한다.
// (키가 "고리키강력|" 처럼 괄호 처리 규칙 차이로 어긋난 경우를 잡기 위함)
const all = await col.find({}, { projection: { key: 1, name: 1 } }).toArray();
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const byNorm = new Map();
for (const d of all) {
  const k = norm(d.key.split("|")[0]);
  if (k && !byNorm.has(k)) byNorm.set(k, d);
}

let fixed = 0, stillMissing = 0;
for (const row of list) {
  const exact = await col.findOne({ key: row.key }, { projection: { _id: 1 } });
  if (exact) continue; // 이미 붙었다

  const cand = byNorm.get(norm(String(row.key).split("|")[0]));
  if (!cand) {
    stillMissing++;
    console.log(`✗ 여전히 없음: ${row.key} (${row.en?.name || row.ja?.name || ""})`);
    continue;
  }

  const doc = await col.findOne({ _id: cand._id }, { projection: { _id: 1, name: 1, "result.foodPairing": 1 } });
  const set = {};
  for (const lang of ["en", "ja"]) {
    const layer = row[lang];
    if (!layer || typeof layer !== "object") continue;
    const clean = {};
    for (const [k, v] of Object.entries(layer)) {
      if (!ALLOWED.has(k) || v == null) continue;
      clean[k] = v;
    }
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
  console.log(`✓ ${row.key} → ${doc.name}`);
  fixed++;
}
console.log(`\n구제 ${fixed} · 여전히 없음 ${stillMissing}`);
await client.close();
