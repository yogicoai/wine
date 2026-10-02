// 조사 결과가 반영된 문서가 앱이 기대하는 모양을 지키는지 전수 검사한다 (모델 호출 없음).
//   node --env-file=.env.local scripts/_validate-researched.mjs
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ "verified.by": "web-research" }, { projection: { name: 1, category: 1, tier: 1, result: 1, i18n: 1, i18nStale: 1, verified: 1 } }).toArray();

const probs = {};
const add = (k, d) => { (probs[k] ||= []).push(d.name); };
const STR = ["producer", "type", "region", "country", "alcohol", "tastingNotes", "story", "winery", "trivia", "pairingTip", "avoidPairing", "servingTemp", "servingNote", "aging", "basis"];
const BAD = /https?:\/\/|undefined|\[object|<\/?[a-z]+>|NaN|null\b/i;
for (const d of docs) {
  const r = d.result || {};
  for (const f of STR) if (r[f] != null) {
    if (typeof r[f] !== "string") add(`${f}: 문자열 아님`, d);
    else { if (BAD.test(r[f])) add(`${f}: 금지 패턴(주소·undefined·태그)`, d); if (!r[f].trim()) add(`${f}: 빈 문자열`, d); if (r[f].length > 700) add(`${f}: 너무 김`, d); }
  }
  if (r.specs != null && !(Array.isArray(r.specs) && r.specs.every((x) => x && typeof x.label === "string" && typeof x.value === "string"))) add("specs 형식", d);
  if (r.history != null && !(Array.isArray(r.history) && r.history.every((x) => x && typeof x.event === "string"))) add("history 형식", d);
  if (r.foodPairing != null && !(Array.isArray(r.foodPairing) && r.foodPairing.every((x) => x && typeof x.food === "string" && typeof x.why === "string"))) add("foodPairing 형식", d);
  if (Array.isArray(r.foodPairing) && r.foodPairing.length < 1 && d.tier === "full") add("full 인데 안주 없음", d);
  for (const f of ["tips", "similar", "tags"]) if (r[f] != null && !(Array.isArray(r[f]) && r[f].every((x) => typeof x === "string"))) add(`${f} 형식`, d);
  if (d.tier === "full" && !(r.story && r.tastingNotes)) add("full 인데 story/맛 없음", d);
  if (r.tasteProfile != null && !(Array.isArray(r.tasteProfile) && r.tasteProfile.every((x) => x && typeof x.axis === "string" && Number.isFinite(x.value)))) add("tasteProfile 형식", d);
  if (r.country && /[·\/,]|\s및\s/.test(r.country)) add("country 가 여러 나라", d);
  if (r.confidence != null && !(r.confidence >= 0 && r.confidence <= 100)) add("confidence 범위", d);
  // 번역이 낡았는데 남아 있는 필드 — 고친 필드의 번역은 지워져 있어야 한다
  for (const f of d.i18nStale || []) for (const lng of ["en", "ja"]) if (d.i18n?.[lng]?.[f] != null) add(`낡은 번역이 남음(${lng}.${f})`, d);
  if (!d.verified?.sources?.length && d.verified?.status === "verified") add("확정인데 출처 없음", d);
}
console.log(`검사 ${docs.length}종`);
const rows = Object.entries(probs).sort((a, b) => b[1].length - a[1].length);
if (!rows.length) console.log("문제 없음");
for (const [k, v] of rows) console.log(`  ${String(v.length).padStart(4)}건  ${k}  예: ${v.slice(0, 3).join(" / ")}`);
await client.close();
process.exit(0);
