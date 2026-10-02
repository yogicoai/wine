// 기계번역 결과를 검증해서 문서의 번역층(i18n.<언어>)에 넣는다. 믿을 수 없는 필드는 넣지 않는다 — 그 필드는 한국어 원문으로 보인다.
//
//   node --env-file=.env.local scripts/i18n-import.mjs --lang en [--fields a,b] [--scope stale] [--thr 0.45] [--cov 0.6] [--apply]
//   node --env-file=.env.local scripts/i18n-import.mjs --finalize [--apply]     i18nStale 정리 (두 언어가 다 채워진 필드를 뺀다)
//
// 입력: <MT_DIR>/units.jsonl (i18n-export) · out-<언어>.jsonl (정번역) · back-<언어>.jsonl (역번역: 번역을 다시 한국어로 옮긴 것)
// 문장마다 검증한다
//   1) 기본 검사 — 한글 잔존·숫자(연도·도수·비율)·길이·반복·영문 고유명사 (_lib.mjs check)
//   2) 역번역 — 번역을 다시 한국어로 옮긴 글이 원문과 닮았는가 (문자 n-gram 일치도 ≥ --thr) 그리고 원문의 내용어(두 글자 어간)가 되살아났는가 (≥ --cov)
// 필드의 문장 하나라도 통과하지 못하면 그 필드는 통째로 넣지 않는다. 넣은 번역은 i18nMeta.<언어> 에 엔진·시각·필드를 남긴다.
import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "node:fs";
import { ALL_FIELDS, MT_DIR, check, chrf, mapField, tidy, uid } from "./mt/_lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes("--apply");
const FINALIZE = process.argv.includes("--finalize");
const NO_BACK = process.argv.includes("--no-back");
const LANG = arg("--lang");
const SCOPE = arg("--scope", "stale");
const THR = Number(arg("--thr", 0.45)), COV = Number(arg("--cov", 0.6));
const FIELDS = arg("--fields") ? arg("--fields").split(",").filter((f) => ALL_FIELDS.includes(f)) : ALL_FIELDS;
const ENGINE = "nllb-200-distilled-1.3B-ct2-int8+roundtrip";
const jl = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

if (FINALIZE) {
  const docs = await col.find({ i18nStale: { $exists: true, $ne: [] } }, { projection: { result: 1, i18n: 1, i18nStale: 1 } }).toArray();
  const ops = []; let cleared = 0, shrunk = 0;
  for (const d of docs) {
    const rest = d.i18nStale.filter((f) => { const v = d.result?.[f]; if (v == null || v === "" || (Array.isArray(v) && !v.length)) return false; return !(d.i18n?.en?.[f] != null && d.i18n?.ja?.[f] != null); });
    if (rest.length === d.i18nStale.length) continue;
    if (!rest.length) { cleared++; ops.push({ updateOne: { filter: { _id: d._id }, update: { $unset: { i18nStale: "" } } } }); }
    else { shrunk++; ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { i18nStale: rest } } } }); }
  }
  console.log(`i18nStale 정리 — 모두 번역돼 비운 문서 ${cleared} · 일부만 남은 문서 ${shrunk} (대상 ${docs.length})`);
  if (APPLY && ops.length) { const r = await col.bulkWrite(ops, { ordered: false }); console.log(`적었습니다 — ${r.modifiedCount}종`); } else if (!APPLY) console.log("보기만 했습니다. 적으려면 --apply");
  await client.close(); process.exit(0);
}

if (!["en", "ja"].includes(LANG)) throw new Error("--lang en|ja 가 필요합니다");
const units = new Map(jl(arg("--units", `${MT_DIR}/units.jsonl`)).map((u) => [u.id, u.text]));
const fwd = new Map(jl(arg("--fwd", `${MT_DIR}/out-${LANG}.jsonl`)).map((r) => [r.id, r.out]));
const back = new Map(jl(arg("--back", `${MT_DIR}/back-${LANG}.jsonl`)).map((r) => [r.id, r.out]));
console.log(`[${LANG}] 문장 ${units.size}개 중 정번역 ${fwd.size} · 역번역 ${back.size} · 기준: 일치도 ≥ ${THR}, 어간 ≥ ${COV}${NO_BACK ? " (역번역 검증 끔)" : ""}`);

const stems = (s) => String(s).normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((w) => /[가-힣]/.test(w) && w.length >= 2).map((w) => w.slice(0, 2));
const coverage = (src, bk) => { const ss = stems(src); if (!ss.length) return 1; const b = String(bk).normalize("NFKC"); return ss.filter((x) => b.includes(x)).length / ss.length; };

const ok = new Map(), why = {}; const sims = [];
for (const [id, out] of fwd) {
  const src = units.get(id); if (!src) continue;
  const t = tidy(out, LANG);
  let reason = check(src, t, LANG);
  if (!reason && !NO_BACK) {
    const bk = back.get(id);
    if (bk == null) reason = "역번역 없음";
    else { const s = chrf(src, bk), c = coverage(src, bk); sims.push(s); if (s < THR) reason = `역번역 일치도 낮음`; else if (c < COV) reason = `역번역에서 내용어가 사라짐`; }
  }
  if (reason) { const k = reason.replace(/\d+/g, "N").replace(/[A-Za-z’'\-]{4,}/g, "X").slice(0, 22); (why[k] ||= []).push({ src, out: t }); } else ok.set(id, t);
}
const bad = fwd.size - ok.size;
console.log(`검증 통과 ${ok.size} · 거른 문장 ${bad} (${fwd.size ? Math.round((bad / fwd.size) * 100) : 0}%)`);
for (const [k, v] of Object.entries(why).sort((a, b) => b[1].length - a[1].length).slice(0, 8)) console.log(`   ${String(v.length).padStart(5)}  ${k}   예: ${v[0].src.slice(0, 34)} → ${v[0].out.slice(0, 50)}`);

// 문서에 조립
const q = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, result: { $exists: true } };
if (SCOPE === "stale") q.$or = [{ i18nStale: { $exists: true, $ne: [] } }, { enrichedBy: "dailyshot-structured" }];
const docs = await col.find(q, { projection: { name: 1, result: 1, i18n: 1 } }).toArray();
const ops = [], per = {}, failed = {}; let nDocs = 0, nFields = 0;
const samples = [];
for (const d of docs) {
  const set = {}, fields = [];
  for (const f of FIELDS) {
    const v = d.result?.[f];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (d.i18n?.[LANG]?.[f] != null) continue;
    const t = mapField(f, v, (s) => ok.get(uid(s)) ?? null, LANG);
    if (t == null) { failed[f] = (failed[f] || 0) + 1; continue; }
    set[`i18n.${LANG}.${f}`] = t; fields.push(f); per[f] = (per[f] || 0) + 1; nFields++;
  }
  if (!fields.length) continue;
  nDocs++;
  if (samples.length < 4 && fields.includes("story")) samples.push({ name: d.name, story: set[`i18n.${LANG}.story`], ko: d.result.story });
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { ...set, [`i18nMeta.${LANG}.engine`]: ENGINE, [`i18nMeta.${LANG}.at`]: new Date() }, $addToSet: { [`i18nMeta.${LANG}.fields`]: { $each: fields } } } } });
}
console.log(`\n번역층에 넣을 필드 ${nFields}개 (문서 ${nDocs}개)`);
console.log("필드별 넣음:", JSON.stringify(per));
console.log("통과 못 해 한국어로 남는 필드(이번 범위):", JSON.stringify(failed));
for (const s of samples) console.log(`\n■ ${s.name}\n  ko: ${String(s.ko).slice(0, 120)}\n  ${LANG}: ${String(s.story).slice(0, 220)}`);
if (APPLY && ops.length) { const r = await col.bulkWrite(ops, { ordered: false }); console.log(`\n적었습니다 — ${r.modifiedCount}종`); }
else if (!APPLY) console.log("\n보기만 했습니다. 적으려면 --apply");
await client.close();
process.exit(0);
