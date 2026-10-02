// 조사 결과를 DB 에 적는다 — 확인된 것만, 근거와 함께.
//
//   node --env-file=.env.local scripts/research-apply.mjs                      보기만 (기본)
//   node --env-file=.env.local scripts/research-apply.mjs --apply              실제로 적기
//   node --env-file=.env.local scripts/research-apply.mjs --prefix pilot-      이 접두사 파일만
//
// 에이전트가 data/research/_work/out/*.json 에 쓴 결과를 읽는다.
//
// 걸러내는 것
//   · 이름이 카탈로그에 없는 항목 — 새로 만들지 않는다
//   · 글 안에 주소(http)가 들어간 것 — 출처는 sources 에만 둔다
//   · 형식이 틀린 필드 (배열이어야 하는데 문자열 등)
//   · 도수가 판매처 정보와 1%p 넘게 어긋나는 것 — 적용하지 않고 따로 보고한다
//
// 고친 필드의 번역은 지운다. 번역은 한국어 위에 겹쳐 둔 층(i18n.en/ja)이라 한국어만 고치면
// 낡은 번역이 남는다. 지우면 화면이 원문(한국어)으로 돌아가 안전하다. 어느 필드를 지웠는지는
// i18nStale 에 적어 두어 나중에 다시 번역할 수 있다.

import { MongoClient } from "mongodb";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { abvNum, canonCountry } from "./_facts-lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes("--apply");
const PREFIX = arg("--prefix", "");
const DIR = arg("--dir", "data/research/_work/out");
const SHOW = Number(arg("--show", 8));

const STR = ["producer", "type", "region", "country", "alcohol", "tastingNotes", "story", "winery", "trivia",
  "pairingTip", "avoidPairing", "servingTemp", "servingNote", "aging", "basis", "drinkFrom", "drinkPeak", "drinkUntil"];
const MAXLEN = { tastingNotes: 360, story: 520, winery: 360, trivia: 360, pairingTip: 240, avoidPairing: 240, servingNote: 240, aging: 200, basis: 240 };
const ARR_STR = ["tips", "similar", "tags"];
const KNOW = new Set(["rich", "moderate", "limited"]);
const TRANSLATED = ["type", "region", "country", "basis", "tastingNotes", "story", "winery", "pairingTip", "avoidPairing",
  "trivia", "servingTemp", "servingNote", "aging", "tips", "specs", "history", "foodPairing"];

const bad = (s) => typeof s === "string" && /https?:\/\//i.test(s);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n))));

function cleanResult(r, problems) {
  const out = {};
  for (const f of STR) {
    if (r[f] === undefined) continue;
    if (r[f] === null) { out[f] = null; continue; }
    if (typeof r[f] !== "string") { problems.push(`${f}: 문자열 아님`); continue; }
    const s = r[f].trim();
    if (bad(s)) { problems.push(`${f}: 주소가 들어 있음`); continue; }
    if (MAXLEN[f] && s.length > MAXLEN[f]) { problems.push(`${f}: 너무 김 ${s.length}`); continue; }
    out[f] = s;
  }
  if (r.vintage !== undefined) out.vintage = r.vintage === null || r.vintage === "" ? null : String(r.vintage);
  for (const f of ARR_STR) {
    if (r[f] === undefined) continue;
    if (!Array.isArray(r[f]) || r[f].some((x) => typeof x !== "string" || bad(x))) { problems.push(`${f}: 문자열 배열 아님`); continue; }
    out[f] = r[f].map((x) => x.trim()).filter(Boolean).slice(0, f === "tags" ? 8 : 6);
  }
  if (r.specs !== undefined) {
    if (Array.isArray(r.specs) && r.specs.every((x) => x && typeof x.label === "string" && typeof x.value === "string" && !bad(x.value))) {
      out.specs = r.specs.map((x) => ({ label: x.label.trim(), value: x.value.trim() })).filter((x) => x.label && x.value).slice(0, 10);
    } else problems.push("specs: 형식 틀림");
  }
  if (r.history !== undefined) {
    if (Array.isArray(r.history) && r.history.every((x) => x && x.event && !bad(x.event))) {
      out.history = r.history.map((x) => ({ year: String(x.year ?? ""), event: String(x.event).trim() })).slice(0, 8);
    } else problems.push("history: 형식 틀림");
  }
  if (r.foodPairing !== undefined) {
    if (Array.isArray(r.foodPairing) && r.foodPairing.every((x) => x && x.food && x.why && !bad(x.why))) {
      out.foodPairing = r.foodPairing.map((x) => ({ emoji: x.emoji || "🍽️", food: String(x.food).trim(), why: String(x.why).trim(), shopKeyword: String(x.shopKeyword || x.food).trim() })).slice(0, 4);
    } else problems.push("foodPairing: 형식 틀림");
  }
  if (r.knowledge !== undefined) { if (KNOW.has(r.knowledge)) out.knowledge = r.knowledge; else problems.push("knowledge: 값 틀림"); }
  for (const f of ["confidence", "beginner"]) {
    if (r[f] === undefined) continue;
    if (Number.isFinite(Number(r[f]))) out[f] = clamp(r[f]); else problems.push(`${f}: 숫자 아님`);
  }
  return out;
}


// 이미 반영한 파일은 건너뛴다 (파일이 바뀌었으면 다시). 반영 기록: data/research/_work/applied.json — --all 로 전부 다시 한다.
const APPLIED = "data/research/_work/applied.json";
const applied = (() => { try { return JSON.parse(readFileSync(APPLIED, "utf8")); } catch { return {}; } })();
const mt = (f) => Math.round(statSync(`${DIR}/${f}`).mtimeMs);
const ALL = process.argv.includes("--all");
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json") && f.startsWith(PREFIX) && (ALL || applied[f] !== mt(f))) : [];
if (!files.length) { console.log(`반영할 새 결과 파일이 없습니다 — ${DIR} ${PREFIX ? `(접두사 ${PREFIX})` : ""}${ALL ? "" : " (이미 반영한 파일은 건너뜀, --all 로 전부)"}`); process.exit(0); }

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const stats = { files: files.length, badFiles: 0, entries: 0, applied: 0, skipped: 0, notFound: 0, verified: 0, partial: 0, unidentified: 0, notDrink: 0, corrections: 0, removed: 0, problems: 0, abvConflict: 0 };
const writes = [], samples = [], conflicts = [], overrides = [], junk = [], unid = [];

for (const f of files) {
  let data;
  try { data = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); } catch { stats.badFiles++; console.log(`  ✗ JSON 이 깨진 파일: ${f}`); continue; }
  for (const e of data.entries || []) {
    stats.entries++;
    if (!e?.name) { stats.skipped++; continue; }
    const doc = await col.findOne({ name: e.name }, { projection: { _id: 1, result: 1, category: 1, "sourceFacts.dailyshot.facts": 1 } });
    if (!doc) { stats.notFound++; console.log(`  ✗ 카탈로그에 없음: ${e.name}`); continue; }

    if (e.status === "not_a_drink") { stats.notDrink++; junk.push({ name: e.name, why: e.notes }); continue; }
    if (e.status === "unidentified") { stats.unidentified++; unid.push({ name: e.name, why: e.notes }); continue; }
    if (e.status !== "verified" && e.status !== "partial") { stats.skipped++; continue; }
    stats[e.status]++;

    const problems = [];
    const res = cleanResult(e.result || {}, problems);
    // 나라는 하나여야 한다 — 화면이 나라별로 묶고 깃발을 고른다. 여러 값이 이어 오면 첫 번째만 쓴다.
    if (typeof res.country === "string" && /[·\/,]|\s및\s/.test(res.country)) res.country = res.country.split(/\s*(?:[·\/,]|및)\s*/)[0].trim();

    // 판매처 정보와 어긋나는 도수·국가 — 조사 에이전트가 그 값의 출처를 댔으면 적용하고,
    // 대지 않았으면 보류한다. 판매처도 틀린다 (라벨 5 를 미국 제품으로 적어 둔 것처럼).
    const cited = (field) => (Array.isArray(e.sources) ? e.sources : []).some((s) => (s.used || []).some((u) => String(u).toLowerCase() === field));
    const ds = doc.sourceFacts?.dailyshot?.facts || {};
    const dsAbv = abvNum(ds.abv);
    if (res.alcohol && dsAbv != null) {
      const mine = abvNum(res.alcohol);
      if (mine != null && Math.abs(mine - dsAbv) > 1) {
        if (cited("alcohol")) overrides.push({ name: e.name, field: "도수", agent: res.alcohol, dailyshot: ds.abv });
        else { conflicts.push({ name: e.name, field: "도수", agent: res.alcohol, dailyshot: ds.abv }); delete res.alcohol; stats.abvConflict++; }
      }
    }
    if (res.country && ds.country && canonCountry(res.country) !== canonCountry(ds.country)) {
      if (cited("country")) overrides.push({ name: e.name, field: "국가", agent: res.country, dailyshot: ds.country });
      else { conflicts.push({ name: e.name, field: "국가", agent: res.country, dailyshot: ds.country }); delete res.country; stats.abvConflict++; }
    }
    if (problems.length) { stats.problems += problems.length; console.log(`  △ ${e.name}: ${problems.join(" · ")}`); }

    const set = {}, unset = {};
    for (const [k, v] of Object.entries(res)) {
      if (v === null) unset[`result.${k}`] = ""; else set[`result.${k}`] = v;
    }
    if (res.producer) set.producer = res.producer;
    if (res.vintage !== undefined) set.vintage = res.vintage;

    const changedFields = Object.keys(res);
    // 번역이 있던 필드는 지운다 — 낡은 번역이 남지 않게
    const stale = changedFields.filter((k) => TRANSLATED.includes(k));
    for (const k of stale) { unset[`i18n.en.${k}`] = ""; unset[`i18n.ja.${k}`] = ""; }

    // 정식 승격 — 이야기·맛·안주가 갖춰졌을 때
    const merged = { ...(doc.result || {}), ...res };
    const full = !!(merged.story && merged.tastingNotes && Array.isArray(merged.foodPairing) && merged.foodPairing.length);
    if (full) { set.tier = "full"; set["result.tier"] = "full"; set["result.tasteEstimated"] = false; }

    const corr = Array.isArray(e.corrections) ? e.corrections : [];
    const rem = Array.isArray(e.removed) ? e.removed : [];
    stats.corrections += corr.length; stats.removed += rem.length;
    const srcList = (Array.isArray(e.sources) ? e.sources : []).filter((s) => s?.url && /^https?:\/\//.test(s.url)).slice(0, 10)
      .map((s) => ({ url: s.url, title: String(s.title || "").slice(0, 120), used: Array.isArray(s.used) ? s.used.slice(0, 8) : [] }));
    // 출처를 하나도 대지 못한 "확정"은 확정이 아니다 — 부분(C)으로 낮춘다
    const status = e.status === "verified" && !srcList.length ? "partial" : e.status;
    const level = status === "verified" && res.knowledge === "rich" ? "A" : status === "verified" ? "B" : "C";
    set.verified = {
      at: new Date(), by: "web-research", status, level,
      sources: srcList,
      corrections: corr.slice(0, 12).map((c) => ({ field: c.field, was: String(c.was ?? "").slice(0, 160), now: String(c.now ?? "").slice(0, 160), why: String(c.why ?? "").slice(0, 160) })),
      removed: rem.slice(0, 8).map((c) => ({ field: c.field, claim: String(c.claim ?? "").slice(0, 160), why: String(c.why ?? "").slice(0, 120) })),
      notes: String(e.notes || "").slice(0, 400),
    };
    if (stale.length) set.i18nStale = stale;
    set.enrichedAt = new Date(); set.enrichedBy = "web-research";

    const upd = { $set: set };
    if (Object.keys(unset).length) upd.$unset = unset;
    writes.push({ updateOne: { filter: { _id: doc._id }, update: upd } });
    stats.applied++;
    if (samples.length < SHOW && corr.length) samples.push({ name: e.name, corr: corr.slice(0, 3) });
  }
}

console.log("");
console.log(`파일 ${stats.files}개(깨진 것 ${stats.badFiles}) · 항목 ${stats.entries}개`);
console.log(`  확정 ${stats.verified} · 부분 ${stats.partial} · 특정 못 함 ${stats.unidentified} · 술 아님 ${stats.notDrink} · 이름 없음 ${stats.notFound}`);
console.log(`  기존 정보 고침 ${stats.corrections}건 · 뺌 ${stats.removed}건 · 형식 문제 ${stats.problems}건 · 도수 충돌 ${stats.abvConflict}건`);
if (stats.verified + stats.partial) console.log(`  항목당 고침 ${(stats.corrections / (stats.verified + stats.partial)).toFixed(1)}건`);

if (samples.length) {
  console.log("\n── 고친 내용 예 ──");
  for (const s of samples) { console.log(`  ${s.name}`); s.corr.forEach((c) => console.log(`     [${c.field}] ${String(c.was).slice(0, 60)}  →  ${String(c.now).slice(0, 60)}\n        ${String(c.why).slice(0, 90)}`)); }
}
if (conflicts.length) { console.log("\n── 도수가 판매처와 어긋나 적용 안 함 ──"); conflicts.forEach((c) => console.log(`  ${c.name}: 조사 ${c.agent} ↔ 판매처 ${c.dailyshot}`)); }
if (junk.length) { console.log("\n── 술이 아니라고 보고된 것 ──"); junk.forEach((c) => console.log(`  ${c.name}: ${String(c.why).slice(0, 100)}`)); }
if (unid.length) { console.log("\n── 정체를 못 밝힌 것 ──"); unid.forEach((c) => console.log(`  ${c.name}: ${String(c.why).slice(0, 100)}`)); }

if (!APPLY) console.log(`\n눈으로만 봤습니다 (적용 대상 ${writes.length}종). 실제로 적으려면 --apply`);
else if (writes.length) {
  const r = await col.bulkWrite(writes, { ordered: false }); console.log(`\n적었습니다 — ${r.modifiedCount}종`);
  // 깨진 파일은 기록하지 않는다 — 다시 쓰이면 다시 읽는다
  for (const f of files) { try { JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); applied[f] = mt(f); } catch {} }
  writeFileSync(APPLIED, JSON.stringify(applied));
}

await client.close();
process.exit(0);
