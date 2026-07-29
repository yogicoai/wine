import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/mongodb";
import { catalogKey } from "@/lib/catalog";
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

  // 큐레이션(가격대·초보자 점수·태그)은 적재할 때 씨드 항목에만 붙는다.
  // 스캔이나 수확으로 들어온 술은 이름이 같아도 값을 못 받으므로 여기서 마저 채운다.
  const curated = await applyCuration(col);

  return NextResponse.json({ checked: targets.length, country, taste, byCountry, curated });
}

async function applyCuration(col) {
  let rows;
  try {
    rows = JSON.parse(await readFile(path.join(process.cwd(), "data", "curation.json"), "utf-8"));
  } catch {
    return 0; // 파일이 없어도 나머지 백필은 그대로 진행한다
  }

  let n = 0;
  for (const c of rows) {
    if (!c?.name) continue;
    const set = {};
    if (c.priceBand != null) set.priceBand = c.priceBand;
    if (c.beginner != null) set.beginner = c.beginner;
    if (c.tags?.length) set.tags = c.tags;
    if (!Object.keys(set).length) continue;

    // 이름이 아니라 조회 키로 찾는다 — 괄호·띄어쓰기가 달라도 같은 술을 집는다.
    // 가격대와 초보자 점수는 빈티지와 무관하므로 키의 이름 부분만 맞춘다
    // ("…|" 와 "…|2022" 가 모두 걸리게).
    const base = catalogKey(c.name, null).slice(0, -1); // 끝의 "|" 를 뗀다
    const { modifiedCount } = await col.updateMany(
      { key: new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\|`) },
      { $set: set }
    );
    n += modifiedCount;
  }
  return n;
}
