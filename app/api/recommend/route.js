import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { profileFromAnswers } from "@/lib/taste";
import { recommendByTaste, recommendForBeginner, recommendByBand } from "@/lib/recommend";

export const runtime = "nodejs";

// 추천 — 우리 카탈로그 안에서 고르므로 AI 호출이 없고 비용도 들지 않는다.
//   /api/recommend?mode=taste     취향 맞춤 (문답 + 별점 기록)
//   /api/recommend?mode=beginner  초보자용
//   /api/recommend?mode=price&band=2  가격대별
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") || "taste";
  const limit = Math.min(20, Number(params.get("limit")) || 8);

  const db = await getDb();
  if (!db) return NextResponse.json({ noDb: true, items: [] });

  try {
    const category = params.get("category") || "wine";

    if (mode === "beginner") {
      return NextResponse.json({ mode, ...(await recommendForBeginner({ limit, category })) });
    }

    if (mode === "price") {
      const band = Number(params.get("band"));
      if (!band) return NextResponse.json({ error: "band 필요" }, { status: 400 });
      return NextResponse.json({
        mode,
        band,
        ...(await recommendByBand(band, { limit, category })),
      });
    }

    // 저장해 둔 문답 답변을 불러와 함께 쓴다
    const owner = params.get("owner") || "local";
    const saved = await db.collection("preferences").findOne({ owner });
    const answers = saved?.answers ? profileFromAnswers(saved.answers) : null;

    const result = await recommendByTaste({ answers, limit });
    if (!result) {
      // 취향을 알 방법이 아직 없다 — 화면에서 문답으로 안내한다
      return NextResponse.json({ mode, items: [], needsProfile: true });
    }
    return NextResponse.json({ mode, ...result });
  } catch (err) {
    console.error("[recommend]", err);
    return NextResponse.json({ error: "추천을 만들지 못했습니다.", items: [] }, { status: 500 });
  }
}
