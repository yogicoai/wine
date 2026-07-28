import { NextResponse } from "next/server";
import { searchShop, pickRepresentative, priceReference, hasNaverKeys } from "@/lib/naver";

export const runtime = "nodejs";

// GET /api/shop?q=샤또딸보              → { items: [...] }        (주류, 최대 4개)
// GET /api/shop?type=food&q=A&q=B&q=C  → { results: [{q, item}] } (안주, 키워드별 1개)
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const queries = params.getAll("q").filter(Boolean);
  const type = params.get("type") === "food" ? "food" : "liquor";
  if (!queries.length) return NextResponse.json({ error: "q 필요" }, { status: 400 });
  if (!hasNaverKeys()) return NextResponse.json({ items: null, results: null, noApi: true });

  try {
    // 여러 키워드 → 키워드별 대표 상품 1개씩 (안주 추천용)
    if (queries.length > 1) {
      const results = await Promise.all(
        queries.map(async (q) => {
          try {
            return { q, item: pickRepresentative(await searchShop(q, type)) };
          } catch {
            return { q, item: null };
          }
        })
      );
      return NextResponse.json({ results });
    }

    const items = (await searchShop(queries[0], type)) || [];

    // 기준 최저가는 표시하는 4개가 아니라 검색 결과 전체로 계산한다.
    // 셀러 가치·가격 이력·특가 알림도 같은 계산을 쓰므로 화면끼리 숫자가 어긋나지 않는다.
    // 여러 제품이 섞여 단언할 수 없는 경우에는 null이 오고, 화면에서 표시하지 않는다.
    const ref = type === "liquor" ? priceReference(items) : null;
    return NextResponse.json({
      items: items.slice(0, 4),
      reference: ref?.low || null,
      sampled: ref?.sampled || 0,
    });
  } catch (err) {
    console.error("[shop]", err.message);
    return NextResponse.json({ items: null, results: null, error: true });
  }
}
