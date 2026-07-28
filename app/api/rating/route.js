import { NextResponse } from "next/server";
import { getRating } from "@/lib/ratings";

export const runtime = "nodejs";

// 한 술의 집단 평점 조회 — DB만 읽으므로 비용이 들지 않는다
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name");
  const vintage = params.get("vintage") || null;
  if (!name) return NextResponse.json({ rating: null });

  return NextResponse.json({ rating: await getRating(name, vintage) });
}
