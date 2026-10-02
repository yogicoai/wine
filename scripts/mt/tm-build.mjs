// 번역 메모리(TM) 만들기 — 이미 문서에 있는 고품질 번역(i18n.en/ja)에서 "한국어 문장 → 번역" 대응을 뽑는다.
//
//   node --env-file=.env.local scripts/mt/tm-build.mjs
//
// 번역층의 필드는 한국어 원문이 바뀌지 않은 것만 남아 있으므로 (바뀐 필드는 지웠다) 원문과 짝이 맞는다.
// 맞추는 법: 문자열 필드는 문장 수가 같을 때 문장끼리, 배열(tips·specs·history·foodPairing)은 같은 순서끼리.
// 출력: data/mt/tm.json  { en: { "한국어": "번역" }, ja: {...} }  — 같은 한국어에 번역이 여럿이면 가장 많이 나온 것
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { ALL_FIELDS, HANGUL, OBJ_FIELDS, STR_FIELDS, ARR_STR, splitSentences } from "./_lib.mjs";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ i18n: { $exists: true } }, { projection: { result: 1, i18n: 1 } }).toArray();

const votes = { en: new Map(), ja: new Map() };   // ko → Map(번역 → 횟수)
const vote = (lang, ko, tr) => {
  if (typeof ko !== "string" || typeof tr !== "string") return;
  ko = ko.trim(); tr = tr.trim(); if (!ko || !tr || !HANGUL.test(ko)) return;
  const m = votes[lang].get(ko) || new Map(); m.set(tr, (m.get(tr) || 0) + 1); votes[lang].set(ko, m);
};
const pairStr = (lang, ko, tr) => {
  if (typeof ko !== "string" || typeof tr !== "string") return;
  vote(lang, ko, tr);                                 // 필드 통째 (짧은 필드는 이것으로 충분)
  const a = splitSentences(ko);
  if (a.length > 1) {
    // 번역 쪽 문장 나누기 — 영어는 ". " 뒤, 일본어는 "。" 뒤
    const b = lang === "ja" ? tr.split(/(?<=。)/).map((s) => s.trim()).filter(Boolean) : tr.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/).map((s) => s.trim()).filter(Boolean);
    if (a.length === b.length) a.forEach((s, i) => vote(lang, s, b[i]));
  } else vote(lang, a[0] || ko, tr);
};

let pairsDocs = { en: 0, ja: 0 };
for (const d of docs) {
  for (const lang of ["en", "ja"]) {
    const layer = d.i18n?.[lang]; if (!layer) continue;
    let used = false;
    for (const f of ALL_FIELDS) {
      const ko = d.result?.[f], tr = layer[f]; if (ko == null || tr == null) continue;
      if (STR_FIELDS.includes(f)) { pairStr(lang, ko, tr); used = true; }
      else if (ARR_STR.includes(f) && Array.isArray(ko) && Array.isArray(tr) && ko.length === tr.length) { ko.forEach((s, i) => pairStr(lang, s, tr[i])); used = true; }
      else if (OBJ_FIELDS[f] && Array.isArray(ko) && Array.isArray(tr) && ko.length === tr.length) {
        ko.forEach((it, i) => { for (const k of OBJ_FIELDS[f]) pairStr(lang, it?.[k], tr[i]?.[k]); }); used = true;
      }
    }
    if (used) pairsDocs[lang]++;
  }
}
const tm = { en: {}, ja: {} };
for (const lang of ["en", "ja"]) for (const [ko, m] of votes[lang]) tm[lang][ko] = [...m].sort((a, b) => b[1] - a[1])[0][0];
mkdirSync("data/mt", { recursive: true });
writeFileSync("data/mt/tm.json", JSON.stringify(tm), "utf8");
console.log(`번역 메모리 — 영어 ${Object.keys(tm.en).length}개 (문서 ${pairsDocs.en}) · 일본어 ${Object.keys(tm.ja).length}개 (문서 ${pairsDocs.ja})`);
await client.close();
process.exit(0);
