import { NextResponse } from "next/server";
import { harvestCatalog } from "@/lib/harvest";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";
import { APP_CATEGORIES, APP } from "@/lib/appProfile";

export const runtime = "nodejs";
export const maxDuration = 60;

// 정기 수확 — 새로 팔리기 시작한 술이 저절로 카탈로그에 들어오게 한다.
//
// 하루 한 번 도는데, 60초 상한 안에 들어가도록 그날은 한 주종만 훑는다.
//
// 여섯 앱이 같은 저장소에서 배포되므로 vercel.json 의 이 크론도 여섯 번 돈다.
// 앱마다 제 주종만 훑어야 그 여섯 번이 중복이 아니라 분담이 된다.
// (예전에는 앱과 무관한 고정 순번을 돌아, 여섯 프로젝트가 같은 날 같은
//  주종을 여섯 번 긁었다)
const FALLBACK = ["wine", "whisky", "traditional", "sake", "beer", "brandy", "soju", "gin"];

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

  // 날짜 기반 순환 — 상태를 저장하지 않아도 매일 다른 주종이 걸린다.
  // 주종이 하나뿐인 앱(와인·사케·맥주)은 매일 그 하나를 훑는다.
  const pool = APP_CATEGORIES?.length ? APP_CATEGORIES : FALLBACK;
  const day = Math.floor(Date.now() / 86400000);
  const category = pool[day % pool.length];

  const result = await harvestCatalog({
    categories: [category],
    perQuery: 10,
    pages: 1,
    confirm: true,
  });

  console.log(`[cron/harvest][${APP.key}] ${category}: 수집 ${result.collected} → 삽입 ${result.inserted}`);
  return NextResponse.json({ app: APP.key, category, ...result });
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}
