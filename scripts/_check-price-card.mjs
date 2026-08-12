// 시세가 화면에 어떻게 보일지 미리 찍어 본다 (DB 직접 조회 — 서버가 없어도 된다).
// 사용: node scripts/_check-price-card.mjs [이름 조각]
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

function won(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 100_000_000) { const e = v / 100_000_000; return `${e % 1 === 0 ? e : e.toFixed(1)}억원`; }
  if (v >= 10_000) {
    const man = Math.floor(v / 10_000);
    const rest = Math.round((v % 10_000) / 1000);
    return rest ? `${man}만 ${rest}천원` : `${man}만원`;
  }
  return `${v.toLocaleString()}원`;
}
function label(p) {
  const lo = Number(p.krwLow), hi = Number(p.krwHigh);
  if (!hi || lo === hi) return won(lo);
  if (!lo) return `${won(hi)} 안팎`;
  if (hi / lo < 1.15) return `${won(Math.round((lo + hi) / 2 / 1000) * 1000)} 안팎`;
  return `${won(lo)} ~ ${won(hi)}`;
}

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const q = process.argv[2];
const docs = q
  ? await col.find({ name: { $regex: q }, priceInfo: { $exists: true } }, { projection: { name: 1, category: 1, priceInfo: 1 } }).limit(5).toArray()
  : await col.aggregate([
      { $match: { priceInfo: { $exists: true } } },
      { $sample: { size: 8 } },
      { $project: { name: 1, category: 1, priceInfo: 1 } },
    ]).toArray();

for (const d of docs) {
  const p = d.priceInfo;
  console.log(`\n[${d.category}] ${d.name}`);
  console.log(`  시세  ${label(p)}`);
  console.log(`  ${[p.volume, p.basis].filter(Boolean).join(" · ")}`);
  if (p.usdLow || p.usdHigh) console.log(`  해외 소매가 $${p.usdLow || ""}${p.usdHigh ? `~${p.usdHigh}` : ""} (관세·주세 전 · 참고용)`);
  if ((p.confidence || 0) < 65) console.log(`  ≈ 국내 정식 유통이 적어 폭넓게 잡은 추정치입니다 (신뢰도 ${p.confidence})`);
  console.log(`  ${p.asOf} 기준 · 판매처와 시기에 따라 달라집니다`);
}
await client.close();
