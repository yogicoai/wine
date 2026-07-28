import { NextResponse } from "next/server";
import { harvestCatalog } from "@/lib/harvest";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 정기 수확 — 새로 팔리기 시작한 술이 저절로 카탈로그에 들어오게 한다.
//
// 하루 한 번 도는데, 60초 상한 안에 들어가도록 그날은 한 주종만 훑는다.
// 와인이 스캔의 대부분이므로 와인을 자주, 나머지는 돌아가며.
const ROTATION = [
  "wine", "whisky", "wine", "traditional", "wine", "sake", "wine",
  "beer", "wine", "brandy", "wine", "soju", "wine", "gin",
];

async function run(request) {
  const secret = env("CRON_SECRET");
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "권한 없음" }, { status: 401 });
    }
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ skipped: "noDb" });

  // 날짜 기반 순환 — 상태를 저장하지 않아도 매일 다른 주종이 걸린다
  const day = Math.floor(Date.now() / 86400000);
  const category = ROTATION[day % ROTATION.length];

  const result = await harvestCatalog({
    categories: [category],
    perQuery: 10,
    pages: 1,
    confirm: true,
  });

  console.log(`[cron/harvest] ${category}: 수집 ${result.collected} → 삽입 ${result.inserted}`);
  return NextResponse.json({ category, ...result });
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}
