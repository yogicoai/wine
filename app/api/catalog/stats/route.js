import { NextResponse } from "next/server";
import { catalogStats } from "@/lib/catalog";

export const runtime = "nodejs";

// 카탈로그 현황 — 몇 종을 보유했고 어디가 두꺼운지
export async function GET() {
  const stats = await catalogStats();
  if (!stats) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  return NextResponse.json(stats);
}
