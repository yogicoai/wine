import { NextResponse } from "next/server";
import { searchTrend } from "@/lib/trend";

export const runtime = "nodejs";
// 한 달 단위 자료라 자주 부를 이유가 없다. 하루에 한 번이면 충분하다.
export const revalidate = 86400;

// 요즘 사람들이 무엇을 검색하는지 — 네이버 데이터랩.
// 값은 절대 검색량이 아니라 다섯 낱말끼리의 상대값이다. 화면에서도 그렇게 적는다.
export async function GET() {
  try {
    const trend = await searchTrend();
    if (!trend) return NextResponse.json({ items: [] });
    return NextResponse.json(trend);
  } catch {
    return NextResponse.json({ items: [] });
  }
}
