// 이름 사전 — 우리 DB 에서 "한국어 이름 ↔ 원어 이름" 짝을 모은다 (번역 전에 고유명사를 원어로 바꿔 넣으려고).
//
//   node --env-file=.env.local scripts/mt/names-build.mjs
//
// 짝의 출처
//   1) 본문의 "한글 (Original)" 꼴 — 조사 에이전트가 고유명사에 원어를 괄호로 덧붙여 썼다 (영문은 en, 한자·가나는 ja)
//   2) 문서의 name ↔ i18n.en.name / i18n.ja.name
// 같은 한국어에 원어가 여럿이면 가장 많이 나온 것을 쓴다. 출력: <MT_DIR>/names.json  { en: {한글: 원어}, ja: {...} }
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { ALL_FIELDS, HANGUL, MT_DIR } from "./_lib.mjs";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ result: { $exists: true } }, { projection: { name: 1, result: 1, i18n: 1 } }).toArray();

const votes = { en: new Map(), ja: new Map() };
const vote = (lang, ko, o) => {
  ko = ko.trim().replace(/\s+/g, " "); o = o.trim();
  if (ko.length < 2 || ko.length > 24 || o.length < 2 || o.length > 60) return;
  const m = votes[lang].get(ko) || new Map(); m.set(o, (m.get(o) || 0) + 1); votes[lang].set(ko, m);
};
const strings = (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
// 괄호 앞의 한글 낱말(공백 포함 최대 4낱말) 끝까지를 이름으로 본다
const RX = /((?:[가-힣][가-힣·]*\s?){1,4}?)\s*\(\s*([^()]{2,60}?)\s*\)/g;
for (const d of docs) {
  for (const f of ALL_FIELDS) for (const s of strings(d.result?.[f])) {
    for (const m of s.matchAll(RX)) {
      const ko = m[1], o = m[2];
      if (!HANGUL.test(ko) || HANGUL.test(o)) continue;
      if (/^[A-Za-z][A-Za-z0-9 .,'’&\-éèêàùçôîñöüäß·:]+$/.test(o) && /[A-Z]/.test(o[0])) vote("en", ko.split(/\s/).slice(-3).join(" "), o);          // 영문 원어
      else if (/[぀-ヿ一-鿿]/.test(o)) vote("ja", ko.split(/\s/).slice(-3).join(" "), o);                                                  // 일본어 원어
    }
  }
  if (d.name && d.i18n?.en?.name) vote("en", d.name, d.i18n.en.name);
  if (d.name && d.i18n?.ja?.name) vote("ja", d.name, d.i18n.ja.name);
}
const out = { en: {}, ja: {} };
for (const lang of ["en", "ja"]) for (const [ko, m] of votes[lang]) out[lang][ko] = [...m].sort((a, b) => b[1] - a[1])[0][0];
mkdirSync(MT_DIR, { recursive: true });
writeFileSync(`${MT_DIR}/names.json`, JSON.stringify(out), "utf8");
console.log(`이름 사전 — 영어 ${Object.keys(out.en).length}개 · 일본어 ${Object.keys(out.ja).length}개`);
for (const lang of ["en", "ja"]) console.log(`  ${lang} 예:`, Object.entries(out[lang]).slice(0, 8).map(([k, v]) => `${k}→${v}`).join(" | "));
await client.close();
process.exit(0);
