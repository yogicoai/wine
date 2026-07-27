// 술 카탈로그 — 분석 결과를 축적해 재분석 없이 재사용하는 저장소
// 스캔할수록 자체 DB가 두꺼워지고, 미리 선적재해두면 첫날부터 AI 호출 없이 응답한다.
import { getDb } from "./mongodb";

// 표기 흔들림(공백·괄호·대소문자·특수문자)을 흡수하는 조회 키
// 예) "샤또 딸보 2018 (Château Talbot)" + 2018  →  "샤또딸보chateautalbot|2018"
export function catalogKey(name, vintage) {
  const base = String(name || "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "") // 연도는 별도 필드로 분리
    .replace(/[^\p{L}\p{N}]/gu, "") // 한글·라틴·숫자만 남김
    .normalize("NFKC");
  return `${base}|${vintage || ""}`;
}

// 캐시에서 제외할 필드 — 시세는 계속 변하므로 저장하지 않고 매번 실시간 조회한다
const VOLATILE = ["priceRange", "priceNote", "priceTier"];

function stripVolatile(result) {
  const copy = { ...result };
  for (const f of VOLATILE) delete copy[f];
  return copy;
}

export async function lookupCatalog(name, vintage) {
  const db = await getDb();
  if (!db || !name) return null;

  const key = catalogKey(name, vintage);
  const doc = await db.collection("catalog").findOneAndUpdate(
    { key },
    { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } },
    { returnDocument: "after" }
  );
  const found = doc?.value ?? doc; // 드라이버 버전에 따라 반환 형태가 다름
  if (!found?.result) return null;

  return {
    result: found.result,
    source: found.source || "scan",
    usedWeb: !!found.usedWeb,
    hits: found.hits || 1,
    cachedAt: found.createdAt,
  };
}

export async function saveCatalog(result, { usedWeb = false, model = null, source = "scan" } = {}) {
  const db = await getDb();
  if (!db || !result?.name || result.found === false) return false;

  const key = catalogKey(result.name, result.vintage);
  await db.collection("catalog").updateOne(
    { key },
    {
      $set: {
        key,
        name: result.name,
        category: result.category || null,
        vintage: result.vintage || null,
        producer: result.producer || null,
        searchKeyword: result.searchKeyword || result.name,
        result: stripVolatile(result),
        usedWeb,
        model,
        updatedAt: new Date(),
      },
      $setOnInsert: { source, hits: 0, createdAt: new Date() },
    },
    { upsert: true }
  );
  return true;
}

export async function catalogStats() {
  const db = await getDb();
  if (!db) return null;
  const col = db.collection("catalog");

  const [total, byCategory, bySource, topHits] = await Promise.all([
    col.countDocuments(),
    col.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    col.aggregate([{ $group: { _id: "$source", n: { $sum: 1 } } }]).toArray(),
    col
      .find({ hits: { $gt: 0 } }, { projection: { name: 1, hits: 1, category: 1 } })
      .sort({ hits: -1 })
      .limit(10)
      .toArray(),
  ]);

  const hitTotal = await col
    .aggregate([{ $group: { _id: null, sum: { $sum: "$hits" } } }])
    .toArray();

  return {
    total,
    byCategory: byCategory.map((c) => ({ category: c._id, count: c.n })),
    bySource: Object.fromEntries(bySource.map((s) => [s._id || "unknown", s.n])),
    totalHits: hitTotal[0]?.sum || 0,
    topHits: topHits.map((t) => ({ ...t, _id: t._id.toString() })),
  };
}
