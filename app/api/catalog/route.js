import { NextResponse } from "next/server";
import { catalogStats } from "@/lib/catalog";
import { buildSeedList } from "@/lib/seedList";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한

// GET /api/catalog            → 카탈로그 적재 현황
// GET /api/catalog?seed=1     → 네이버 인기 상품 기반 선적재 후보 목록 (AI 호출 없음·무료)
//     &categories=wine,whisky&perQuery=20
export async function GET(request) {
  const params = new URL(request.url).searchParams;

  if (params.get("seed")) {
    const categories = params.get("categories")?.split(",").filter(Boolean);
    const perQuery = Number(params.get("perQuery")) || 20;
    const list = await buildSeedList({ categories, perQuery });
    if (!list) return NextResponse.json({ error: "네이버 API 키가 필요합니다." }, { status: 400 });

    const byCategory = list.reduce((acc, it) => {
      acc[it.category] = (acc[it.category] || 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ total: list.length, byCategory, list });
  }

  const stats = await catalogStats();
  if (!stats) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  return NextResponse.json(stats);
}
