// 품질 미달 시세 되돌리기 — 값을 넣는 것보다 빼는 것이 나을 때가 있다.
//
// 낮은 등급 모델로 시세를 조사한 라운드에서 주종별로 결과가 갈렸다.
//   위스키   평균 신뢰도 75.8 — 세계적으로 기록이 많은 제품이라 잘 찾아냈다
//   전통주   평균 신뢰도 44.8 — 국내 소규모 판매처를 뒤져야 하는데 못 했다
//            (지평·장수 생막걸리에 신뢰도 1, 막걸리에 4.5만~16.5만원 같은 값이 나왔다)
//
// 사용자가 라벨을 찍고 보는 숫자다. 틀린 값을 보여 주느니 값이 없는 편이 낫다.
// 그래서 아래 기준에 걸리는 것은 지우고, 한도가 풀리면 제대로 다시 조사한다.
//
// 사용: node scripts/_rollback-prices.mjs [--fix]
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const fix = process.argv.includes("--fix");
const CURATION = "c:/Users/WeMA1/Desktop/wine-main/data/curation.json";

// 통째로 다시 조사할 주종 — 평균 신뢰도가 기준에 한참 못 미친다
const REDO_CATEGORIES = new Set(["traditional", "soju"]);

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col.find(
  { priceInfo: { $exists: true } },
  { projection: { name: 1, category: 1, priceInfo: 1 } }
).toArray();

const drop = [];
for (const d of docs) {
  const p = d.priceInfo || {};
  const lo = Number(p.krwLow) || 0;
  const hi = Number(p.krwHigh) || 0;
  const conf = Number(p.confidence) || 0;
  let why = null;

  if (REDO_CATEGORIES.has(d.category)) why = "주종 전체 재조사";
  else if (conf < 45) why = `신뢰도 ${conf}`;
  else if (lo && hi && hi / lo > 3) why = `범위 ${Math.round((hi / lo) * 10) / 10}배`;

  if (why) drop.push({ ...d, why });
}

const byCat = {};
for (const d of drop) byCat[d.category] = (byCat[d.category] || 0) + 1;
console.log(`시세 보유 ${docs.length}건 중 ${drop.length}건 제거 대상`);
console.log(Object.entries(byCat).map(([k, v]) => `  ${k} ${v}`).join("\n"));
for (const d of drop.filter((x) => x.category !== "traditional" && x.category !== "soju")) {
  console.log(`  · [${d.category}] ${d.name} — ${d.why}`);
}

if (fix && drop.length) {
  const names = new Set(drop.map((d) => d.name));
  await col.updateMany({ _id: { $in: drop.map((d) => d._id) } }, { $unset: { priceInfo: "" } });

  // curation.json 에도 함께 넣어 두었으므로 거기서도 뺀다
  const cur = JSON.parse(readFileSync(CURATION, "utf-8"));
  let cleaned = 0;
  for (const c of cur) {
    if (names.has(c.name) && c.priceInfo) {
      delete c.priceInfo;
      cleaned++;
    }
  }
  writeFileSync(CURATION, JSON.stringify(cur, null, 1), "utf-8");
  console.log(`\n제거 완료 ${drop.length}건 · curation.json 정리 ${cleaned}건`);
} else if (!fix) {
  console.log("\n(--fix 를 붙여야 실제로 지웁니다)");
}
await client.close();
