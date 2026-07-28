import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

// 이름으로 술 찾기 — 카탈로그만 읽으므로 비용이 들지 않는다.
// 사진을 찍을 상황이 아닐 때(집에서 검색, 선물 고를 때)의 진입로다.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") || "";
  const category = params.get("category") || null;

  if (q.trim().length < 1) return NextResponse.json({ items: [], q });

  const items = await searchCatalog(q, { limit: 20, category });
  return NextResponse.json({ q, items });
}
