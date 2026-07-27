import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { searchShop, lowestPrice, pickRepresentative, hasNaverKeys } from "@/lib/naver";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한

const STALE_MS = 6 * 60 * 60 * 1000; // 6시간 지난 항목만 재조회 (API 절약)
const MAX_CHECK = 12; // 한 번에 확인할 최대 품목

// 셀러에 담긴 술의 현재 최저가를 갱신하고, 목표가 도달·역대 최저가 항목을 특가로 반환
export async function POST() {
  const db = await getDb();
  if (!db) return NextResponse.json({ deals: [], noDb: true });
  if (!hasNaverKeys()) return NextResponse.json({ deals: [], noApi: true });

  const col = db.collection("cellar");
  const cutoff = new Date(Date.now() - STALE_MS);
  const targets = await col
    .find({
      status: { $in: ["have", "wish"] },
      $or: [{ priceCheckedAt: null }, { priceCheckedAt: { $lt: cutoff } }],
    })
    .sort({ priceTarget: -1, updatedAt: -1 }) // 목표가 설정된 항목 우선
    .limit(MAX_CHECK)
    .toArray();

  const deals = [];

  await Promise.all(
    targets.map(async (doc) => {
      try {
        const items = await searchShop(doc.searchKeyword || doc.name, "liquor");
        const price = lowestPrice(items);
        if (!price) {
          await col.updateOne({ _id: doc._id }, { $set: { priceCheckedAt: new Date() } });
          return;
        }

        const prevLow = doc.priceLow;
        const hitTarget = doc.priceTarget && price <= doc.priceTarget;
        const newLow = prevLow && price < prevLow * 0.95; // 5% 이상 하락

        await col.updateOne(
          { _id: doc._id },
          {
            $set: {
              priceLast: price,
              priceLow: prevLow ? Math.min(prevLow, price) : price,
              priceCheckedAt: new Date(),
            },
          }
        );

        if (hitTarget || newLow) {
          const best = pickRepresentative(items);
          deals.push({
            id: doc._id.toString(),
            name: doc.name,
            thumb: doc.thumb || null,
            price,
            prevLow: prevLow || null,
            target: doc.priceTarget || null,
            reason: hitTarget ? "target" : "drop",
            link: best?.link || null,
            mall: best?.mall || null,
          });
        }
      } catch {
        /* 개별 실패는 무시하고 나머지 진행 */
      }
    })
  );

  return NextResponse.json({ deals, checked: targets.length });
}
