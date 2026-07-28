import { NextResponse } from "next/server";
import { checkDeals, filterAlreadyNotified } from "@/lib/deals";
import { checkDrinkWindows, drinkPayload } from "@/lib/drinkAlerts";
import { sendToAll, pushConfigured } from "@/lib/push";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 정기 점검 — Vercel Cron이 하루 한 번 호출한다.
//   1) 음용 적기가 된 술을 알린다 (DB만 읽으므로 무료)
//   2) 셀러/위시리스트 항목의 최저가를 확인하고, 특가면 알린다 (+ 가격 이력 적립)
//
// 보안: 아무나 호출해 비용을 유발하지 못하도록 CRON_SECRET으로 막는다.
// (Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 붙여 호출한다)
async function run(request) {
  const secret = env("CRON_SECRET");
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "권한 없음" }, { status: 401 });
    }
  }

  // ── 1) 음용 적기 — DB만 읽으므로 판매처가 막혀 있어도 항상 동작한다.
  //    판정과 동시에 "올해 알림 보냄"으로 기록되므로, 실제로 보낼 수 있을 때만 확인한다.
  //    (푸시 미설정 상태에서 확인하면 그 해 알림을 통째로 잃는다)
  let drinkDue = [];
  let drinkPush = null;
  if (pushConfigured()) {
    ({ items: drinkDue } = await checkDrinkWindows({ max: 5 }));
    if (drinkDue.length) drinkPush = await sendToAll(drinkPayload(drinkDue));
  }

  // ── 2) 특가
  const { deals, checked, skipped } = await checkDeals({ max: 25, ignoreStale: true });
  if (skipped) {
    return NextResponse.json({ skipped, checked: 0, notified: 0, drink: drinkDue.length, drinkPush });
  }

  // 같은 특가를 반복해서 알리지 않는다
  const fresh = await filterAlreadyNotified(deals);
  if (!fresh.length) {
    return NextResponse.json({
      checked,
      found: deals.length,
      notified: 0,
      drink: drinkDue.length,
      drinkPush,
    });
  }

  const top = fresh[0];
  const more = fresh.length - 1;
  const payload = {
    title: more > 0 ? `특가 ${fresh.length}건을 찾았습니다` : "찜해 둔 술이 특가입니다",
    body:
      `${top.name} ${top.price.toLocaleString("ko-KR")}원` +
      (top.reason === "target" ? " · 목표가 도달" : " · 최저가 경신") +
      (more > 0 ? ` 외 ${more}건` : ""),
    url: "/?cellar=1",
    tag: "deal",
  };

  const result = await sendToAll(payload);
  return NextResponse.json({
    checked,
    found: deals.length,
    notified: fresh.length,
    push: result,
    drink: drinkDue.length,
    drinkPush,
  });
}

export async function GET(request) {
  return run(request);
}

// 수동 실행·테스트용
export async function POST(request) {
  return run(request);
}
