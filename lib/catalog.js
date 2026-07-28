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
    // 판매처 상품 이미지 주소 (원본을 복제하지 않고 연결만 한다)
    image: found.image || null,
  };
}

export async function saveCatalog(result, { usedWeb = false, model = null, source = "scan" } = {}) {
  const db = await getDb();
  if (!db || !result?.name || result.found === false) return false;

  const key = catalogKey(result.name, result.vintage);
  const set = {
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
  };

  // 큐레이션 값 — 추천·가격대 분류에 쓰므로 문서 최상단에 둔다(정렬·필터가 필요하다).
  // 실시간 시세가 아니라 우리가 매긴 대역이므로 VOLATILE 대상이 아니다.
  // AI 결과에는 없고 우리가 직접 넣은 데이터에만 있으므로, 있을 때만 덮어쓴다.
  if (result.priceBand) set.priceBand = Number(result.priceBand);
  if (typeof result.beginner === "number") set.beginner = result.beginner;
  if (Array.isArray(result.tags)) set.tags = result.tags;

  await db.collection("catalog").updateOne(
    { key },
    { $set: set, $setOnInsert: { source, hits: 0, createdAt: new Date() } },
    { upsert: true }
  );
  return true;
}

/**
 * 이름으로 카탈로그를 찾는다 — 사진 없이도 술을 열어볼 수 있게 한다.
 * DB만 읽으므로 비용이 들지 않는다.
 */
export async function searchCatalog(q, { limit = 20, category = null } = {}) {
  const db = await getDb();
  const term = String(q || "").trim();
  if (!db || term.length < 1) return [];

  // 정규식 특수문자를 그대로 넣으면 검색이 깨지거나 느려진다
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(safe, "i");
  // 띄어쓰기·괄호를 무시하고도 찾히도록 정규화 키로도 본다 ("샤또딸보" → "샤또 딸보")
  const normalized = catalogKey(term, "").replace(/\|$/, "");

  const query = {
    $or: [
      { name: rx },
      { producer: rx },
      { searchKeyword: rx },
      // 이름을 정확히 모를 때 "칠레", "보르도"처럼 산지로 찾는 경우가 많다
      { "result.country": rx },
      { "result.region": rx },
      { "result.type": rx },
      ...(normalized ? [{ key: new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] : []),
    ],
  };
  if (category) query.category = category;

  const docs = await db
    .collection("catalog")
    .find(query, {
      projection: {
        name: 1, category: 1, vintage: 1, producer: 1, key: 1, hits: 1,
        priceBand: 1, tags: 1, image: 1,
        "result.region": 1, "result.country": 1, "result.type": 1, "result.liquidColor": 1,
      },
    })
    .limit(limit * 2)
    .toArray();

  // 이름이 검색어로 시작하는 것을 먼저, 그다음 많이 조회된 순
  const starts = (d) => (d.name || "").toLowerCase().startsWith(term.toLowerCase());
  docs.sort((a, b) => starts(b) - starts(a) || (b.hits || 0) - (a.hits || 0));

  return docs.slice(0, limit).map((d) => ({
    key: d.key,
    name: d.name,
    category: d.category,
    vintage: d.vintage || null,
    producer: d.producer || null,
    region: d.result?.region || null,
    country: d.result?.country || null,
    type: d.result?.type || null,
    liquidColor: d.result?.liquidColor || null,
    priceBand: d.priceBand || null,
    tags: d.tags || [],
    // 판매처가 제공하는 이미지 주소 (복제하지 않고 연결만 한다)
    image: d.image || null,
  }));
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
