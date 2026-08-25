// 손으로 쓴 술 정보를 카탈로그에 넣는다.
//
// 뼈대(stub)는 이름·사진·가격대·맛 축만 있다. 그 술을 열면 화면이 텅 빈다 —
// 이야기도, 향·맛도, 어울리는 안주도, 어떻게 마시는지도 없다.
//
// 이것을 앱이 AI 를 불러 채우면 건당 돈이 든다(3,303종에 5만 원 남짓). 그런데
// 처음 한 번은 여기서 써서 넣으면 된다. 앞으로 새로 들어오는 술만 앱이 채운다.
//
// 넣는 방법. data/enrich/*.json 에 이런 모양으로 적는다.
//   [{ "name": "로버트 몬다비 샤도네이 나파 밸리", "producer": "Robert Mondavi",
//      "story": "…", "tastingNotes": "…", "foodPairing": [...], ... }]
//
// 이름으로 찾는다. 카탈로그에 없는 이름은 건너뛰고 알려 준다 — 새로 만들지
// 않는다. 없는 술을 지어내면 그것이 곧 오염이다.
//
//   node --env-file=.env.local scripts/_enrich-apply.mjs data/enrich/wine-01.json
//   node --env-file=.env.local scripts/_enrich-apply.mjs data/enrich/wine-01.json --apply

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.log("쓸 파일을 지정해 주세요 — scripts/_enrich-apply.mjs data/enrich/wine-01.json");
  process.exit(1);
}

// result 안에 들어가는 것
const RESULT_FIELDS = [
  "producer", "region", "alcohol", "liquidColor", "vintage",
  "tastingNotes", "specs", "history", "story", "winery",
  "foodPairing", "pairingTip", "avoidPairing",
  "servingTemp", "servingNote", "aging",
  "tips", "trivia", "similar", "ratings",
  "drinkFrom", "drinkPeak", "drinkUntil",
  "knowledge", "basis", "confidence", "beginner", "tags", "type",
];
// 문서 최상단에도 함께 두는 것 — 검색·정렬이 쓴다
const TOP_FIELDS = ["producer", "vintage"];

// 이 정도가 차면 화면이 빈 데 없이 그려진다. 그때만 정식으로 올린다.
function isComplete(row) {
  return !!(row.story && row.tastingNotes && Array.isArray(row.foodPairing) && row.foodPairing.length);
}

const rows = JSON.parse(readFileSync(file, "utf-8"));
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const writes = [];
let missing = 0;
let thin = 0;

for (const row of rows) {
  if (!row?.name) continue;
  const doc = await col.findOne({ name: row.name }, { projection: { _id: 1, tier: 1, category: 1 } });
  if (!doc) {
    missing++;
    console.log(`  ✗ 카탈로그에 없음 — ${row.name}`);
    continue;
  }

  const set = {};
  for (const f of RESULT_FIELDS) if (row[f] !== undefined) set[`result.${f}`] = row[f];
  for (const f of TOP_FIELDS) if (row[f] !== undefined) set[f] = row[f];

  const full = isComplete(row);
  if (!full) thin++;
  if (full) {
    set.tier = "full";
    set["result.tier"] = "full";
    // 맛 축이 이름에서 추정한 것이었다면 그 표시를 지운다 — 이제 사람이 확인했다
    set["result.tasteEstimated"] = false;
  }
  set.enrichedAt = new Date();
  set.enrichedBy = "hand";

  console.log(`  ${full ? "●" : "○"} ${String(doc.category).padEnd(12)}${row.name.slice(0, 38)}`);
  writes.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
}

console.log(`\n적을 것 ${writes.length}종 · 정식 승격 ${writes.length - thin}종 · 내용 부족 ${thin}종 · 이름 못 찾음 ${missing}종`);

if (!APPLY) {
  console.log("눈으로만 봤습니다. 실제로 적으려면 --apply");
} else if (writes.length) {
  const r = await col.bulkWrite(writes, { ordered: false });
  console.log(`적었습니다 — ${r.modifiedCount}종`);
}

await client.close();
process.exit(0);
