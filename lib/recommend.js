// 맞춤 추천 — 우리 카탈로그 안에서 고른다. AI를 부르지 않으므로 비용이 들지 않는다.
//
// 취향은 두 곳에서 온다.
//   1) 직접 고른 답 (문답 8개) — 첫날부터 쓸 수 있다
//   2) 별점 기록에서 뽑은 취향  — 쓸수록 정확해진다
// 둘 다 있으면 섞는다. 기록이 쌓일수록 기록 쪽에 무게를 준다.
import { getDb } from "./mongodb";
import { catalogKey } from "./catalog";
import { buildTasteProfile } from "./cellar";
import { beginnerScore } from "./curation";
import { varietalKeyOf } from "./varietal";
import { axesOf } from "./cats";
import { DEFAULT_CATEGORY } from "./appProfile";

// 축은 lib/cats.js 의 주종 레지스트리에서 온다 — 여기서 고정하면 사케·맥주가 어긋난다

// 목록에 필요한 것만 — 결과 전체(result)는 무거우므로 상세에서 다시 읽는다
const LIST_FIELDS = {
  name: 1,
  category: 1,
  vintage: 1,
  producer: 1,
  key: 1,
  image: 1,
  priceBand: 1,
  beginner: 1,
  tags: 1,
  "result.region": 1,
  "result.country": 1,
  "result.type": 1,
  "result.liquidColor": 1,
  "result.tasteProfile": 1,
  "result.tastingNotes": 1,
};

function axisMap(profile) {
  return Object.fromEntries((profile || []).map((a) => [a.axis, a.value]));
}

/**
 * 두 취향이 얼마나 가까운가 (0~1). 공통 축이 둘 미만이면 판단하지 않는다.
 *
 * 축은 주종마다 다르다. 와인 축을 고정으로 쓰면 사케(바디·감칠맛·산도·당도)끼리
 * 비교할 때 겹치는 축이 '바디' 하나뿐이라 추천이 통째로 비어 버린다.
 */
function similarity(want, have, axes) {
  const shared = axes.filter((a) => want[a] != null && have[a] != null);
  if (shared.length < 2) return null;

  const diff = shared.reduce((sum, a) => sum + Math.abs(want[a] - have[a]), 0) / shared.length;
  return 1 - diff / 100;
}

// 받침 유무에 따라 조사를 고른다 ("탄닌이", "바디가")
function subjectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "가";
  return code % 28 ? "이" : "가";
}

/** 왜 추천했는지 한 줄로 — 근거 없는 추천은 신뢰를 얻지 못한다 */
function reasonFor(want, have, axes) {
  const gaps = axes.filter((a) => want[a] != null && have[a] != null)
    .map((a) => ({ axis: a, gap: Math.abs(want[a] - have[a]), value: have[a] }))
    .sort((a, b) => a.gap - b.gap);

  const best = gaps[0];
  if (!best || best.gap > 22) return null;

  const level = best.value >= 66 ? "강한" : best.value >= 40 ? "적당한" : "약한";
  return `${level} ${best.axis}${subjectParticle(best.axis)} 취향과 맞습니다`;
}

async function loadCandidates(db, { category = null, band = null, requireTaste = true } = {}) {
  // 취향 매칭에는 맛 축이 필요하지만, 가격대 둘러보기는 뼈대(수확분)도 보여 준다.
  // 수확분은 맛 축이 없어도 이름·가격대·이미지는 있다.
  const query = requireTaste ? { "result.tasteProfile.1": { $exists: true } } : {};
  if (category) query.category = category;
  if (band) query.priceBand = Number(band);

  return db.collection("catalog").find(query, { projection: LIST_FIELDS }).limit(1500).toArray();
}

/** 셀러에 이미 있는 술은 추천에서 뺀다 (빈티지가 달라도 같은 술로 본다) */
async function ownedKeys(db) {
  const docs = await db
    .collection("cellar")
    .find({}, { projection: { name: 1, vintage: 1 } })
    .limit(1000)
    .toArray();
  return new Set(docs.map((d) => catalogKey(d.name, null)));
}

/** 술별 평균 별점 — 동점일 때 순서를 가르는 데 쓴다 */
async function ratingMap(db) {
  const rows = await db
    .collection("ratings")
    .aggregate([{ $group: { _id: "$key", avg: { $avg: "$rating" }, n: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [r._id, { avg: r.avg, n: r.n }]));
}

/**
 * 비슷한 것만 줄줄이 나오지 않게 고른다.
 *
 * 품종에서 짐작한 맛 축은 같은 품종끼리 값이 똑같아, 그대로 세우면 모스카토만
 * 여덟 개가 나온다. 점수가 아무리 높아도 그건 추천이 아니라 목록이다.
 * 같은 품종·같은 생산자는 두 개까지만 둔다.
 */
function diversify(scored, limit) {
  const familyOf = (doc) =>
    varietalKeyOf({ name: doc.name, type: doc.result?.type, category: doc.category });

  const picked = [];
  const seen = new Map();

  // 1차: 한 갈래당 두 개까지
  for (const s of scored) {
    if (picked.length >= limit) break;
    const family = familyOf(s.doc);
    const count = seen.get(family) || 0;
    if (count >= 2) continue;
    seen.set(family, count + 1);
    picked.push(s);
  }

  // 자리가 남으면 제한을 풀고 채운다 (후보가 적을 때)
  if (picked.length < limit) {
    for (const s of scored) {
      if (picked.length >= limit) break;
      if (!picked.includes(s)) picked.push(s);
    }
  }

  return picked;
}

function shape(doc, extra = {}) {
  return {
    key: doc.key,
    name: doc.name,
    category: doc.category,
    vintage: doc.vintage || null,
    producer: doc.producer || null,
    region: doc.result?.region || null,
    country: doc.result?.country || null,
    type: doc.result?.type || null,
    notes: doc.result?.tastingNotes || null,
    liquidColor: doc.result?.liquidColor || null,
    image: doc.image || null,
    priceBand: doc.priceBand || null,
    tags: doc.tags || [],
    ...extra,
  };
}

/**
 * 취향 맞춤 추천
 * @param {object} opts
 * @param {{axes, novice, maxBand, prefer}} opts.answers 문답으로 받은 취향 (없어도 됨)
 * @param {number} opts.limit
 */
// category 를 받지 않으면 다른 주종까지 후보에 들어온다. 기본값은 이 앱의 주종이다.
export async function recommendByTaste({ answers = null, limit = 8, band = null, category = DEFAULT_CATEGORY } = {}) {
  const db = await getDb();
  if (!db) return null;

  // 기록에서 뽑은 취향
  const cellar = await db
    .collection("cellar")
    .find({ rating: { $gt: 0 } }, { projection: { rating: 1, tasteProfile: 1, category: 1 } })
    .limit(500)
    .toArray();
  const learned = buildTasteProfile(cellar);

  const fromAnswers = answers?.axes ? axisMap(answers.axes) : null;
  const fromHistory = learned ? axisMap(learned.axes) : null;
  if (!fromAnswers && !fromHistory) return null;

  // 축은 주종을 따른다 — 사케는 감칠맛, 위스키는 피트를 본다
  const axes = axesOf(category);

  // 기록이 쌓일수록 기록 쪽을 믿는다 (5개면 반반, 그 이상이면 기록 우위)
  const want = {};
  const historyWeight = fromHistory ? Math.min(0.7, (learned.sampleSize || 0) / 10) : 0;
  for (const a of axes) {
    const x = fromAnswers?.[a];
    const y = fromHistory?.[a];
    if (x != null && y != null) want[a] = x * (1 - historyWeight) + y * historyWeight;
    else if (x != null) want[a] = x;
    else if (y != null) want[a] = y;
  }

  const [candidates, owned, ratings] = await Promise.all([
    loadCandidates(db, { band, category }),
    ownedKeys(db),
    ratingMap(db),
  ]);

  const scored = [];
  for (const doc of candidates) {
    if (owned.has(catalogKey(doc.name, null))) continue;
    if (answers?.maxBand && doc.priceBand && doc.priceBand > answers.maxBand) continue;
    // 처음 마시는 사람에게 어려운 술을 권하지 않는다
    if (answers?.novice && (beginnerScore(doc) ?? 50) < 60) continue;

    const have = axisMap(doc.result?.tasteProfile);
    const sim = similarity(want, have, axes);
    if (sim == null) continue;

    const rating = ratings.get(doc.key);
    // 품종에서 짐작한 맛 축은 같은 품종끼리 값이 똑같다. 실제로 분석한 술을 앞에 둔다.
    const estimated = !!doc.result?.tasteEstimated;
    const bonus =
      (answers?.prefer?.length && matchesPreferred(doc, answers.prefer) ? 0.06 : 0) +
      (rating ? Math.min(0.05, (rating.avg - 3) * 0.03) : 0) +
      (estimated ? -0.04 : 0.04) +
      (doc.image ? 0.01 : 0);

    scored.push({
      doc,
      score: sim + bonus,
      reason: reasonFor(want, have, axes),
      rating: rating ? { average: Math.round(rating.avg * 10) / 10, count: rating.n } : null,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    basis: {
      answered: answers?.answered || 0,
      rated: learned?.sampleSize || 0,
      historyWeight: Math.round(historyWeight * 100),
    },
    want: axes.filter((a) => want[a] != null).map((a) => ({ axis: a, value: Math.round(want[a]) })),
    items: diversify(scored, limit).map((s) =>
      shape(s.doc, {
        match: Math.round(s.score * 100),
        reason: s.reason,
        rating: s.rating,
      })
    ),
  };
}

// 문답에서 고른 주종(레드/화이트/스파클링)과 맞는지 — type 문자열로 판단한다
function matchesPreferred(doc, prefer) {
  const text = `${doc.result?.type || ""} ${doc.name}`;
  return prefer.some((p) => {
    if (p === "red") return /레드/.test(text);
    if (p === "white") return /화이트|샤르도네|소비뇽 블랑/.test(text);
    if (p === "sparkling") return /스파클링|샴페인|프로세코|아스티/.test(text);
    return false;
  });
}

/**
 * 초보자 추천 — 떫음이 적고 값이 부담스럽지 않은 순서.
 * 큐레이션은 와인만 매겨 두었으므로 기본은 와인이다.
 * (다른 주종은 맛 축에서 추정만 되어 "초보자용"이라 단정하기 어렵다)
 */
export async function recommendForBeginner({ limit = 8, category = DEFAULT_CATEGORY, band = null } = {}) {
  const db = await getDb();
  if (!db) return null;

  const [candidates, ratings] = await Promise.all([
    loadCandidates(db, { category, band }),
    ratingMap(db),
  ]);
  const scored = candidates
    .map((doc) => ({
      doc,
      score: beginnerScore(doc),
      // 짐작한 맛 축은 같은 품종끼리 값이 같아 동점이 쏟아진다.
      // 사람이 직접 매긴 것 > 실제 분석 > 짐작 순으로 앞에 둔다.
      sort:
        beginnerScore(doc) +
        (typeof doc.beginner === "number" ? 30 : 0) +
        (doc.result?.tasteEstimated ? 0 : 8) +
        (doc.image ? 1 : 0),
    }))
    .filter((s) => s.score != null && s.score >= 60)
    .sort((a, b) => b.sort - a.sort);

  return {
    items: diversify(scored, limit).map((s) => {
      const r = ratings.get(s.doc.key);
      return shape(s.doc, {
        match: s.score,
        reason: beginnerReason(s.doc),
        rating: r ? { average: Math.round(r.avg * 10) / 10, count: r.n } : null,
      });
    }),
  };
}

function beginnerReason(doc) {
  const axes = axisMap(doc.result?.tasteProfile);
  if ((axes["당도"] ?? 0) >= 55) return "달콤해서 첫 잔으로 부담이 없습니다";
  // 탄닌은 와인에만 있는 축이다. 없는 술에 "떫은맛이 약하다"고 적으면 헛말이 된다.
  if (axes["탄닌"] != null) {
    if (axes["탄닌"] <= 15) return "떫은맛이 거의 없습니다";
    if (axes["탄닌"] <= 40) return "떫은맛이 약해 마시기 편합니다";
  }
  if ((axes["바디"] ?? 50) <= 45) return "가벼워서 편하게 넘어갑니다";
  if ((axes["감칠맛"] ?? 0) >= 55) return "감칠맛이 좋아 음식과 잘 맞습니다";
  return "향이 뚜렷해 이해하기 쉽습니다";
}

/**
 * 그냥 둘러보기 — 취향도 입문 여부도 따지지 않는다.
 * band 를 주면 그 가격대만, 주지 않으면 전체를 본다.
 */
export async function recommendByBand(band, { limit = 8, category = DEFAULT_CATEGORY } = {}) {
  const db = await getDb();
  if (!db) return null;

  const [candidates, ratings] = await Promise.all([
    loadCandidates(db, { band, category, requireTaste: false }),
    ratingMap(db),
  ]);

  // 같은 가격대 안에서는 평점 높은 순, 없으면 초보자 점수 순
  const scored = candidates
    .map((doc) => {
      const r = ratings.get(doc.key);
      return {
        doc,
        rating: r,
        sort:
          (r?.avg || 0) * 100 +
          (beginnerScore(doc) ?? 0) +
          (doc.result?.tasteEstimated ? 0 : 20) + // 실제 분석을 앞에
          (doc.image ? 5 : 0),
      };
    })
    .sort((a, b) => b.sort - a.sort);

  return {
    items: diversify(scored, limit).map((s) =>
      shape(s.doc, {
        rating: s.rating
          ? { average: Math.round(s.rating.avg * 10) / 10, count: s.rating.n }
          : null,
      })
    ),
  };
}
