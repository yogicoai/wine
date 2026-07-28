import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { searchShop, hasNaverKeys } from "@/lib/naver";

export const runtime = "nodejs";
export const maxDuration = 60;

// 카탈로그 항목에 상품 이미지를 채운다.
//
// 저작권 관점: 라벨 디자인은 제작사의 저작물이므로 이미지를 내려받아 우리 서버에
// 재배포하지 않는다. 대신 판매처가 제공하는 이미지 "주소"만 저장해 연결한다.
// (검색 결과를 노출하는 통상적인 방식이며, 원본은 판매처 서버에 그대로 있다)
export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  if (!hasNaverKeys()) return NextResponse.json({ error: "네이버 API 키 필요" }, { status: 400 });

  const { limit = 30, force = false } = await request.json().catch(() => ({}));

  const filter = force ? {} : { image: { $in: [null, undefined] } };
  const targets = await db
    .collection("catalog")
    .find(filter, { projection: { name: 1, searchKeyword: 1 } })
    .limit(limit)
    .toArray();

  let filled = 0;
  const missing = [];

  // 판매처 표기가 우리 이름과 달라 못 찾는 경우가 많다 (예: 까베르네/카베르네).
  // 전체 이름 → 앞 3단어 → 앞 2단어 순으로 범위를 넓혀 가며 시도한다.
  function queryCandidates(doc) {
    const base = (doc.searchKeyword || doc.name || "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const words = base.split(" ");
    return [...new Set([base, words.slice(0, 3).join(" "), words.slice(0, 2).join(" ")])].filter(
      (q) => q.length >= 2
    );
  }

  // 네이버 API는 무료지만 몰아서 호출하면 일시적으로 빈 응답이 오므로
  // 캐시를 건너뛰고(fresh) 간격을 두어 순차 처리한다
  for (const doc of targets) {
    try {
      let withImage = null;
      for (const q of queryCandidates(doc)) {
        await new Promise((r) => setTimeout(r, 250));
        const items = (await searchShop(q, "liquor", { fresh: true })) || [];
        withImage = items.find((it) => it.image);
        if (withImage) break;
      }
      if (!withImage) {
        missing.push(doc.name);
        await db.collection("catalog").updateOne(
          { _id: doc._id },
          { $set: { imageCheckedAt: new Date() } }
        );
        continue;
      }
      await db.collection("catalog").updateOne(
        { _id: doc._id },
        {
          $set: {
            image: withImage.image, // 판매처 이미지 주소만 보관 (재배포 아님)
            imageSource: withImage.mall,
            imageCheckedAt: new Date(),
          },
        }
      );
      filled++;
    } catch {
      missing.push(doc.name);
    }
  }

  return NextResponse.json({ checked: targets.length, filled, missing });
}

// 이미지 보유 현황
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const col = db.collection("catalog");
  const [total, withImage] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ image: { $exists: true, $ne: null } }),
  ]);
  return NextResponse.json({ total, withImage, without: total - withImage });
}
