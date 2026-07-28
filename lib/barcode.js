// 바코드로 술을 찾는다.
//
// 바코드는 라벨 사진보다 정확하고, AI를 부르지 않으므로 비용이 들지 않는다.
// 다만 "바코드 → 와인" 대조표는 공개된 것이 없어서 우리가 직접 쌓아야 한다.
// 그래서 이 기능은 쓸수록 정확해지는 구조로 만들었다.
//
//   1) 우리 카탈로그에 이미 연결된 바코드인가        → 즉시 응답 (0원)
//   2) 판매처에서 바코드 번호로 상품을 찾을 수 있는가 → 이름을 얻어 카탈로그 조회 (0원)
//   3) 둘 다 아니면 라벨 사진으로 넘긴다             → 분석 후 바코드를 연결해 둔다
//
import { getDb } from "./mongodb";
import { catalogKey, lookupCatalog, catalogNameIndex } from "./catalog";
import { findLooseMatch } from "./match";
import { searchShop, hasNaverKeys } from "./naver";
import { cleanProductName } from "./seedList";

// 정규화·검증은 화면에서도 써야 하므로 순수 모듈로 분리해 두었다
export { normalizeBarcode, isValidBarcode } from "./ean";

/** 분석에 성공한 술에 바코드를 연결해 둔다 (다음 사람은 공짜로 찾는다) */
export async function linkBarcode(code, result) {
  const db = await getDb();
  if (!db || !code || !result?.name) return false;

  await db
    .collection("catalog")
    .updateOne({ key: catalogKey(result.name, result.vintage) }, { $addToSet: { barcodes: code } });
  return true;
}

/**
 * @returns {Promise<null | {result, source, via, image?}>}
 *   via: "catalog" = 이미 연결된 바코드, "shop" = 판매처 이름으로 찾음
 */
export async function lookupBarcode(code) {
  const db = await getDb();
  if (!db || !code) return null;

  // 1) 이미 연결해 둔 바코드
  const doc = await db.collection("catalog").findOneAndUpdate(
    { barcodes: code },
    { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } },
    { returnDocument: "after" }
  );
  const found = doc?.value ?? doc;
  if (found?.result) {
    return { result: found.result, source: found.source || "scan", via: "catalog", image: found.image || null };
  }

  // 2) 판매처에서 바코드 번호로 상품명을 얻어 본다
  if (!hasNaverKeys()) return null;
  let items = [];
  try {
    items = (await searchShop(code, "liquor", { display: 5, fresh: true })) || [];
  } catch {
    return null;
  }
  if (!items.length) return null;

  // 판매처 상품명은 우리 표기와 늘 조금씩 다르므로, 정확 일치에 실패하면
  // 토큰 겹침으로 한 번 더 찾는다. (바코드 응답은 결과 화면을 채워야 하므로 stub 제외)
  const index = await catalogNameIndex();

  for (const item of items.slice(0, 3)) {
    const name = cleanProductName(item.title);
    if (!name) continue;

    const vintage = name.match(/\b(19|20)\d{2}\b/)?.[0] || null;
    let hit = (await lookupCatalog(name, vintage)) || (vintage ? await lookupCatalog(name, null) : null);

    if (!hit) {
      const loose = findLooseMatch(name, index.filter((d) => d.tier !== "stub"));
      if (loose) hit = await lookupCatalog(loose.candidate.name, loose.candidate.vintage);
    }
    if (!hit) continue;

    // 다음부터는 판매처를 거치지 않도록 연결해 둔다
    await linkBarcode(code, hit.result);
    return { ...hit, via: "shop", image: hit.image || item.image || null };
  }

  return null;
}
