// 눈 확인에서 거절된 사진의 옛 주소를 DB 에서 걷는다 — 틀린 사진이 보이는 것보다 없는 편이 낫다.
//
//   node --env-file=.env.local scripts/images-clean-rejected.mjs            보기만
//   node --env-file=.env.local scripts/images-clean-rejected.mjs --apply    적용
//
// 걷는 것
//  · 거절(rejected) 중 이름과 다른 사진이거나(mismatch) 상품이 아니거나(not_product) 판단이 안 되는(unclear) 것
//  · 받기 실패(failed) 중 주소가 죽은 것(HTTP 4xx·5xx)
//  단, DB 의 image 가 그 거절된 후보와 같은 주소일 때만. 다른 사진이 걸려 있으면 건드리지 않는다.
// 두는 것
//  · 같은 상품이지만 문구·워터마크·화질 때문에 거른 것(match+…) — 사진은 맞다. 받기 실패 중 너무 작거나 큰 것.
// 되돌리기: 걷은 주소와 이유를 문서의 imageRejected 와 data/backup/ 에 둔다.
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { readManifest } from "./_manifest-lib.mjs";

const APPLY = process.argv.includes("--apply");
const m = Object.values(readManifest());
const WRONG = /^(unclear|not_product|mismatch)/;
// 원래 출처(판매처·네이버쇼핑)에서 받으려던 시도가 전부 HTTP 4xx·5xx 면 죽은 주소다. 사진 찾기가 남긴 표시는 따지지 않는다.
const dead = (e) => {
  const own = (e.tries || []).filter((t) => t.source === "naver-shopping" || t.source === "dailyshot");
  return own.length > 0 && own.every((t) => /^HTTP [45]\d\d/.test(t.reason || ""));
};
const targets = m.filter((e) => (e.status === "rejected" && WRONG.test(e.rejectReason || "")) || (e.status === "failed" && dead(e)));
const keepFlawed = m.filter((e) => e.status === "rejected" && !WRONG.test(e.rejectReason || "")).length;
console.log(`거절·실패 사진 중 걷을 후보 ${targets.length}건 (거절 ${targets.filter((e) => e.status === "rejected").length} · 죽은 주소 ${targets.filter((e) => e.status === "failed").length}) · 두는 것 — 같은 상품이나 흠이 있어 거른 ${keepFlawed}건`);

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ name: { $in: targets.map((e) => e.name) } }, { projection: { name: 1, image: 1, "result.image": 1, imageRejected: 1 } }).toArray();
const byName = new Map(docs.map((d) => [d.name, d]));
// 주소 비교는 http/https 와 shop-phinf 호스트 표기 차이를 무시한다
const norm = (u) => String(u || "").replace(/^http:/, "https:").replace(/shopping\.phinf\.naver\.net/, "shopping-phinf.pstatic.net").replace(/shop\d*\.phinf\.naver\.net/, "shop-phinf.pstatic.net");

const ops = [], backup = [], reasons = {}, byCat = {};
let differs = 0, noDoc = 0, already = 0;
for (const e of targets) {
  const d = byName.get(e.name);
  if (!d) { noDoc++; continue; }
  if (d.imageRejected) { already++; continue; }
  const cur = d.image || d.result?.image;
  if (!cur) continue;                                     // 이미 사진이 없다
  // 거절된 후보의 주소(origin), 받기 실패는 시도한 주소들(tries)과 비교한다
  const urls = e.status === "failed" ? (e.tries || []).filter((t) => t.source === "naver-shopping" || t.source === "dailyshot").map((t) => t.origin) : [e.origin];
  if (!urls.some((u) => norm(u) === norm(cur))) { differs++; continue; } // 다른 사진이 걸려 있다 — 건드리지 않는다
  const why = e.status === "failed" ? "죽은 주소" : e.rejectReason;
  reasons[why] = (reasons[why] || 0) + 1; byCat[e.category] = (byCat[e.category] || 0) + 1;
  backup.push({ _id: d._id, name: d.name, image: d.image ?? null, resultImage: d.result?.image ?? null, reason: why, source: e.rejectedSource || e.source });
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $unset: { image: "", "result.image": "" }, $set: { imageRejected: { url: cur, reason: why, note: e.rejectNote || null, source: e.rejectedSource || e.source || null, at: new Date() } } } } });
}
console.log(`걷을 문서 ${ops.length}종 · DB 에 다른 사진이 걸려 있어 건너뜀 ${differs} · 문서 없음 ${noDoc} · 이미 정리됨 ${already}`);
console.log("이유별:", JSON.stringify(Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8))));
console.log("주종별:", JSON.stringify(byCat));
if (APPLY && ops.length) {
  mkdirSync("data/backup", { recursive: true });
  writeFileSync("data/backup/images-rejected-2026-10-02.json", JSON.stringify(backup), "utf8");
  const r = await col.bulkWrite(ops, { ordered: false });
  console.log(`\n적용 — ${r.modifiedCount}종 (백업: data/backup/images-rejected-2026-10-02.json, 문서의 imageRejected)`);
} else if (!APPLY) console.log("\n보기만 했습니다. 적용하려면 --apply");
await client.close();
process.exit(0);
