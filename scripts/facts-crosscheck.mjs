// 우리 정보와 판매처 구조화 정보를 대조한다 — 도수와 국가. LLM 없이 되는 정확도 점검이다.
//
//   node --env-file=.env.local scripts/facts-crosscheck.mjs              보기만
//   node --env-file=.env.local scripts/facts-crosscheck.mjs --fill       우리 쪽이 비어 있는 도수·국가만 채움
//
// 판단 기준
//   · 우리 값이 없으면 판매처 값으로 채울 수 있다 (--fill) — 덮어쓰는 것이 아니라 빈칸이다.
//   · 두 값이 있는데 다르면 적용하지 않고 목록으로 남긴다. 누가 맞는지는 조사 에이전트가 가린다.
//     판매처도 틀릴 수 있다. 같은 술의 다른 도수 라인이 섞이기도 한다.
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";

const FILL = process.argv.includes("--fill");

import { abvNum as num, canonCountry as canon } from "./_facts-lib.mjs";

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find(
  { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, "sourceFacts.dailyshot.facts": { $exists: true } },
  { projection: { name: 1, category: 1, "result.alcohol": 1, "result.country": 1, "sourceFacts.dailyshot.facts": 1, "sourceFacts.dailyshot.name": 1 } }
).toArray();

// 꽉 맞는 짝인가 — 부피·연도·도수·괄호·일반 낱말을 걷은 이름이 같아야 한다.
// 빈칸을 채울 때만 이걸 쓴다. 한쪽에 변종 단어가 더 붙은 짝은 다른 병일 수 있다
// (덕혼 메를로 ↔ 덕혼 디코이 메를로). 그런 것은 조사 에이전트가 가린다.
const GENERIC = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리)/g;
const core = (s) =>
  String(s || "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")                    // 대괄호·괄호 안
    .replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ")          // 부피·도수
    .replace(/\b(19|20)\d{2}\b/g, " ")                         // 연도
    .replace(GENERIC, " ")                                     // 일반 낱말
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
const tight = (d) => { const a = core(d.name), b = core(d.sourceFacts.dailyshot.name); return !!a && a === b; };
let looseSkipped = 0;
const abvDiff = [], ctyDiff = [], fillAbv = [], fillCty = [];
let abvSame = 0, ctySame = 0, abvBoth = 0, ctyBoth = 0;
for (const d of docs) {
  const f = d.sourceFacts.dailyshot.facts || {};
  const mine = num(d.result?.alcohol), theirs = num(f.abv);
  if (theirs != null) {
    if (mine == null) { if (tight(d)) fillAbv.push({ name: d.name, to: f.abv }); else looseSkipped++; }
    else { abvBoth++; if (Math.abs(mine - theirs) <= 0.5) abvSame++; else abvDiff.push({ name: d.name, cat: d.category, ours: d.result.alcohol, theirs: f.abv, ds: d.sourceFacts.dailyshot.name }); }
  }
  const c1 = canon(d.result?.country), c2 = canon(f.country);
  if (c2) {
    if (!c1) { if (tight(d)) fillCty.push({ name: d.name, to: f.country }); else looseSkipped++; }
    else { ctyBoth++; if (c1 === c2) ctySame++; else ctyDiff.push({ name: d.name, cat: d.category, ours: d.result.country, theirs: f.country, ds: d.sourceFacts.dailyshot.name }); }
  }
}

console.log(`판매처 정보가 있는 ${docs.length}종 대조`);
console.log(`도수  둘 다 있음 ${abvBoth} — 일치 ${abvSame} · 어긋남 ${abvDiff.length} | 우리 쪽 비어 있음 ${fillAbv.length}`);
console.log(`채울 수 있는 빈칸: 도수 ${fillAbv.length} · 국가 ${fillCty.length} (이름이 꽉 맞지 않아 미룬 것 ${looseSkipped})`);
console.log(`국가  둘 다 있음 ${ctyBoth} — 일치 ${ctySame} · 어긋남 ${ctyDiff.length} | 우리 쪽 비어 있음 ${fillCty.length}`);
console.log("\n── 도수가 어긋나는 것 (앞 12건) ──");
abvDiff.slice(0, 12).forEach((x) => console.log(`  [${x.cat}] ${x.name.slice(0, 28).padEnd(30)} 우리 ${String(x.ours).padEnd(8)} 판매처 ${x.theirs}   (${x.ds.slice(0, 26)})`));
console.log("\n── 국가가 어긋나는 것 (앞 12건) ──");
ctyDiff.slice(0, 12).forEach((x) => console.log(`  [${x.cat}] ${x.name.slice(0, 28).padEnd(30)} 우리 ${String(x.ours).padEnd(8)} 판매처 ${x.theirs}`));

mkdirSync("data/research/_work", { recursive: true });
writeFileSync("data/research/_work/crosscheck.json", JSON.stringify({ at: new Date().toISOString(), abvDiff, ctyDiff }, null, 1), "utf8");

if (FILL) {
  const ops = [];
  for (const x of fillAbv) ops.push({ updateOne: { filter: { name: x.name, "result.alcohol": { $in: [null, ""] } }, update: { $set: { "result.alcohol": x.to } } } });
  for (const x of fillCty) ops.push({ updateOne: { filter: { name: x.name, "result.country": { $in: [null, ""] } }, update: { $set: { "result.country": x.to } } } });
  // 번역이 있는 필드(country)는 번역을 지운다
  const r = ops.length ? await col.bulkWrite(ops, { ordered: false }) : { modifiedCount: 0 };
  await col.updateMany({ name: { $in: fillCty.map((x) => x.name) } }, { $unset: { "i18n.en.country": "", "i18n.ja.country": "" } });
  console.log(`\n빈칸을 채웠습니다 — ${r.modifiedCount}건 (도수 ${fillAbv.length} · 국가 ${fillCty.length} 후보)`);
} else console.log("\n눈으로만 봤습니다. 빈칸을 채우려면 --fill");
await client.close();
process.exit(0);
