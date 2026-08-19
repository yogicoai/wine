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
import { priceOf, hasPriceKey, priceReadyFor } from "@/lib/danawa";
import { dailyshotFor } from "@/lib/dailyshot";
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

    // 이 술이 어느 주종인지 먼저 본다 — 어디에 물을지가 여기서 갈린다.
    const cat = await categoryOf(queries[0]);

    // 데일리샷이 첫 번째다.
    //
    // 미리 담아 둔 우리 색인을 읽으므로 남의 서버를 두드리지 않고, 크레딧도 들지
    // 않으며, DB 조회라 즉시 끝난다. 게다가 이름·도수·용량을 맞춰 고른 한 건이라
    // 검색 결과 스무 개에서 골라내는 것보다 정확하다. 파는 곳 수가 함께 오는 것도
    // 여기뿐이다 — 880곳이 파는 값은 시세지만 한 곳뿐인 값은 그 가게 값이다.
    const ds = cat ? await dailyshotFor(queries[0], { category: cat }) : null;
    if (ds) {
      return NextResponse.json({
        items: [
          {
            title: ds.name,
            link: ds.url,
            image: ds.image,
            mall: "데일리샷",
            price: ds.low,
          },
        ],
        reference: ds.low,
        // 검색 건수가 아니라 "이 술을 파는 곳"의 수다. 화면이 그렇게 밝힌다.
        sampled: ds.sellers,
        source: "dailyshot",
        high: ds.high,
        volume: ds.volume,
        ...(await storedProduct(queries[0])),
      });
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

    // 그래도 빈손이면 다나와를 본다.
    //
    // 다나와는 주종을 크게 탄다 — 위스키만 쓸 만하고 나머지는 엉뚱한 값을 준다
    // (lib/danawa.js 의 PRICE_READY 에 실측을 적어 두었다). 그래서 이 술이 어느
    // 주종인지 먼저 보고 부른다. 값을 못 얻는 것보다 틀린 값이 나쁘다.
    if (!items.length && hasPriceKey()) {
      if (cat && priceReadyFor(cat)) {
        try {
          const found = await priceOf(queries[0], { category: cat });
          if (found?.length) {
            items = found;
            source = "danawa";
          }
        } catch (e) {
          console.error("[shop:danawa]", e.message);
        }
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
    // 기준 최저가를 내는 방식이 출처마다 다르다.
    //
    // 네이버는 한 번에 스무 건씩 줬고 그 안에 다른 제품이 섞여 있었다. 그래서
    // 세 건 이상이고 값이 네 배 안으로 모여 있을 때만 단언했다.
    //
    // 다나와는 우리가 이름·도수·묶음까지 맞춰 걸러 낸 뒤라 한두 건만 남는 것이
    // 정상이다. 여기에 같은 잣대를 들이대면 멀쩡히 찾은 값을 버리게 된다 —
    // 실제로 글렌피딕 18년이 그렇게 사라졌다.
    const ref =
      type !== "liquor"
        ? null
        : source === "danawa"
          ? { low: items[0].price, sampled: items.length }
          : priceReference(items);
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

/**
 * 이 이름이 어느 주종인가 — 가격을 어디서 물을지 정하는 데 쓴다.
 *
 * 이름 열쇠 하나로만 찾으면 자주 빗나간다. 화면은 AI 가 준 국내 통용 표기를
 * 먼저 넘기는데 그것이 카탈로그의 이름과 다를 수 있기 때문이다 —
 * "믹터스 US*1 싱글배럴 라이"를 "믹터스 싱글배럴 라이"로 물으면 못 찾았다.
 * 그래서 열쇠 → 검색어 → 이름 순으로 세 번 두드린다.
 */
async function categoryOf(name) {
  try {
    const db = await getDb();
    if (!db) return null;
    const col = db.collection("catalog");
    const proj = { projection: { category: 1 } };

    let doc = await col.findOne({ key: catalogKey(name, null) }, proj);
    if (doc) return doc.category || null;

    doc = await col.findOne({ searchKeyword: name }, proj);
    if (doc) return doc.category || null;

    // 정규식 특수문자를 그대로 넣으면 조회가 깨진다 (믹터스 US*1 의 * 가 그렇다)
    const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    doc = await col.findOne({ name: new RegExp(`^${safe}$`, "i") }, proj);
    return doc?.category || null;
  } catch {
    return null;
  }
}
