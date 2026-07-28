import { NextResponse } from "next/server";
import { checkDeals } from "@/lib/deals";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한

// 셀러 화면 진입 시 호출 — 오래된 항목만 확인하므로 부담이 적다.
// all:true 로 부르면 스테일 여부를 무시하고 전부 확인한다 ("시세 갱신" 버튼).
// 판매처 API는 무료라 비용은 들지 않고, 항목 수만큼 시간이 걸린다.
export async function POST(request) {
  let all = false;
  try {
    all = (await request.json())?.all === true;
  } catch {
    /* 본문이 없으면 기본값 */
  }

  const { deals, checked, skipped } = await checkDeals({
    max: all ? 40 : 12,
    ignoreStale: all,
  });
  if (skipped === "noDb") return NextResponse.json({ deals: [], noDb: true });
  if (skipped === "noApi") return NextResponse.json({ deals: [], noApi: true });
  return NextResponse.json({ deals, checked });
}
