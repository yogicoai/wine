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
import { dailyshotById, dailyshotFor, goodsFor, livePrice, searchAndMatch } from "@/lib/dailyshot";
import { searchElevenst, hasElevenstKey } from "@/lib/elevenst";

export const runtime = "nodejs";

// GET /api/shop?q=샤또딸보              → { items: [...] }        (주류, 최대 4개)
// GET /api/shop?q=…&ds=4114             → 카탈로그에 이어 둔 데일리샷 상품 번호로 바로(이름으로 다시 찾지 않는다)
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
          // 잔과 도구는 술이 아니라 온라인 판매에 아무 제한이 없다. 그래서
          // 링크가 곧 구매로 이어지는데, 지금까지는 쿠팡 검색 주소만 걸어
          // 두었다 — 그것은 "찾아보세요"이지 "이것을 사세요"가 아니다.
          // 데일리샷에 주류 용품이 105건 있어, 맞는 것이 있으면 값과 함께 준다.
          if (type === "goods") {
            try {
              const g = await goodsFor(q);
              if (g) return { q, item: { title: g.name, image: g.image, price: g.price, link: g.url, mall: "데일리샷" } };
            } catch {
              /* 용품 색인이 비어 있어도 사진까지 막을 것은 없다 */
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

    // 카탈로그와 이어진 술이면 그 데일리샷 상품 번호로 바로 — 이름으로 찾다 비슷한 상품에 붙지 않게(2026-10-29)
    const exact = params.get("ds") ? await dailyshotById(params.get("ds")) : null;

    // 이 술이 어느 주종인지 먼저 본다 — 어디에 물을지가 여기서 갈린다.
    const cat = exact ? null : await categoryOf(queries[0]);

    // 데일리샷이 첫 번째다.
    //
    // 미리 담아 둔 우리 색인을 읽으므로 남의 서버를 두드리지 않고, 크레딧도 들지
    // 않으며, DB 조회라 즉시 끝난다. 게다가 이름·도수·용량을 맞춰 고른 한 건이라
    // 검색 결과 스무 개에서 골라내는 것보다 정확하다. 파는 곳 수가 함께 오는 것도
    // 여기뿐이다 — 880곳이 파는 값은 시세지만 한 곳뿐인 값은 그 가게 값이다.
    // 담아 둔 색인에서 먼저 찾고, 없으면 데일리샷 검색에 물어본다.
    //
    // 색인은 목록 API 를 훑어 만든 것이라 품절·비노출 상품이 빠져 있다. 그런
    // 것도 검색에는 걸린다. 다만 그쪽 검색은 매우 느슨해서 — "카시예로 델
    // 디아블로"에 2,956건을 주고 첫 줄이 "러시안 잭 소비뇽 블랑"이다 —
    // 결과를 후보로만 받고 판단은 우리 잣대로 한다.
    const ds = exact || (cat
      ? (await dailyshotFor(queries[0], { category: cat })) ||
        (await searchAndMatch(queries[0], { category: cat }))
      : null);
    if (ds) {
      // 이름은 색인에서 맞추고, 값은 판매처에 직접 묻는다.
      //
      // 색인에는 대표가만 있는 것이 많다. 목록 API 가 그것만 주기 때문이다.
      // 대표가는 정가에 가까워 실제로 사는 값과 꽤 차이가 난다 — 라가불린 16년이
      // 대표 142,000 원인데 매장 픽업 최저가는 91,506 원이었다.
      //
      // 그래서 사람이 그 술을 열어 볼 때 한 번 물어 채워 넣는다. 0.4 초쯤 걸리고,
      // 채워 둔 값은 반나절 동안 다시 쓰므로 두 번째 사람부터는 기다림이 없다.
      const live = await freshLow(ds);
      const low = live?.low || ds.low || null;
      // 보통 가격 — 이 술을 파는 매장 값의 가운데. 화면이 크게 쓴다(2026-10-29, 가장 싼 한 곳은 튀는 값일 수 있다)
      const typical = live?.mid || ds.mid || null;
      return NextResponse.json({
        items: [
          {
            title: ds.name,
            link: ds.url,
            image: ds.image,
            mall: "데일리샷",
            price: typical || low,
          },
        ],
        // 기준 최저가 — 지나치게 싼 값 · 품절을 뺀 가장 싼 곳. 술창고 가치 · 특가 알림 · 가격 이력이 같은 값을 쓴다
        reference: low,
        typical,
        typicalBand: live?.band ?? ds.midBand ?? null,
        typicalBandCount: live?.bandCount ?? ds.midBandCount ?? null,
        outliers: live?.outliers ?? ds.lowOutliers ?? 0,
        // pickup(국내 매장 픽업) | cross(해외직구 — 매장 픽업 판매처가 없는 술). 화면이 "해외직구"라고 밝힌다
        channel: live?.channel || ds.lowChannel || "pickup",
        // 검색 건수가 아니라 "이 술을 파는 곳"의 수다. 화면이 그렇게 밝힌다.
        sampled: live?.sellers ?? ds.sellers,
        // 이 값을 파는 매장. 상품 페이지를 열면 다른 값이 떠 있는 것이 보통이라
        // — 그쪽은 대표가나 가까운 매장 값을 띄운다 — 어디 값인지 밝혀 둔다.
        lowSeller: live?.seller ?? ds.lowSeller ?? null,
        lowRegion: live?.region ?? ds.lowRegion ?? null,
        // 판매처에 물어 확인한 값인지 — 화면이 "최저가"라고 부를지 결정한다
        verified: !!live || ds.verified,
        source: "dailyshot",
        high: ds.high,
        volume: ds.volume,
        // 값의 움직임. 방금 새로 물어봤다면 그 점이 아직 색인에 안 실려 있으므로
        // 여기서 오늘 자리에 얹는다 — 그래프의 끝이 화면의 숫자와 어긋나면
        // 둘 중 무엇을 믿어야 할지 알 수 없다.
        history: withToday(ds.history, low),
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

/** 이력의 끝을 지금 값으로 맞춘다 — 같은 날이면 갈아 끼우고, 새 날이면 붙인다 */
function withToday(history, low) {
  const points = Array.isArray(history) ? [...history] : [];
  if (!low) return points;
  const today = new Date().toISOString().slice(0, 10);
  const last = points[points.length - 1];
  if (last?.d === today) points[points.length - 1] = { d: today, p: Math.min(last.p, low) };
  else points.push({ d: today, p: low });
  return points;
}

// 최저가를 얼마나 오래 믿을 것인가. 반나절이면 값이 크게 흔들리지 않고,
// 인기 있는 술이라도 하루 두 번이면 남의 서버에 부담이 안 된다.
const LOW_TTL = 12 * 60 * 60 * 1000;

/**
 * 이 술의 지금 최저가 — 오래됐으면 판매처에 다시 묻고, 물은 값은 적어 둔다.
 *
 * 실패해도 조용히 넘어간다. 그때는 색인에 담긴 값을 쓰게 되고, 그것도 없으면
 * 대표가가 나간다. 값을 못 보여 주는 것보다는 조금 오래된 값이 낫다.
 */
async function freshLow(ds) {
  if (!ds?.itemId) return null;
  // 가운데 값(mid)이 없는 것은 10-29 전에 담은 값이다 — 한 곳 최저가뿐이라 반나절이 안 됐어도 다시 묻는다
  const fresh = ds.lowAt && ds.mid != null && Date.now() - new Date(ds.lowAt).getTime() < LOW_TTL;
  if (fresh)
    return {
      low: ds.low, sellers: ds.sellers, seller: ds.lowSeller, region: ds.lowRegion,
      mid: ds.mid, band: ds.midBand ?? null, bandCount: ds.midBandCount ?? null, outliers: ds.lowOutliers ?? 0,
      channel: ds.lowChannel || "pickup",
    };

  const live = await livePrice(ds.itemId);
  if (!live) return null;

  try {
    const db = await getDb();
    await db?.collection("dailyshot").updateOne(
      { itemId: ds.itemId },
      {
        $set: {
          low: live.low, sellers: live.sellers, lowAt: new Date(),
          lowSeller: live.seller || null, lowRegion: live.region || null,
          lowSoldOut: !!live.soldOut,
          mid: live.mid ?? null, midBand: live.band ?? null, midBandCount: live.bandCount ?? null, lowOutliers: live.outliers ?? 0,
          lowChannel: live.channel || "pickup",
        },
        $push: { history: { $each: [{ at: new Date(), low: live.low }], $slice: -60 } },
      }
    );
  } catch {
    /* 적어 두지 못해도 이번 화면은 보여 줄 수 있다 */
  }
  return live;
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
