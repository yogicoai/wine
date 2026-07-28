import { NextResponse } from "next/server";
import { checkDeals } from "@/lib/deals";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한

// 셀러 화면 진입 시 호출 — 오래된 항목만 확인하므로 부담이 적다
export async function POST() {
  const { deals, checked, skipped } = await checkDeals({ max: 12 });
  if (skipped === "noDb") return NextResponse.json({ deals: [], noDb: true });
  if (skipped === "noApi") return NextResponse.json({ deals: [], noApi: true });
  return NextResponse.json({ deals, checked });
}
