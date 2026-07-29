// 술 카탈로그 — 분석 결과를 축적해 재분석 없이 재사용하는 저장소
// 스캔할수록 자체 DB가 두꺼워지고, 미리 선적재해두면 첫날부터 AI 호출 없이 응답한다.
import { getDb } from "./mongodb";
import { splitName, displayName } from "./nameClean";

// 표기 흔들림(공백·괄호·대소문자·특수문자)을 흡수하는 조회 키
// 예) "샤또 딸보 2018 (Château Talbot)" + 2018  →  "샤또딸보|2018"
export function catalogKey(name, vintage) {
  const base = displayName(name) // 괄호로 붙은 원어를 떼야 같은 술이 한 칸에 모인다
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

/**
 * 카탈로그 조회.
 *
 * 항목에는 두 단계가 있다.
 *   full — 분석을 마친 항목. 결과 화면을 그대로 채울 수 있다.
 *   stub — 이름·산지·품종·맛 축만 있는 뼈대. 검색·추천·리스트 대조에는 충분하지만
 *          결과 화면을 채우기에는 모자라다.
 *
 * 뼈대를 둔 이유는 규모 때문이다. 한 병마다 스토리와 역사까지 쓰면 수백 종을 넣을 수 없다.
 * 뼈대는 열 줄이면 되므로 훨씬 많이 담을 수 있고, 누군가 실제로 그 술을 찍는 순간
 * 한 번만 분석해서 full 로 올린다.
 *
 * @param {object} opts
 * @param {boolean} opts.allowStub 뼈대도 받아들일지 (검색·리스트 대조용)
 */
export async function lookupCatalog(name, vintage, { allowStub = false } = {}) {
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

  // 뼈대를 분석 결과인 척 돌려주면 빈 화면이 나온다.
  // 분석 경로에서는 없는 것으로 보아 정식 분석을 받게 한다.
  const isStub = found.tier === "stub";
  if (isStub && !allowStub) return null;

  return {
    result: found.result,
    tier: found.tier || "full",
    stub: isStub,
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

  // AI는 "샤또 딸보 (Château Talbot)"처럼 원어를 괄호로 붙여 온다.
  // 이름은 짧게 두되, 원어로도 찾을 수 있게 검색어에는 남긴다.
  const { name, original } = splitName(result.name);
  const key = catalogKey(name, result.vintage);
  const set = {
    key,
    name,
    category: result.category || null,
    vintage: result.vintage || null,
    producer: result.producer || null,
    searchKeyword: result.searchKeyword || [name, original].filter(Boolean).join(" "),
    result: { ...stripVolatile(result), name },
    usedWeb,
    model,
    updatedAt: new Date(),
    // 분석을 거친 것은 full. 뼈대로 넣은 것만 stub 으로 표시한다.
    // 뼈대였던 술을 누군가 실제로 찍으면 여기서 full 로 올라간다.
    tier: result.tier === "stub" ? "stub" : "full",
  };

  // 큐레이션 값 — 추천·가격대 분류에 쓰므로 문서 최상단에 둔다(정렬·필터가 필요하다).
  // 실시간 시세가 아니라 우리가 매긴 대역이므로 VOLATILE 대상이 아니다.
  // AI 결과에는 없고 우리가 직접 넣은 데이터에만 있으므로, 있을 때만 덮어쓴다.
  if (result.priceBand) set.priceBand = Number(result.priceBand);
  if (typeof result.beginner === "number") set.beginner = result.beginner;
  if (Array.isArray(result.tags)) set.tags = result.tags;
  // 판매처 이미지 주소 (수확 경로에서 함께 들어온다 — 복제가 아니라 연결)
  if (result.image) set.image = result.image;

  const before = await db.collection("catalog").updateOne(
    { key },
    { $set: set, $setOnInsert: { source, hits: 0, createdAt: new Date() } },
    { upsert: true }
  );
  // 새 술이 들어왔으면 이름 색인을 다시 읽게 한다 (수정은 이름이 그대로라 상관없다)
  if (before.upsertedCount) clearNameIndexCache();
  return true;
}

/**
 * 느슨한 매칭용 이름 색인 — 이름·생산자만 가볍게 전부 내린다.
 * 수천 건 수준이라 요청마다 읽어도 부담이 없고, 실제 조회는
 * 매칭된 이름으로 lookupCatalog 를 다시 부르므로 여기서는 이름만 있으면 된다.
 */
// 이름 색인은 촬영·바코드·와인 리스트 요청마다 필요한데, 지금 4,000건이 넘는다.
// 매번 전부 읽으면 카탈로그가 커질수록 느려진다. 몇 분 묵혀 두고 쓴다 —
// 새로 들어온 술이 몇 분 뒤에 잡히는 것은 문제가 되지 않는다.
const INDEX_TTL = 5 * 60 * 1000;
let indexCache = { at: 0, rows: null };

export function clearNameIndexCache() {
  indexCache = { at: 0, rows: null };
}

export async function catalogNameIndex() {
  if (indexCache.rows && Date.now() - indexCache.at < INDEX_TTL) return indexCache.rows;

  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .collection("catalog")
    .find({}, { projection: { name: 1, vintage: 1, producer: 1, category: 1, tier: 1 } })
    .limit(20000)
    .toArray();

  indexCache = { at: Date.now(), rows };
  return rows;
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

  const [total, full, fullWine, byCategory, bySource, topHits] = await Promise.all([
    col.countDocuments(),
    // 스토리·페어링까지 갖춘 항목 — "정보가 얼마나 깊은가"를 보여 준다
    col.countDocuments({ tier: { $ne: "stub" } }),
    // 와인 앱이므로 와인을 먼저 채운다. 그 진척을 따로 보여 준다
    col.countDocuments({ tier: { $ne: "stub" }, category: "wine" }),
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
    full,
    fullWine,
    byCategory: byCategory.map((c) => ({ category: c._id, count: c.n })),
    bySource: Object.fromEntries(bySource.map((s) => [s._id || "unknown", s.n])),
    totalHits: hitTotal[0]?.sum || 0,
    topHits: topHits.map((t) => ({ ...t, _id: t._id.toString() })),
  };
}
