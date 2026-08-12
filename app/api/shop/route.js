import { NextResponse } from "next/server";
import {
  searchShop,
  pickRepresentative,
  priceReference,
  hasNaverKeys,
  isShopRetired,
  shopSearchUrl,
  productUrlFromImage,
  searchGoodsImage,
} from "@/lib/naver";
import { getDb } from "@/lib/mongodb";
import { catalogKey } from "@/lib/catalog";
import { ONLINE_SALE_OK, onlineShops } from "@/lib/onlineSale";
import { searchElevenst, hasElevenstKey } from "@/lib/elevenst";

export const runtime = "nodejs";

// GET /api/shop?q=샤또딸보              → { items: [...] }        (주류, 최대 4개)
// GET /api/shop?type=food&q=A&q=B&q=C  → { results: [{q, item}] } (안주, 키워드별 1개)
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const queries = params.getAll("q").filter(Boolean);
  // liquor 술 · food 안주 · goods 잔과 도구
  const asked = params.get("type");
  const type = asked === "food" || asked === "goods" ? asked : "liquor";
  if (!queries.length) return NextResponse.json({ error: "q 필요" }, { status: 400 });
  // 값을 줄 수 있는 문이 하나라도 있으면 연다 — 네이버 쇼핑이 닫힌 뒤 11번가가 그 자리다
  if (!hasNaverKeys() && !hasElevenstKey()) {
    return NextResponse.json({ items: null, results: null, noApi: true });
  }

  try {
    // 여러 키워드 → 키워드별 대표 상품 1개씩 (안주·잔·도구 추천용)
    //
    // 술과 달리 이쪽은 온라인 판매에 아무 제한이 없어 링크가 실제 구매로 이어진다.
    // 쇼핑 검색 API가 내려가 값은 못 가져오지만, 사진은 이미지 검색으로 되살린다.
    // 이름만 적힌 줄보다 사진이 붙은 줄이 훨씬 잘 읽힌다.
    if (type !== "liquor" || queries.length > 1) {
      const results = await Promise.all(
        queries.map(async (q) => {
          if (type === "food") {
            try {
              const item = pickRepresentative(await searchShop(q, type));
              if (item) return { q, item };
            } catch {
              /* 쇼핑 API 가 죽어 있다 — 사진으로 넘어간다 */
            }
          }
          try {
            // 잔·도구는 "위스키 잔"처럼 술 이름을 달고 있어 술 거르기를 끈다
            const shot = await searchGoodsImage(q, { avoidDrink: type === "food" });
            return { q, item: shot ? { title: shot.title, image: shot.image } : null };
          } catch {
            return { q, item: null };
          }
        })
      );
      return NextResponse.json({ results });
    }

    let items = (await searchShop(queries[0], type)) || [];

    // 네이버 쇼핑이 닫혀 빈손이면 11번가에 물어본다.
    // 값의 성격이 다르므로(대개 매장 픽업가) 화면이 구분할 수 있도록 source 를 달아 보낸다.
    let source = items.length ? "naver" : null;
    if (!items.length && hasElevenstKey()) {
      try {
        items = await searchElevenst(queries[0], type);
        if (items.length) source = "11st";
      } catch (e) {
        console.error("[shop:11st]", e.message);
      }
    }

    // 값을 못 가져왔더라도 살 곳까지 끊지는 않는다. 검색 주소는 API가 아니라
    // 그냥 링크라, 가격만 빠지고 구매 경로는 그대로 남는다.
    if (!items.length && isShopRetired()) {
      return NextResponse.json({
        items: [],
        retired: true,
        searchUrl: shopSearchUrl(queries[0]),
        ...(await storedProduct(queries[0])),
      });
    }

    // 기준 최저가는 표시하는 4개가 아니라 검색 결과 전체로 계산한다.
    // 셀러 가치·가격 이력·특가 알림도 같은 계산을 쓰므로 화면끼리 숫자가 어긋나지 않는다.
    // 여러 제품이 섞여 단언할 수 없는 경우에는 null이 오고, 화면에서 표시하지 않는다.
    const ref = type === "liquor" ? priceReference(items) : null;
    return NextResponse.json({
      items: items.slice(0, 4),
      reference: ref?.low || null,
      sampled: ref?.sampled || 0,
      source,
    });
  } catch (err) {
    console.error("[shop]", err.message);
    return NextResponse.json({ items: null, results: null, error: true });
  }
}

/**
 * 카탈로그에 담아 둔 것에서 구매에 쓸 만한 것을 꺼낸다.
 *
 * 쇼핑 검색 API가 없어 값은 못 가져오지만, 사진을 붙일 때 받아 둔 주소 안에
 * 네이버쇼핑 카탈로그 번호가 남아 있다. 그 번호로 상품 페이지를 바로 열 수 있다.
 *
 * 온라인으로 살 수 있는지도 함께 알려 준다. 전통주만 통신판매가 허용되므로
 * 그 술에만 "지금 주문할 수 있다"고 말할 수 있다.
 */
async function storedProduct(name) {
  try {
    const db = await getDb();
    if (!db) return {};
    const doc = await db
      .collection("catalog")
      .findOne({ key: catalogKey(name, null) }, { projection: { image: 1, category: 1 } });
    if (!doc) return {};
    const online = ONLINE_SALE_OK.has(doc.category);
    return {
      productUrl: productUrlFromImage(doc.image),
      onlineSale: online,
      ...(online ? { onlineShops: onlineShops(name) } : {}),
    };
  } catch {
    return {};
  }
}
