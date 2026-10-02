// 지금까지의 성과를 한 번에 센다 — 중간 점검과 최종 보고용.
//   node --env-file=.env.local scripts/_report.mjs
import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "node:fs";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const base = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };

console.log("═══ 정보 조사 (catalog.verified) ═══");
const byCat = await col.aggregate([
  { $match: base },
  { $group: {
    _id: "$category",
    total: { $sum: 1 },
    verified: { $sum: { $cond: [{ $eq: ["$verified.by", "web-research"] }, 1, 0] } },
    A: { $sum: { $cond: [{ $eq: ["$verified.level", "A"] }, 1, 0] } },
    B: { $sum: { $cond: [{ $eq: ["$verified.level", "B"] }, 1, 0] } },
    C: { $sum: { $cond: [{ $eq: ["$verified.level", "C"] }, 1, 0] } },
    corr: { $sum: { $size: { $ifNull: ["$verified.corrections", []] } } },
    rem: { $sum: { $size: { $ifNull: ["$verified.removed", []] } } },
  } },
  { $sort: { total: -1 } },
]).toArray();
let T = { total: 0, verified: 0, A: 0, B: 0, C: 0, corr: 0, rem: 0 };
for (const r of byCat) {
  for (const k of Object.keys(T)) T[k] += r[k];
  console.log(`  ${String(r._id).padEnd(12)} 전체 ${String(r.total).padStart(5)} · 검증 ${String(r.verified).padStart(4)} (${r.total ? Math.round((r.verified / r.total) * 100) : 0}%) · 등급 A ${r.A} B ${r.B} C ${r.C} · 고침 ${r.corr} · 뺌 ${r.rem}`);
}
console.log(`  합계         전체 ${T.total} · 검증 ${T.verified} (${Math.round((T.verified / T.total) * 100)}%) · A ${T.A} B ${T.B} C ${T.C} · 고침 ${T.corr} · 뺌 ${T.rem}` + (T.verified ? ` · 항목당 고침 ${(T.corr / T.verified).toFixed(1)}` : ""));
const stale = await col.countDocuments({ ...base, i18nStale: { $exists: true, $ne: [] } });
console.log(`  번역이 낡아 지워진 항목(다시 번역 필요): ${stale}`);

console.log("\n═══ 판매처 대조 (sourceFacts.dailyshot) ═══");
console.log(`  판매처 정보가 붙은 항목: ${await col.countDocuments({ ...base, "sourceFacts.dailyshot.name": { $exists: true } })}`);

console.log("\n═══ 사진 (data/images/manifest.json) ═══");
if (existsSync("data/images/manifest.json")) {
  const m = Object.values(JSON.parse(readFileSync("data/images/manifest.json", "utf8")));
  const st = {};
  for (const e of m) st[e.status] = (st[e.status] || 0) + 1;
  console.log("  상태별: " + Object.entries(st).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
  const live = m.filter((e) => e.status === "live");
  const lc = {}, ls = {};
  for (const e of live) { lc[e.category] = (lc[e.category] || 0) + 1; ls[e.source] = (ls[e.source] || 0) + 1; }
  console.log("  공개된 사진 주종별: " + Object.entries(lc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log("  공개된 사진 출처별: " + Object.entries(ls).map(([k, v]) => `${k} ${v}`).join(" · "));
  const rej = {};
  for (const e of m.filter((x) => x.status === "rejected")) rej[e.rejectReason] = (rej[e.rejectReason] || 0) + 1;
  if (Object.keys(rej).length) console.log("  거른 사유: " + Object.entries(rej).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
  const bytes = live.reduce((a, e) => a + (e.bytes || 0), 0);
  console.log(`  호스팅에 올린 용량: ${(bytes / 1048576).toFixed(1)} MB (${live.length}장)`);
}
const withCafe = await col.countDocuments({ ...base, image: /yogibo\.openhost\.cafe24\.com\/app\/img\/wine\/catalog\// });
console.log(`  DB 에서 우리 호스팅 주소를 가리키는 항목: ${withCafe} / ${await col.countDocuments(base)}`);

console.log("\n═══ 사용률 ═══");
if (existsSync("data/research/_work/usage.jsonl")) {
  const rows = readFileSync("data/research/_work/usage.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const f = rows[0], l = rows[rows.length - 1];
  const p = (x) => (x == null ? "?" : `${Math.round(x * 100)}%`);
  console.log(`  첫 측정 ${f.at.slice(0, 16)}Z 주간 ${p(f.sevenDay)} · 5시간 ${p(f.fiveHour)}`);
  console.log(`  마지막 ${l.at.slice(0, 16)}Z 주간 ${p(l.sevenDay)} · 5시간 ${p(l.fiveHour)}  (측정 ${rows.length}번)`);
}
await client.close();
process.exit(0);
