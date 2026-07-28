import { NextResponse } from "next/server";
import { listWanted } from "@/lib/wanted";

export const runtime = "nodejs";

// 사용자가 찾았지만 우리가 못 준 이름들 — 많이 놓친 순.
// 카탈로그에 다음으로 넣을 목록이 여기서 나온다.
export async function GET(request) {
  const limit = Math.min(300, Number(new URL(request.url).searchParams.get("limit")) || 100);
  const items = await listWanted({ limit });
  return NextResponse.json({ total: items.length, items });
}
