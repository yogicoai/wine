// 조사한 시세를 문서 최상단 priceInfo 에 심고, curation.json 에도 함께 남긴다.
//
// 두 곳에 쓰는 이유 — DB 만 고치면 seed 재적재(/api/catalog/import)가
// 문서를 다시 쓰면서 값이 사라진다. curation.json 은 적재 때마다 다시 얹히므로
// 여기에 남겨야 살아남는다. (전에 위스키 축 보정 20종을 그렇게 잃었다)
//
// 사용: node scripts/_apply-prices.mjs <prices.json>
// 형식: [{ key|name, krwLow, krwHigh, volume, basis, usdLow, usdHigh, asOf, confidence }]
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const CURATION = "c:/Users/WeMA1/Desktop/wine-main/data/curation.json";
const rows = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const list = Array.isArray(rows) ? rows : rows.prices || [];

// 품질 문턱 — 이 아래는 아예 들이지 않는다.
//
// 한 번 데어 봤다. 낮은 등급 모델로 조사한 라운드에서 2천원짜리 막걸리에
// 신뢰도 1이 붙고 4만5천~16만5천원이 적혀 들어왔다. 사용자가 라벨을 찍고 보는 숫자라
// 틀린 값은 값이 없는 것보다 나쁘다. 그래서 걸러 내는 일을 사람 눈이 아니라 여기에 맡긴다.
const MIN_CONFIDENCE = 45;
const MAX_RANGE_RATIO = 3;

function rejectReason(lo, hi, conf) {
  if (!lo && !hi) return "값 없음";
  if (conf && conf < MIN_CONFIDENCE) return `신뢰도 ${conf}`;
  if (lo && hi && hi / lo > MAX_RANGE_RATIO) return `범위 ${Math.round((hi / lo) * 10) / 10}배`;
  return null;
}

// 시세로 계산한 대역 — 우리가 매겨 둔 priceBand 와 어긋나면 점검 대상이다
function bandFromPrice(lo, hi) {
  const mid = lo && hi ? (lo + hi) / 2 : lo || hi;
  if (!mid) return null;
  if (mid < 20_000) return 1;
  if (mid < 50_000) return 2;
  if (mid < 100_000) return 3;
  if (mid < 300_000) return 4;
  return 5;
}

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const curation = JSON.parse(readFileSync(CURATION, "utf-8"));
const curByName = new Map(curation.map((c) => [c.name, c]));

let applied = 0, missed = 0, mismatch = 0, skipped = 0;
const conflicts = [];
const rejected = [];

for (const r of list) {
  const q = r.key ? { key: r.key } : { name: r.name };
  const doc = await col.findOne(q, { projection: { _id: 1, name: 1, priceBand: 1 } });
  if (!doc) { missed++; console.log(`⚠ 없음: ${r.key || r.name}`); continue; }

  const lo = Number(r.krwLow) || null;
  const hi = Number(r.krwHigh) || null;
  // 뒤집힌 범위는 조용히 바로잡는다 (사람이 적은 값이 아니라 기계가 뽑은 값이다)
  const [low, high] = lo && hi && lo > hi ? [hi, lo] : [lo, hi];

  const bad = rejectReason(low, high, Number(r.confidence) || 0);
  if (bad) {
    skipped++;
    rejected.push(`${doc.name} — ${bad}`);
    continue;
  }

  const info = {
    krwLow: low,
    krwHigh: high,
    volume: r.volume || null,
    basis: r.basis || null,
    usdLow: Number(r.usdLow) || null,
    usdHigh: Number(r.usdHigh) || null,
    asOf: r.asOf || null,
    confidence: Number(r.confidence) || null,
  };

  // 우리가 매긴 대역과 조사한 시세가 어긋나면 기록해 둔다 — 둘 중 하나가 틀렸다
  const calc = bandFromPrice(low, high);
  if (calc && doc.priceBand && Math.abs(calc - doc.priceBand) >= 2) {
    mismatch++;
    conflicts.push({ name: doc.name, band: doc.priceBand, fromPrice: calc, krwLow: low, krwHigh: high });
  }

  await col.updateOne({ _id: doc._id }, { $set: { priceInfo: info } });

  // curation.json 에도 남긴다 — 재적재에서 살아남게
  const cur = curByName.get(doc.name);
  if (cur) cur.priceInfo = info;
  else {
    const add = { name: doc.name, priceInfo: info };
    curation.push(add);
    curByName.set(doc.name, add);
  }
  applied++;
}

writeFileSync(CURATION, JSON.stringify(curation, null, 1), "utf-8");
console.log(`\n시세 적용 ${applied} · 못 찾음 ${missed} · 품질 미달로 거름 ${skipped} · 대역 불일치 ${mismatch}`);
for (const r of rejected.slice(0, 15)) console.log(`  ✗ ${r}`);
if (rejected.length > 15) console.log(`  … 외 ${rejected.length - 15}건`);
for (const c of conflicts.slice(0, 20)) {
  console.log(`  ⚠ ${c.name}: 매긴 대역 ${c.band} vs 시세 대역 ${c.fromPrice} (${c.krwLow}~${c.krwHigh})`);
}
if (conflicts.length > 20) console.log(`  … 외 ${conflicts.length - 20}건`);
await client.close();
