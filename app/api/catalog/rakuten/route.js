import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { searchRakuten, japanPrice, hasRakutenKey } from "@/lib/rakuten";

export const runtime = "nodejs";
export const maxDuration = 300;

// 사케에 일본 현지가를 붙인다 (출처: 라쿠텐 이치바).
//
// 국내가가 아니다. 관세·주세·운임 전이라 직접 견줄 수 없고, 화면에서도
// "일본 현지가 · 참고"로만 적는다.
//
// 일본어 이름으로 물어야 잘 맞는다. さけのわ 를 붙일 때 받아 둔 sakenowa.brand
// 가 바로 그 값이라, 그것이 있는 술만 대상으로 삼는다.
//
//   GET  ?dryRun=1&limit=20   무엇이 붙을지만 본다
//   POST ?limit=60            실제로 적용
async function run({ dryRun, limit }) {
  if (!hasRakutenKey()) {
    return { error: "RAKUTEN_APP_ID 가 필요합니다 (https://webservice.rakuten.co.jp 무료 발급)" };
  }
  const db = await getDb();
  if (!db) return { error: "DB 미설정" };
  const col = db.collection("catalog");

  const targets = await col
    .find(
      { category: "sake", "sakenowa.brand": { $exists: true, $ne: null } },
      { projection: { name: 1, sakenowa: 1, priceInfo: 1 } }
    )
    .limit(limit)
    .toArray();

  const done = [];
  const missed = [];
  for (const o of targets) {
    const jp = o.sakenowa.brand;
    const items = await searchRakuten(jp);
    const price = items ? japanPrice(jp, items) : null;
    if (!price) {
      missed.push(o.name);
    } else {
      done.push({ name: o.name, jp, low: price.low, high: price.high, n: price.sampled, sample: price.sample });
      if (!dryRun) {
        await col.updateOne(
          { _id: o._id },
          {
            $set: {
              "priceInfo.jpyLow": price.low,
              "priceInfo.jpyHigh": price.high,
              "priceInfo.jpyAt": new Date(),
            },
          }
        );
      }
    }
    // 라쿠텐은 초당 한 번을 권한다. 몰아 부르면 막힌다.
    await new Promise((r) => setTimeout(r, 1100));
  }
  return { dryRun: !!dryRun, 대상: targets.length, 붙음: done.length, 못붙음: missed.length, done, missed: missed.slice(0, 15) };
}

export async function GET(request) {
  const p = new URL(request.url).searchParams;
  return NextResponse.json(
    await run({ dryRun: p.get("dryRun") === "1", limit: Math.min(60, Number(p.get("limit")) || 20) })
  );
}

export async function POST(request) {
  const p = new URL(request.url).searchParams;
  return NextResponse.json(await run({ dryRun: false, limit: Math.min(60, Number(p.get("limit")) || 60) }));
}
