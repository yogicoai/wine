import { NextResponse } from "next/server";
import { harvestCatalog } from "@/lib/harvest";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한 — 카테고리를 나눠 여러 번 부른다

// 네이버 인기 상품 수확 — "실제로 팔리는 술"을 뼈대(stub)로 적재한다.
//
// 내가 아는 유명 와인을 넣는 것보다 이쪽이 적중률이 높다. 사람들이 찍는 술은
// 결국 지금 팔리는 술이기 때문이다. 네이버 API는 무료라 비용도 없다.
//
// 기본은 dry-run: 무엇이 새로 들어올지만 보여 준다.
// confirm:true 를 줘야 실제로 적재한다.
//
// POST { categories?: ["wine"], perQuery?: 20, pages?: 1, confirm?: false }
export async function POST(request) {
  // 대량 쓰기라 아무나 부르면 곤란하다
  const secret = env("CRON_SECRET");
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const opts = await request.json().catch(() => ({}));
  const result = await harvestCatalog(opts);
  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
