// 겹쳐 들어간 두 항목을 하나로 — 남길 쪽(keep)은 그대로 두고, 숨길 쪽(drop)에만 있던 것(호스팅 사진·판매처 연결)을 옮긴 뒤 drop 을 dupeOf 로 숨긴다. 모델 호출 없음.
//   node --env-file=.env.local scripts/dupe-merge.mjs --cat sake --keep "<남길 이름>" --drop "<숨길 이름>" [--note "왜 겹쳤나"] [--apply]
// · keep 의 내용(이야기·확정 정보)은 덮지 않는다 — 비어 있는 칸만 drop 에서 채운다.
// · 사진은 keep 에 호스팅 사진이 없을 때만 옮기고, 사진 기록(manifest)에도 keep 이름으로 같은 사진을 적는다.
// · 바꾸기 전 값은 data/backup/dupe-merge-2026-10-02.json 에 덧붙여 남긴다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CAT = arg("--cat"), KEEP = arg("--keep"), DROP = arg("--drop"), NOTE = arg("--note", "같은 술이 표기 차이로 두 번 들어감"), APPLY = process.argv.includes("--apply");
if (!CAT || !KEEP || !DROP || KEEP === DROP) { console.error("--cat, --keep, --drop 이 필요합니다"); process.exit(2); }
const HOSTED = /cafe24\.com\/app\/img\/wine\/catalog\//;
const BACKUP = "data/backup/dupe-merge-2026-10-02.json";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const keep = await col.findOne({ name: KEEP, category: CAT }), drop = await col.findOne({ name: DROP, category: CAT });
if (!keep || !drop) { console.error(`찾지 못함 — keep ${!!keep} · drop ${!!drop}`); process.exit(1); }
if (drop.dupeOf) { console.log(`이미 숨겨져 있습니다 (dupeOf ${drop.dupeOf})`); process.exit(0); }

const set = {};
const movePhoto = !HOSTED.test(String(keep.image || "")) && HOSTED.test(String(drop.image || ""));
if (movePhoto) for (const k of ["image", "imageSource", "imageOrigin", "imageHash"]) if (drop[k]) set[k] = drop[k];
if (movePhoto && keep.image && keep.image !== drop.image) set.imagePrev = keep.image;
if (!keep.sourceFacts?.dailyshot && drop.sourceFacts?.dailyshot) set["sourceFacts.dailyshot"] = drop.sourceFacts.dailyshot;
if (!keep.priceBandBasis && drop.priceBandBasis && keep.priceBand === drop.priceBand) set.priceBandBasis = drop.priceBandBasis;
if (!keep.i18n?.en?.name && drop.i18n?.en?.name) set["i18n.en.name"] = drop.i18n.en.name;
const now = new Date();
const dropSet = { dupeOf: keep.name, dupeNote: `${NOTE} — '${keep.name}' 로 합침 (${now.toISOString().slice(0, 10)})`, updatedAt: now };

console.log(`남길 것: ${keep.name} (${keep.tier}${keep.verified?.by ? ", " + keep.verified.by + " " + (keep.verified.level || "") : ""})`);
console.log(`숨길 것: ${drop.name} (${drop.tier}${drop.registeredFrom ? ", " + drop.registeredFrom : ""})`);
console.log(`  남길 쪽에 채울 칸: ${Object.keys(set).join(", ") || "없음"}`);
if (!APPLY) { console.log("보기만 했습니다. 반영하려면 --apply"); await client.close(); process.exit(0); }

mkdirSync("data/backup", { recursive: true });
const log = existsSync(BACKUP) ? JSON.parse(readFileSync(BACKUP, "utf8")) : { note: "겹친 항목 합침 — 되돌리려면 drop 의 dupeOf·dupeNote 를 지우고 keep 의 before 값을 되돌린다", merges: [] };
log.merges.push({ at: now, category: CAT, keep: { name: keep.name, before: Object.fromEntries(Object.keys(set).map((k) => [k, k.split(".").reduce((o, p) => o?.[p], keep) ?? null])) }, drop: { name: drop.name, dupeOf: keep.name } });
writeFileSync(BACKUP, JSON.stringify(log, null, 1), "utf8");
if (Object.keys(set).length) await col.updateOne({ _id: keep._id }, { $set: { ...set, updatedAt: now } });
await col.updateOne({ _id: drop._id }, { $set: dropSet });
if (movePhoto) {
  const m = readManifest(), src = m[drop.name];
  if (src?.status === "live") {
    const prev = m[keep.name];
    m[keep.name] = { ...src, name: keep.name, mergedFrom: drop.name, at: now.toISOString(), ...(prev ? { replaced: { status: prev.status, source: prev.source || null, rejectReason: prev.rejectReason || null } } : {}) };
    await mergeSave(m, new Set([keep.name]));
  }
}
console.log(`반영했습니다 — ${drop.name} 숨김, ${keep.name} 에 ${Object.keys(set).length}칸 (백업 ${BACKUP})`);
await client.close();
process.exit(0);
