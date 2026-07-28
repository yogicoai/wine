import { NextResponse } from "next/server";
import { saveSubscription, removeSubscription, pushConfigured, subscriptionCount } from "@/lib/push";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// 브라우저가 구독을 만들 때 필요한 공개 키를 내려준다
export async function GET() {
  return NextResponse.json({
    enabled: pushConfigured(),
    publicKey: env("VAPID_PUBLIC_KEY") || null,
    subscribers: await subscriptionCount(),
  });
}

export async function POST(request) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: "푸시 키가 설정되지 않았습니다." }, { status: 400 });
  }
  const subscription = await request.json().catch(() => null);
  const ok = await saveSubscription(subscription);
  if (!ok) return NextResponse.json({ error: "구독 정보를 저장하지 못했습니다." }, { status: 400 });
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request) {
  const { endpoint } = await request.json().catch(() => ({}));
  await removeSubscription(endpoint);
  return NextResponse.json({ subscribed: false });
}
