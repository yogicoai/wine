import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { guessCountry } from "@/lib/countryGuess";
import { guessTasteProfile } from "@/lib/varietal";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 비어 있는 칸을 이름 단서로 채운다 — AI 없이, 비용 0원.
//
// 수확으로 들어온 뼈대는 이름과 가격밖에 없다. 그런데 이름 안에 단서가 있다.
// "샤또"가 붙으면 프랑스고, "카베르네"가 붙으면 떫은 레드다.
// 맛 축이 없으면 취향 추천 후보에서 아예 빠지므로, 이 작업이 곧 추천 품질이다.
export async function POST(request) {
  const secret = env("CRON_SECRET");
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const col = db.collection("catalog");
  const targets = await col
    .find(
      {
        $or: [
          { "result.country": { $in: [null, undefined] } },
          { "result.tasteProfile.1": { $exists: false } },
        ],
      },
      {
        projection: {
          name: 1, category: 1,
          "result.region": 1, "result.type": 1, "result.country": 1, "result.tasteProfile": 1,
        },
      }
    )
    .limit(20000)
    .toArray();

  let country = 0;
  let taste = 0;
  const byCountry = {};

  for (const doc of targets) {
    const set = {};

    if (!doc.result?.country) {
      const guess = guessCountry({
        name: doc.name,
        category: doc.category,
        region: doc.result?.region,
        type: doc.result?.type,
      });
      if (guess) {
        set["result.country"] = guess;
        byCountry[guess] = (byCountry[guess] || 0) + 1;
        country++;
      }
    }

    if (!(doc.result?.tasteProfile?.length >= 2)) {
      const guess = guessTasteProfile({
        name: doc.name,
        type: doc.result?.type,
        category: doc.category,
      });
      if (guess) {
        set["result.tasteProfile"] = guess;
        // 실제 분석이 붙으면 덮어쓰이지만, 그전까지는 추정임을 남긴다
        set["result.tasteEstimated"] = true;
        taste++;
      }
    }

    if (Object.keys(set).length) await col.updateOne({ _id: doc._id }, { $set: set });
  }

  return NextResponse.json({ checked: targets.length, country, taste, byCountry });
}
