// 가격 정보 현황 — 무엇이 있고 무엇이 없는지 실측한다.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const full = await col.countDocuments({ tier: "full" });
const band = await col.countDocuments({ tier: "full", $or: [{ priceBand: { $ne: null } }, { "result.priceBand": { $ne: null } }] });
const range = await col.countDocuments({ tier: "full", "result.priceRange": { $nin: [null, ""] } });
const img = await col.countDocuments({ tier: "full", image: { $nin: [null, ""] } });
console.log(`정식 ${full} · 가격대(1~5) ${band} · 실제 가격범위 ${range} · 상품이미지 ${img}`);

// 주종별 priceRange 결손
const byCat = await col.aggregate([
  { $match: { tier: "full" } },
  { $group: {
      _id: "$category",
      n: { $sum: 1 },
      range: { $sum: { $cond: [{ $in: ["$result.priceRange", [null, ""]] }, 0, 1] } },
      band: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$priceBand", "$result.priceBand"] }, null] }, 0, 1] } },
  } },
  { $sort: { n: -1 } },
]).toArray();
console.log("\n주종        정식   가격대   실제가격범위");
for (const c of byCat) {
  console.log(`${String(c._id).padEnd(12)}${String(c.n).padStart(4)}${String(c.band).padStart(8)}${String(c.range).padStart(12)}`);
}

// 가격 이력 컬렉션이 살아 있는지
const cols = await client.db(env.MONGODB_DB || "winelens").listCollections().toArray();
console.log("\n컬렉션:", cols.map((c) => c.name).join(", "));
for (const n of ["prices", "priceHistory", "deals"]) {
  if (cols.some((c) => c.name === n)) {
    const cnt = await client.db(env.MONGODB_DB || "winelens").collection(n).countDocuments();
    const last = await client.db(env.MONGODB_DB || "winelens").collection(n).find({}).sort({ _id: -1 }).limit(1).toArray();
    console.log(`  ${n}: ${cnt}건 · 최근 ${last[0] ? JSON.stringify(last[0]).slice(0, 160) : "없음"}`);
  }
}
await client.close();
