// 웹 조사로 검증한 술의 빈칸 중, 판매처(데일리샷) 짝이 꽉 맞는 것만 비용 없이 채운다 — 모델 호출 없음.
//
//   node --env-file=.env.local scripts/verified-seller-fill.mjs            보기만
//   node --env-file=.env.local scripts/verified-seller-fill.mjs --apply    적기 (채운 목록을 data/backup/verified-seller-fill-2026-10-02.json 에 남긴다)
//
// 채우는 칸 (비어 있을 때만, 덮어쓰지 않는다)
//   i18n.en.name     판매처 영문 상품명 (도수·용량 꼬리를 떼고, 한글이 섞이면 쓰지 않는다) — 영어 화면의 이름
//   result.pairingTip    "판매처가 추천하는 음식: …"
//   result.tastingNotes  판매처 노트의 낱말 (향·맛·여운) — 문장은 베끼지 않는다
// 국가·도수·지역·종류는 채우지 않는다 — 웹 조사가 확인하지 못해 비워 둔 것일 수 있다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const BACKUP = "data/backup/verified-seller-fill-2026-10-02.json";
const GEN = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리)/g;
const core = (s) => String(s || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ").replace(/\b(19|20)\d{2}\b/g, " ").replace(GEN, " ").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const blank = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, "verified.by": "web-research", "sourceFacts.dailyshot.name": { $exists: true } }, { projection: { name: 1, result: 1, "i18n.en.name": 1, "sourceFacts.dailyshot": 1 } }).toArray();
const now = new Date(), ops = [], log = [];
const st = { docs: docs.length, tight: 0, en: 0, tip: 0, notes: 0 };
for (const d of docs) {
  const ds = d.sourceFacts.dailyshot;
  if (!(core(d.name) && core(d.name) === core(ds.name))) continue;
  st.tight++;
  const r = d.result || {}, set = {}, fields = [];
  const en = String(ds.enName || "").replace(/\s*\d+(\.\d+)?\s*(%|ml|l|도)(?=\s|$)/gi, " ").replace(/\s*,\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (en && !/[가-힣]/.test(en) && !d.i18n?.en?.name) { set["i18n.en.name"] = en; fields.push("i18n.en.name"); st.en++; }
  if (blank(r.pairingTip) && typeof ds.pairingFoods === "string" && ds.pairingFoods.trim()) { set["result.pairingTip"] = `판매처가 추천하는 음식: ${ds.pairingFoods.trim()}`; fields.push("pairingTip"); st.tip++; }
  const notes = (ds.tastingNotes || []).filter((n) => n?.label && n?.value).map((n) => `${n.label}: ${String(n.value).trim()}`);
  if (blank(r.tastingNotes) && notes.length) { set["result.tastingNotes"] = notes.join(" / "); fields.push("tastingNotes"); st.notes++; }
  if (!fields.length) continue;
  set.sellerFill = { at: now, source: "dailyshot", url: ds.url || null, fields };
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: set } } });
  log.push({ _id: d._id, name: d.name, fields, en: set["i18n.en.name"] || null });
}
console.log(`검증된 술 중 판매처 짝 ${st.docs} · 꽉 맞는 짝 ${st.tight} → 채울 문서 ${ops.length}종 (영문명 ${st.en} · 어울리는 음식 ${st.tip} · 시음 노트 ${st.notes})`);
console.log("영문명 예:", log.filter((x) => x.en).slice(0, 8).map((x) => `${x.name} → ${x.en}`).join(" | "));
if (!APPLY) { console.log("보기만 했습니다. 적으려면 --apply"); await client.close(); process.exit(0); }
mkdirSync("data/backup", { recursive: true });
if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있습니다 — 두 번 적지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, note: "비어 있던 칸만 채웠다 — 되돌리려면 fields 의 칸을 지우면 된다", docs: log }, null, 1), "utf8");
const res = await col.bulkWrite(ops, { ordered: false });
console.log(`적었습니다 — ${res.modifiedCount}종 (목록 ${BACKUP})`);
await client.close();
process.exit(0);
