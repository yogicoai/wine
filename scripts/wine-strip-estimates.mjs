// 출처가 없는 와인(조사·구조화 모두 안 된 것)에서 "추정값"만 걷어 낸다 — 이름 색인(이름·주종·가격대·종류·나라 등)은 그대로 둔다.
//
//   node --env-file=.env.local scripts/wine-strip-estimates.mjs            보기만
//   node --env-file=.env.local scripts/wine-strip-estimates.mjs --apply    적용
//
// 걷는 것: result.tasteProfile + result.tasteEstimated  (tasteEstimated == true 인 것만 — 품종·종류에서 우리가 짐작한 맛 수치)
// 두는 것: 이름·주종·가격대(priceBand, 화면이 "예상 가격대"로 밝힌다)·종류·나라·지역 같은 출처에서 온 값, 사진, 이야기가 있는 4종(손대지 않음)
// 되돌리기: 원래 값을 문서의 strippedEstimates 와 data/backup/ 에 둔다.
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const q = {
  category: "wine", notDrink: { $ne: true }, dupeOf: { $in: [null, ""] },
  "verified.by": { $exists: false }, enrichedBy: { $exists: false },      // 웹 조사도 구조화 채우기도 안 된 와인
  "result.tasteEstimated": true,                                           // 추정이라고 우리가 표시해 둔 맛 수치만
  strippedEstimates: { $exists: false },
};
const docs = await col.find(q, { projection: { name: 1, key: 1, tier: 1, "result.tasteProfile": 1, "result.tasteEstimated": 1 } }).toArray();
console.log(`추정 맛 수치를 걷을 와인 ${docs.length}종 (tier: ${JSON.stringify(docs.reduce((a, d) => ((a[d.tier] = (a[d.tier] || 0) + 1), a), {}))})`);
for (const d of docs.slice(0, 3)) console.log(`  예) ${d.name}  ${JSON.stringify(d.result?.tasteProfile)}`);

if (APPLY) {
  mkdirSync("data/backup", { recursive: true });
  writeFileSync("data/backup/wine-estimates-2026-10-02.json", JSON.stringify(docs.map((d) => ({ _id: d._id, name: d.name, tasteProfile: d.result?.tasteProfile, tasteEstimated: d.result?.tasteEstimated })), null, 0), "utf8");
  const at = new Date();
  const ops = docs.map((d) => ({
    updateOne: {
      filter: { _id: d._id },
      update: {
        $unset: { "result.tasteProfile": "", "result.tasteEstimated": "" },
        $set: { strippedEstimates: { at, by: "accuracy-cleanup", reason: "출처 없는 와인의 추정 맛 수치를 걷음 — 이름 색인으로 유지", tasteProfile: d.result?.tasteProfile ?? null, tasteEstimated: true } },
      },
    },
  }));
  const r = ops.length ? await col.bulkWrite(ops, { ordered: false }) : { modifiedCount: 0 };
  console.log(`\n적용 — ${r.modifiedCount}종 (백업: data/backup/wine-estimates-2026-10-02.json, 문서의 strippedEstimates)`);
} else console.log("\n보기만 했습니다. 적용하려면 --apply");
await client.close();
process.exit(0);
