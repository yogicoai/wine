import { NextResponse } from "next/server";
import { searchLocalPlaces, hasNaverKeys } from "@/lib/naver";
import { placeTerms, placeQuery, isDrinkPlace, isBuyPlace } from "@/lib/places";

export const runtime = "nodejs";

// 근처에서 이 술을 마시거나 살 수 있는 곳.
//
// 쇼핑 검색 API가 2026-07-31 에 내려가면서 "여기서 사세요"는 걸 수 없게 됐다.
// 다만 한국에서는 원래 술을 온라인으로 팔 수 없어(전통주 제외) 그 링크는
// 살아 있을 때도 실제 구매로 이어지지 않았다. 지역검색이 오히려 본래 답이다.
//
// 지역검색은 좌표를 받지 않는다. 그래서 지역 이름을 반드시 받아야 하고,
// 없으면 전국이 섞여 나온다("사케 파는 곳" → 부산·부천·서울이 함께).
export async function GET(request) {
  if (!hasNaverKeys()) {
    return NextResponse.json({ places: { drink: [], buy: [] }, reason: "키 없음" });
  }

  const { searchParams } = new URL(request.url);
  const area = (searchParams.get("area") || "").trim();
  const category = searchParams.get("category") || "";

  // 지역이 없으면 부르지 않는다. 전국이 섞인 목록은 없는 것만 못하다.
  if (area.length < 2) {
    return NextResponse.json({ places: { drink: [], buy: [] }, reason: "지역 필요" });
  }

  const terms = placeTerms(category);
  try {
    // 두 번을 한꺼번에 부르지 않는다. 네이버 검색 API는 몰아서 부르면
    // 오류 대신 빈 목록을 돌려주는 때가 있다 — "부산 서면 이자카야"가 따로
    // 부르면 다섯 곳이 나오는데 동시에 부르면 0건이 됐다.
    const drink = await searchLocalPlaces(placeQuery(area, terms.drink));
    const buy = await searchLocalPlaces(placeQuery(area, terms.buy));

    // 같은 가게가 두 목록에 겹쳐 나오면 "마실 곳" 쪽에만 남긴다.
    const drinkList = (drink || []).filter(isDrinkPlace);
    const seen = new Set(drinkList.map((p) => p.name));
    const buyList = (buy || []).filter((p) => isBuyPlace(p) && !seen.has(p.name));

    return NextResponse.json({
      area,
      terms,
      places: { drink: drinkList, buy: buyList },
    });
  } catch {
    return NextResponse.json({ places: { drink: [], buy: [] }, reason: "조회 실패" });
  }
}
