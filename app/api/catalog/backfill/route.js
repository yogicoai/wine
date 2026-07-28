import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { guessCountry } from "@/lib/countryGuess";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 국가 없는 항목을 이름 단서로 채운다 — AI 없이, 비용 0원.
// 수확으로 들어온 뼈대 대부분이 여기서 국가를 얻는다.
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
      { $or: [{ "result.country": null }, { "result.country": { $exists: false } }] },
      { projection: { name: 1, category: 1, "result.region": 1, "result.type": 1 } }
    )
    .limit(10000)
    .toArray();

  let filled = 0;
  const byCountry = {};

  for (const doc of targets) {
    const country = guessCountry({
      name: doc.name,
      category: doc.category,
      region: doc.result?.region,
      type: doc.result?.type,
    });
    if (!country) continue;

    await col.updateOne({ _id: doc._id }, { $set: { "result.country": country } });
    filled++;
    byCountry[country] = (byCountry[country] || 0) + 1;
  }

  return NextResponse.json({ checked: targets.length, filled, unknown: targets.length - filled, byCountry });
}
