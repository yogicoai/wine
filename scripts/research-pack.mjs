// 조사 묶음 만들기 — 에이전트가 읽을 입력 파일을 쓴다.
//
// 항목마다 담는 것
//   name       카탈로그 이름 (이 이름으로 DB 에 되돌려 쓴다 — 에이전트가 바꾸면 안 된다)
//   current    우리가 지금 갖고 있는 정보 (틀렸을 수 있다 — 대조할 대상이다)
//   dailyshot  판매처의 구조화 정보 (도수·용량·국가·종류는 믿을 만하다. 없을 수 있다)
//
//   node --env-file=.env.local scripts/research-pack.mjs --cat whisky --prefix wh --batch 4
//   node --env-file=.env.local scripts/research-pack.mjs --cat wine --where noStory --order popular --limit 200 --prefix wine-pop
//   node --env-file=.env.local scripts/research-pack.mjs --cat sake --random 8 --prefix pilot-sake
//
// 출력: data/research/_work/in/<prefix>-<번호>.json  (그리고 몇 개인지)

import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cat = arg("--cat");                                   // 쉼표로 여러 주종: brandy,rum,gin
const cats = cat ? cat.split(",").map((x) => x.trim()).filter(Boolean) : [];
const prefix = arg("--prefix", cat);
const batch = Number(arg("--batch", 4));
const where = arg("--where", "any");         // any | hasStory | noStory
const order = arg("--order", "name");         // name | popular
const limit = Number(arg("--limit", 100000));
const random = arg("--random") ? Number(arg("--random")) : null;
const skipDone = !process.argv.includes("--redo");
const names = arg("--names") ? arg("--names").split("|") : null;         // 이름으로 콕 집어 — 주종은 따지지 않는다
if (!cat && !names) throw new Error("--cat 이나 --names 가 필요합니다");

const DIR = "data/research/_work/in";
mkdirSync(DIR, { recursive: true });

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const q = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };
if (names) q.name = { $in: names }; else q.category = cats.length > 1 ? { $in: cats } : cat;
if (where === "hasStory") q["result.story"] = { $nin: [null, ""] };
if (where === "noStory") q.$or = [{ "result.story": { $in: [null, ""] } }, { "result.story": { $exists: false } }];
if (skipDone) q["verified.at"] = { $exists: false };

let docs = await col.find(q, {
  projection: {
    name: 1, category: 1, priceBand: 1, producer: 1, vintage: 1, result: 1,
    "sourceFacts.dailyshot": 1,
  },
}).toArray();

if (order === "popular") docs.sort((a, b) => (b.sourceFacts?.dailyshot?.reviewCount || 0) - (a.sourceFacts?.dailyshot?.reviewCount || 0) || a.name.localeCompare(b.name, "ko"));
else docs.sort((a, b) => (cats.indexOf(a.category) - cats.indexOf(b.category)) || a.name.localeCompare(b.name, "ko"));   // 주종 순서 → 이름

if (random) docs = docs.map((d) => [Math.random(), d]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, random);
docs = docs.slice(0, limit);

// 에이전트에게 줄 때 덜어 내는 것 — 번역층·이미지·키는 조사와 무관하다
const DROP = new Set(["i18n", "found", "searchKeyword", "tasteProfile", "tier", "tasteEstimated"]);
function trimResult(r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) if (!DROP.has(k) && v != null && v !== "") out[k] = v;
  return out;
}
function trimDs(d) {
  if (!d) return null;
  return {
    name: d.name, url: d.url, enName: d.enName, facts: d.facts, information: d.information,
    tastingNotes: d.tastingNotes, pairingFoods: d.pairingFoods, supplier: d.supplier,
    reviewCount: d.reviewCount,
  };
}

let nFiles = 0;
for (let i = 0; i < docs.length; i += batch) {
  const items = docs.slice(i, i + batch).map((d) => ({
    name: d.name,
    category: d.category,
    priceBand: d.priceBand ?? null,
    current: trimResult(d.result),
    dailyshot: trimDs(d.sourceFacts?.dailyshot),
  }));
  nFiles++;
  writeFileSync(`${DIR}/${prefix}-${String(nFiles).padStart(3, "0")}.json`, JSON.stringify(items, null, 1), "utf8");
}
console.log(`${cat} — 항목 ${docs.length}개 → 입력 파일 ${nFiles}개 (${DIR}/${prefix}-001.json …)`);
console.log(`  이미 확인된 것 제외: ${skipDone ? "예" : "아니오"} · 조건: ${where} · 순서: ${order}`);
await client.close();
process.exit(0);
