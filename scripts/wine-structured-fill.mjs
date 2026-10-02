// 와인 나머지 — 모델 없이, 이미 받아 둔 판매처(데일리샷) 구조화 정보로 비어 있는 필드를 채운다.
//
//   node --env-file=.env.local scripts/wine-structured-fill.mjs            보기만
//   node --env-file=.env.local scripts/wine-structured-fill.mjs --apply    DB 에 적기
//
// 원칙
//  · 조사(웹 검색)로 확인한 항목(verified.by == web-research)은 건드리지 않는다.
//  · 우리 이름과 판매처 이름이 "꽉 맞는" 짝(부피·연도·도수·일반 낱말을 걷은 이름이 같음)만 쓴다. 변종이 섞인 짝은 쓰지 않는다.
//  · 비어 있는 필드만 채운다 — 이미 있는 글은 덮어쓰지 않는다. 판매처의 서술문은 베끼지 않고 사실(지역·품종·수치·노트 낱말)만 옮긴다.
//  · 맛 수치(tasteProfile)는 우리가 추정한 값(tasteEstimated)이면 판매처의 실제 값(1~5 → 20~100)으로 바꾼다.
//  · tier 는 stub 그대로 둔다 — 이야기가 없는 항목을 정식 분석으로 올리지 않는다. 출처를 basis 에 적는다.
//  · 어떤 필드를 채웠는지 structuredFill 에 남긴다 (되돌릴 수 있게).
import { MongoClient } from "mongodb";
import { abvNum, canonCountry } from "./_facts-lib.mjs";

const APPLY = process.argv.includes("--apply");
const REDO = process.argv.includes("--redo");
const SHOW = Number(process.argv[process.argv.indexOf("--show") + 1] || 4);
// --category wine(기본) | nonwine(와인 밖 전부) | beer,traditional 처럼 여럿. 와인 밖은 판매처 칸이 다르다:
//   품종 대신 종류(약주·라거 등)·용량·도수·국가가 오고, 맛 수치 축이 와인과 달라 맛 수치는 옮기지 않는다.
const CAT = process.argv.includes("--category") ? process.argv[process.argv.indexOf("--category") + 1] : "wine";

const GEN = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리)/g;
const core = (s) =>
  String(s || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ").replace(GEN, " ").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const catQ = CAT === "wine" ? "wine" : CAT === "nonwine" ? { $ne: "wine" } : { $in: CAT.split(",") };
const q = { category: catQ, notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, "verified.by": { $exists: false }, "sourceFacts.dailyshot.name": { $exists: true } };
if (!REDO) q.enrichedBy = { $ne: "dailyshot-structured" };
const docs = await col.find(q, { projection: { name: 1, category: 1, result: 1, i18n: 1, "sourceFacts.dailyshot": 1 } }).toArray();

const blank = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
const AXIS = { 바디: "바디", 당도: "당도", 산미: "산도", 타닌: "탄닌" };
const writes = [], samples = [];
const stat = { docs: docs.length, tight: 0, region: 0, country: 0, alcohol: 0, type: 0, specs: 0, taste: 0, notes: 0, tip: 0, enName: 0, skippedLoose: 0 };

for (const d of docs) {
  const ds = d.sourceFacts.dailyshot;
  if (!(core(d.name) && core(d.name) === core(ds.name))) { stat.skippedLoose++; continue; }
  stat.tight++;
  const r = d.result || {}, f = ds.facts || {};
  const info = Object.fromEntries((ds.information || []).filter((x) => x?.label).map((x) => [x.label, String(x.value ?? "").trim()]));
  const set = {}, filled = [];

  if (blank(r.region) && info["지역"]) { set["result.region"] = info["지역"].replace(/\s*>\s*/g, " · "); filled.push("region"); stat.region++; }
  if (blank(r.country) && f.country) { const c = canonCountry(f.country) ? f.country : null; if (c) { set["result.country"] = f.country; filled.push("country"); stat.country++; } }
  if (blank(r.alcohol) && f.abv && abvNum(f.abv) != null) { set["result.alcohol"] = f.abv; filled.push("alcohol"); stat.alcohol++; }
  if (blank(r.type) && f.type) { set["result.type"] = f.type; filled.push("type"); stat.type++; }

  // 상세(specs) — 품종·용량·비비노 평점 (사실만)
  if (blank(r.specs)) {
    const specs = [];
    if (info["품종"]) specs.push({ label: "품종", value: info["품종"] });
    if (f.volume) specs.push({ label: "용량", value: f.volume });
    const v = ds.vivino;
    if (v?.score && v?.review_count) specs.push({ label: "Vivino 평점", value: `${Number(v.score).toFixed(1)} (평가 ${Number(v.review_count).toLocaleString("ko-KR")}건${v.score_date ? `, ${String(v.score_date).slice(0, 7)} 기준` : ""})` });
    if (specs.length) { set["result.specs"] = specs; filled.push("specs"); stat.specs++; }
  }

  // 맛 수치 — 우리가 추정한 값이면 판매처의 실제 값으로
  const tastes = Object.fromEntries((ds.tastes || []).filter((t) => AXIS[t.label] && Number.isFinite(Number(t.value))).map((t) => [AXIS[t.label], Math.max(0, Math.min(100, Math.round(Number(t.value) * 20)))]));
  if (d.category === "wine" && Object.keys(tastes).length >= 3 && (r.tasteEstimated !== false)) {
    const prof = Array.isArray(r.tasteProfile) && r.tasteProfile.length ? r.tasteProfile.map((a) => ({ ...a })) : [];
    for (const [axis, val] of Object.entries(tastes)) { const a = prof.find((x) => x.axis === axis); if (a) a.value = val; else prof.push({ axis, value: val }); }
    set["result.tasteProfile"] = prof; set["result.tasteEstimated"] = false; filled.push("tasteProfile"); stat.taste++;
  }

  // 시음 노트 — 판매처 노트의 낱말만 (문장은 베끼지 않는다)
  const notes = (ds.tastingNotes || []).filter((n) => n?.label && n?.value).map((n) => `${n.label}: ${String(n.value).trim()}`);
  if (blank(r.tastingNotes) && notes.length) { set["result.tastingNotes"] = notes.join(" / "); filled.push("tastingNotes"); stat.notes++; }

  // 어울리는 음식 — 한 줄
  const foods = typeof ds.pairingFoods === "string" ? ds.pairingFoods.trim() : "";
  if (blank(r.pairingTip) && foods) { set["result.pairingTip"] = `판매처가 추천하는 음식: ${foods}`; filled.push("pairingTip"); stat.tip++; }

  // 영어 이름 — 영어 화면용 번역층의 name
  // 와인 밖 술은 판매처 영문명에 도수·용량이 붙어 오고("… 18.6%"), 한글 그대로인 것도 있다 — 떼고, 한글이면 쓰지 않는다
  const en = String(ds.enName || "").replace(/\s*\d+(\.\d+)?\s*(%|ml|l|도)(?=\s|$)/gi, " ").replace(/\s*,\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (en && !/[가-힣]/.test(en) && !d.i18n?.en?.name) { set["i18n.en.name"] = en; filled.push("i18n.en.name"); stat.enName++; }

  if (!filled.length) continue;
  if (blank(r.basis)) set["result.basis"] = "판매처(데일리샷)의 구조화 정보 기준이며 웹 조사로 따로 확인하지는 않았습니다.";
  set.enrichedBy = "dailyshot-structured"; set.enrichedAt = new Date();
  set.structuredFill = { at: new Date(), source: "dailyshot", url: ds.url || null, fields: filled };
  // 번역이 있던 필드를 새로 채웠다면 낡은 번역을 지운다 (덮어쓴 것은 없지만, 비어 있던 자리라 번역도 없다 — 안전하게)
  writes.push({ updateOne: { filter: { _id: d._id }, update: { $set: set } } });
  if (samples.length < SHOW) samples.push({ name: d.name, ds: ds.name, filled, set });
}

console.log(`대상 ${stat.docs}종 (판매처 짝이 있고 조사 안 된 술 · 주종 ${CAT}) — 꽉 맞는 짝 ${stat.tight} · 변종 가능성으로 건너뜀 ${stat.skippedLoose}`);
console.log(`채우는 필드: 지역 ${stat.region} · 국가 ${stat.country} · 도수 ${stat.alcohol} · 종류 ${stat.type} · 상세(품종·용량·평점) ${stat.specs} · 맛 수치 ${stat.taste} · 시음 노트 ${stat.notes} · 어울리는 음식 ${stat.tip} · 영문명 ${stat.enName}`);
console.log(`적용 대상 문서 ${writes.length}종`);
for (const s of samples) { console.log(`\n■ ${s.name}  ⇢ ${s.ds}\n  채움: ${s.filled.join(", ")}`); for (const [k, v] of Object.entries(s.set)) if (/^result\.(region|specs|tastingNotes|pairingTip|tasteProfile)|i18n/.test(k)) console.log(`   ${k}: ${JSON.stringify(v).slice(0, 170)}`); }

if (APPLY && writes.length) { const r = await col.bulkWrite(writes, { ordered: false }); console.log(`\n적었습니다 — ${r.modifiedCount}종`); }
else if (!APPLY) console.log("\n보기만 했습니다. 적으려면 --apply");
await client.close();
process.exit(0);
