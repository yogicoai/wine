// 셀러에 담긴 술의 최저가를 점검해 "특가"를 찾아낸다.
// 화면 진입 시(수동)와 정기 점검(크론) 양쪽에서 같은 로직을 쓴다.
import { getDb } from "./mongodb";
import { searchShop, lowestPrice, pickRepresentative, hasNaverKeys } from "./naver";
import { ownScope } from "./appProfile";

const STALE_MS = 6 * 60 * 60 * 1000; // 6시간 지난 항목만 재조회 (불필요한 호출 방지)
const DROP_RATIO = 0.95; // 역대 최저가 대비 5% 이상 내려가면 특가로 본다
const HISTORY_MAX = 190; // 가격 이력 보관 기간 (하루 한 점 · 6개월 조금 넘게)

// "2026-07-28" 형태의 날짜 키
function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * 하루에 한 점씩만 남기는 가격 이력을 만든다.
 * 같은 날 여러 번 확인하면 그날의 최저가로 갱신한다.
 */
export function appendHistory(history, price, day = dayKey()) {
  const points = Array.isArray(history) ? [...history] : [];
  const last = points[points.length - 1];

  if (last?.d === day) {
    points[points.length - 1] = { d: day, p: Math.min(last.p, price) };
  } else {
    points.push({ d: day, p: price });
  }
  return points.slice(-HISTORY_MAX);
}

/**
 * @param {object} opts
 * @param {number} opts.max         한 번에 확인할 최대 품목 수
 * @param {boolean} opts.ignoreStale 스테일 조건을 무시하고 전부 확인 (크론에서 사용)
 * @returns {Promise<{deals: object[], checked: number, skipped?: string}>}
 */
export async function checkDeals({ max = 12, ignoreStale = false } = {}) {
  const db = await getDb();
  if (!db) return { deals: [], checked: 0, skipped: "noDb" };
  if (!hasNaverKeys()) return { deals: [], checked: 0, skipped: "noApi" };

  const col = db.collection("cellar");
  const cutoff = new Date(Date.now() - STALE_MS);
  // 앱마다 셀러가 다르다 — 맥주 앱이 와인 특가를 알리면 안 된다
  const query = { status: { $in: ["have", "wish"] }, ...ownScope("category") };
  if (!ignoreStale) {
    query.$or = [{ priceCheckedAt: null }, { priceCheckedAt: { $exists: false } }, { priceCheckedAt: { $lt: cutoff } }];
  }

  const targets = await col
    .find(query)
    .sort({ priceTarget: -1, updatedAt: -1 }) // 목표가를 설정해 둔 항목 우선
    .limit(max)
    .toArray();

  const deals = [];

  for (const doc of targets) {
    try {
      // 연속 호출 시 빈 응답이 오는 것을 피하려고 간격을 둔다
      if (deals.length || targets.indexOf(doc) > 0) {
        await new Promise((r) => setTimeout(r, 200));
      }
      const items = (await searchShop(doc.searchKeyword || doc.name, "liquor", { fresh: true })) || [];
      const price = lowestPrice(items);
      if (!price) {
        await col.updateOne({ _id: doc._id }, { $set: { priceCheckedAt: new Date() } });
        continue;
      }

      const prevLow = doc.priceLow;
      const hitTarget = doc.priceTarget && price <= doc.priceTarget;
      const newLow = prevLow && price < prevLow * DROP_RATIO;

      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            priceLast: price,
            priceLow: prevLow ? Math.min(prevLow, price) : price,
            priceHigh: doc.priceHigh ? Math.max(doc.priceHigh, price) : price,
            priceHistory: appendHistory(doc.priceHistory, price),
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
      /* 개별 실패는 넘어가고 나머지를 계속 확인한다 */
    }
  }

  return { deals, checked: targets.length };
}

// 같은 특가를 매번 다시 알리지 않도록, 이미 보낸 건은 기록해 두고 걸러낸다
export async function filterAlreadyNotified(deals) {
  const db = await getDb();
  if (!db || !deals.length) return deals;

  const col = db.collection("deal_notices");
  const fresh = [];

  for (const deal of deals) {
    // 같은 술을 같은(또는 더 높은) 가격으로 다시 알리지 않는다
    const sent = await col.findOne({ cellarId: deal.id });
    if (sent && sent.price <= deal.price) continue;

    await col.updateOne(
      { cellarId: deal.id },
      { $set: { cellarId: deal.id, name: deal.name, price: deal.price, notifiedAt: new Date() } },
      { upsert: true }
    );
    fresh.push(deal);
  }

  return fresh;
}
