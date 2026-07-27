import { NextResponse } from "next/server";
import { searchShop, hasNaverKeys } from "@/lib/naver";

export const runtime = "nodejs";

// 같은 술의 빈티지별 가격 비교
// GET /api/vintages?q=샤또 딸보
export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q 필요" }, { status: 400 });
  if (!hasNaverKeys()) return NextResponse.json({ vintages: null, noApi: true });

  // 연도를 뺀 기본 이름으로 검색해야 여러 빈티지가 함께 잡힘
  const base = q.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();

  try {
    const items = (await searchShop(base, "liquor", { display: 40 })) || [];

    // 상품명에서 빈티지 연도 추출 → 연도별 최저가 집계
    const byYear = new Map();
    for (const it of items) {
      if (!it.price) continue;
      const m = it.title.match(/\b(19[89]\d|20[0-4]\d)\b/); // 1980~2049
      if (!m) continue;
      const year = m[1];
      const cur = byYear.get(year);
      if (!cur || it.price < cur.price) {
        byYear.set(year, { year, price: it.price, mall: it.mall, link: it.link, direct: it.direct });
      }
    }

    const vintages = [...byYear.values()].sort((a, b) => Number(b.year) - Number(a.year));
    return NextResponse.json({ vintages, base });
  } catch (err) {
    console.error("[vintages]", err.message);
    return NextResponse.json({ vintages: null, error: true });
  }
}
