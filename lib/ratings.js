// 집단 평점 — 사용자들이 남긴 별점을 술 단위로 모은다.
//
// 경쟁 앱의 가장 큰 자산은 결국 "사람들이 매긴 점수"다. 그것만은 AI로 만들 수 없고,
// 오늘부터 모아야 1년 뒤에 값이 생긴다. 별점은 이미 테이스팅 노트에서 받고 있으므로
// 그 값을 술 단위로 다시 묶어 두기만 하면 된다. 추가 비용은 없다.
//
// 한 사람이 같은 술의 별점을 여러 번 고칠 수 있으므로,
// 합계를 누적하지 않고 "셀러 항목 하나당 한 표"로 저장한 뒤 읽을 때 평균을 낸다.
import { getDb } from "./mongodb";
import { catalogKey } from "./catalog";

const MIN_VOTES = 1; // 표시 최소 표 수 (초기에는 1표부터 보여 준다)

/** 셀러 항목의 별점을 집단 평점에 반영한다 (같은 항목은 덮어쓴다) */
export async function recordRating(doc, rating) {
  const db = await getDb();
  if (!db || !doc?.name || !rating) return false;

  const value = Math.max(1, Math.min(5, Number(rating)));
  if (!Number.isFinite(value)) return false;

  await db.collection("ratings").updateOne(
    { cellarId: doc._id.toString() },
    {
      $set: {
        cellarId: doc._id.toString(),
        key: catalogKey(doc.name, doc.vintage),
        name: doc.name,
        vintage: doc.vintage || null,
        category: doc.category || null,
        rating: value,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return true;
}

/** 셀러 항목이 지워지면 표도 함께 지운다 */
export async function removeRating(cellarId) {
  const db = await getDb();
  if (!db) return;
  await db.collection("ratings").deleteOne({ cellarId: String(cellarId) });
}

/**
 * 한 술의 집단 평점
 * @returns {Promise<null | {average: number, count: number, distribution: number[]}>}
 */
export async function getRating(name, vintage) {
  const db = await getDb();
  if (!db || !name) return null;

  const key = catalogKey(name, vintage);
  const votes = await db
    .collection("ratings")
    .find({ key }, { projection: { rating: 1 } })
    .limit(2000)
    .toArray();

  if (votes.length < MIN_VOTES) return null;

  const distribution = [0, 0, 0, 0, 0]; // 1점 … 5점
  let sum = 0;
  for (const v of votes) {
    sum += v.rating;
    distribution[v.rating - 1] += 1;
  }

  return {
    average: Math.round((sum / votes.length) * 10) / 10,
    count: votes.length,
    distribution,
  };
}

/** 평점이 높은 술 — 추천·랭킹 화면에서 쓴다 */
export async function topRated({ limit = 20, minVotes = 2 } = {}) {
  const db = await getDb();
  if (!db) return [];

  return db
    .collection("ratings")
    .aggregate([
      {
        $group: {
          _id: "$key",
          name: { $last: "$name" },
          vintage: { $last: "$vintage" },
          category: { $last: "$category" },
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: minVotes } } },
      { $sort: { average: -1, count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, key: "$_id", name: 1, vintage: 1, category: 1, average: { $round: ["$average", 1] }, count: 1 } },
    ])
    .toArray();
}
