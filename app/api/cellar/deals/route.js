import { NextResponse } from "next/server";
import { checkDeals } from "@/lib/deals";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한

// 전체 갱신을 마지막으로 돌린 시각. 연달아 누르면 같은 값을 다시 긁을 뿐이다.
// AI 비용은 들지 않지만(판매처 API는 무료) 무료 쿼터를 축내고 매번 수십 초가 걸린다.
let lastFullRun = 0;
const FULL_COOLDOWN = 3 * 60 * 1000;

// 셀러 화면 진입 시 호출 — 오래된 항목만 확인하므로 부담이 적다.
// all:true 로 부르면 스테일 여부를 무시하고 전부 확인한다 ("시세 갱신" 버튼).
export async function POST(request) {
  let all = false;
  try {
    all = (await request.json())?.all === true;
  } catch {
    /* 본문이 없으면 기본값 */
  }

  if (all) {
    const since = Date.now() - lastFullRun;
    if (since < FULL_COOLDOWN) {
      return NextResponse.json({
        deals: [],
        checked: 0,
        cooldown: Math.ceil((FULL_COOLDOWN - since) / 1000),
      });
    }
    lastFullRun = Date.now();
  }

  const { deals, checked, skipped } = await checkDeals({
    max: all ? 40 : 12,
    ignoreStale: all,
  });
  if (skipped === "noDb") return NextResponse.json({ deals: [], noDb: true });
  if (skipped === "noApi") return NextResponse.json({ deals: [], noApi: true });
  return NextResponse.json({ deals, checked });
}
