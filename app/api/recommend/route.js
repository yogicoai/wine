import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { profileFromAnswers } from "@/lib/taste";
import { recommendByTaste, recommendForBeginner, recommendByBand } from "@/lib/recommend";
import { APP_CATEGORIES } from "@/lib/appProfile";

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
    // 주종을 지정하지 않으면 이 앱이 보는 주종 전부를 훑는다
    // (전통술 앱은 전통주+소주, 스피리츠 앱은 브랜디·진·럼… 을 함께 본다)
    const asked = params.get("category");
    const categories = asked ? [asked] : APP_CATEGORIES;
    const category = asked || null;
    // 가격대는 성격(맞춤·입문자·둘러보기)과 별개로 걸 수 있다.
    // "입문자용인데 5만원 이하" 같은 조합이 실제로 가장 많이 나오는 질문이다.
    const band = Number(params.get("band")) || null;

    if (mode === "beginner") {
      return NextResponse.json({
        mode,
        band,
        ...(await recommendForBeginner({ limit, category, band })),
      });
    }

    if (mode === "browse" || mode === "price") {
      return NextResponse.json({
        mode,
        band,
        ...(await recommendByBand(band, { limit, category })),
      });
    }

    // 저장해 둔 문답 답변을 불러와 함께 쓴다.
    // 문항이 주종을 따르므로 답변도 주종별로 저장돼 있다.
    const owner = params.get("owner") || "local";
    const saved = await db
      .collection("preferences")
      .find({ owner, category: { $in: categories } })
      .toArray();

    const answersByCategory = {};
    for (const doc of saved) {
      if (doc.answers) answersByCategory[doc.category] = profileFromAnswers(doc.answers, doc.category);
    }

    const result = await recommendByTaste({ answersByCategory, limit, band, category });
    if (!result) {
      // 취향을 알 방법이 아직 없다. 그렇다고 빈 목록을 내려보내면, 앱을 처음 연
      // 사람에게는 첫 화면이 통째로 비어 고장으로 보인다. 아무것도 모를 때
      // 가장 안전한 답은 입문자용이므로 그것을 먼저 채우고, 그마저 비면
      // (그 주종에 입문자 점수 60을 넘는 술이 아직 없으면) 둘러보기로 내려간다.
      const beginner = await recommendForBeginner({ limit, category, band });
      const usedBeginner = !!beginner?.items?.length;
      const filled = usedBeginner ? beginner : await recommendByBand(band, { limit, category });
      return NextResponse.json({
        ...filled,
        mode,
        band,
        needsProfile: true, // 화면은 여전히 문답을 권한다 — 이건 임시로 채운 목록이다
        filledWith: usedBeginner ? "beginner" : "browse",
      });
    }
    return NextResponse.json({ mode, ...result });
  } catch (err) {
    console.error("[recommend]", err);
    return NextResponse.json({ error: "추천을 만들지 못했습니다.", items: [] }, { status: 500 });
  }
}
