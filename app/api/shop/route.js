import { NextResponse } from "next/server";
import { searchShop, pickRepresentative, hasNaverKeys } from "@/lib/naver";

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

    const items = await searchShop(queries[0], type);
    return NextResponse.json({ items: (items || []).slice(0, 4) });
  } catch (err) {
    console.error("[shop]", err.message);
    return NextResponse.json({ items: null, results: null, error: true });
  }
}
