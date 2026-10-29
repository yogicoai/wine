// 둘러보기 — 홈 · 목록 탭(밝은 디자인: 와인 · 사케)이 쓰는 술 목록. 읽기만 한다.
//
// 위스키 렌즈의 "위스키" 탭(바탕화면 whisky 저장소 lib/whiskies.js browseWhiskies)을 보틀 렌즈 DB 로 옮긴 것이다.
// 인기 = 데일리샷 후기 수, 별점 = 데일리샷 평점. 가격은 가격대(N만원대)로만.
//
// 정식 정보가 있는 술만 보여 준다(tier ≠ stub). 이름만 있는 색인 술을 열면 라벨 분석(유료 AI)이 돌기 때문이다
// — 와인 3,102종 중 1,172종, 사케 469종 중 306종(2026-10-29).
// 앱 범위의 술 전부를 10분 동안 메모리에 들고 거른다(와인 1,172종 정도라 가볍다).

import { getDb } from "./mongodb";
import { APP, scopeQuery } from "./appProfile";
import { REAL_DRINK } from "./catalog";
import { beginnerScore } from "./curation";

const TTL = 10 * 60 * 1000;
let cache = null; // { at, items }

export const SORTS = { popular: "인기순", rating: "별점순", price: "가격 낮은 순" };

const byPopular = (a, b) =>
  b.reviews - a.reviews || (b.image ? 1 : 0) - (a.image ? 1 : 0) || b.hits - a.hits || a.name.localeCompare(b.name, "ko");

async function loadAll() {
  if (cache && Date.now() - cache.at < TTL) return cache.items;
  const db = await getDb();
  if (!db) return [];
  const docs = await db
    .collection("catalog")
    .find(
      { ...REAL_DRINK, hidden: { $ne: true }, tier: { $ne: "stub" }, category: scopeQuery() },
      {
        projection: {
          name: 1, key: 1, vintage: 1, category: 1, image: 1, priceBand: 1, beginner: 1, hits: 1,
          "result.name": 1, "result.type": 1, "result.country": 1, "result.liquidColor": 1,
          "result.tasteProfile": 1, "result.tastingNotes": 1, "sourceFacts.dailyshot.id": 1,
        },
      }
    )
    .toArray();
  const ids = docs.map((d) => d.sourceFacts?.dailyshot?.id).filter(Boolean);
  const ds = await db
    .collection("dailyshot")
    .find({ id: { $in: ids } }, { projection: { id: 1, reviews: 1, rating: 1 } })
    .toArray();
  const dsById = new Map(ds.map((d) => [d.id, d]));
  const items = docs.map((d) => {
    const s = dsById.get(d.sourceFacts?.dailyshot?.id);
    return {
      key: d.key,
      name: d.result?.name || d.name,
      vintage: d.vintage || null,
      image: d.image || null,
      type: d.result?.type || null,
      country: d.result?.country || null,
      liquidColor: d.result?.liquidColor || null,
      priceBand: d.priceBand ?? null,
      note: d.result?.tastingNotes || null,
      beginner: beginnerScore(d),
      reviews: s?.reviews || 0,
      rating: s?.rating || null,
      hits: d.hits || 0,
    };
  });
  items.sort(byPopular);
  cache = { at: Date.now(), items };
  return items;
}

/** 종류 카드(theme.light.kinds) 하나에 드는가 — 검색과 같이 종류 칸 · 이름을 본다 */
function inKind(item, term) {
  return new RegExp(term).test(`${item.type || ""} ${item.name}`);
}

/** 목록 탭 — 종류 · 가격대 · 처음이라면으로 거르고 인기 · 별점 · 가격 순으로 */
export async function browse({ kind = null, band = null, easy = false, sort = "popular", limit = 30 } = {}) {
  let list = await loadAll();
  if (kind) list = list.filter((w) => inKind(w, kind));
  if (band) list = list.filter((w) => w.priceBand === band);
  if (easy) list = list.filter((w) => (w.beginner ?? 0) >= 70);
  if (sort === "rating") list = list.filter((w) => w.rating && w.reviews >= 5).sort((a, b) => b.rating - a.rating || byPopular(a, b));
  else if (sort === "price") list = [...list].sort((a, b) => (a.priceBand ?? 9) - (b.priceBand ?? 9) || byPopular(a, b));
  return { total: list.length, items: list.slice(0, limit) };
}

/** 홈 — 몇 종 · 오늘의 술 · 종류별 수 · 인기 · 처음이라면 */
export async function homeData() {
  const all = await loadAll();
  // 오늘의 술 — 후기 많은 사진 있는 술 40개를 한국 날짜로 하루에 하나씩 돌린다(위스키 렌즈 todayWhisky 와 같은 방식)
  const pool = all.filter((w) => w.image && w.reviews > 0).slice(0, 40);
  const day = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
  const today = pool.length ? pool[day % pool.length] : all[0] || null;
  const counts = Object.fromEntries((APP.theme.light?.kinds || []).map((k) => [k.term, all.filter((w) => inKind(w, k.term)).length]));
  return {
    total: all.length,
    today,
    counts,
    popular: all.slice(0, 8),
    easy: all.filter((w) => (w.beginner ?? 0) >= 70).slice(0, 8),
  };
}
