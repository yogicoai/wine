// 셀러 도메인 로직 — 저장 문서 정규화 / 음용 적기 판정 / 취향 프로필 집계

export const STATUSES = {
  have: { label: "보유 중", icon: "🍾" },
  wish: { label: "위시리스트", icon: "☆" },
  drunk: { label: "마신 술", icon: "✓" },
};

// 분석 결과 → 셀러 문서 (전체 결과는 스냅샷으로 보관해 상세 화면에서 재사용)
export function toCellarDoc(result, { thumb, status = "have", bottles = 1 } = {}) {
  return {
    name: result.name,
    category: result.category,
    producer: result.producer || null,
    vintage: result.vintage || null,
    region: result.region || null,
    country: result.country || null,
    searchKeyword: result.searchKeyword || result.name,
    liquidColor: result.liquidColor || null,
    tasteProfile: Array.isArray(result.tasteProfile) ? result.tasteProfile : [],
    drinkFrom: result.drinkFrom || null,
    drinkPeak: result.drinkPeak || null,
    drinkUntil: result.drinkUntil || null,
    priceRange: result.priceRange || null,
    thumb: thumb || null,
    result, // 상세 재조회 없이 결과 화면 복원용
    status,
    bottles,
    notes: [],
    rating: null,
    priceTarget: null,
    priceLast: null,
    priceLow: null,
    priceHigh: null,
    priceHistory: [], // [{ d: "2026-07-28", p: 89000 }] — 하루 한 점
    priceCheckedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 음용 적기 판정 — 셀러에서 "지금 마시기 좋은 술" 배지에 사용
export function drinkWindowState(doc, now = new Date().getFullYear()) {
  const from = parseInt(doc.drinkFrom);
  const peak = parseInt(doc.drinkPeak);
  const until = parseInt(doc.drinkUntil);
  if (!from && !until) return null;

  if (until && now > until) return { key: "past", label: "적기 지남", tone: "bad" };
  if (from && now < from) {
    return { key: "early", label: `${from}년부터`, tone: "dim" };
  }
  if (peak && Math.abs(now - peak) <= 2) return { key: "peak", label: "지금이 피크", tone: "gold" };
  if (until && until - now <= 2) return { key: "soon", label: "곧 적기 마감", tone: "warn" };
  return { key: "ready", label: "마시기 좋음", tone: "ok" };
}

/**
 * 셀러 가치 평가 — 보유 중인 술의 현재 최저가를 병 수만큼 합산한다.
 * 값이 확인된 항목만 세고, 확인되지 않은 병 수는 따로 알려 준다.
 */
export function cellarValue(docs) {
  let total = 0;
  let bottles = 0;
  let priced = 0;
  let unpriced = 0;
  let gain = 0; // 최고가 대비 지금 얼마나 싸졌는지 (역방향이면 음수)

  for (const d of docs) {
    if (d.status !== "have") continue;
    const n = d.bottles || 0;
    if (!n) continue;
    bottles += n;

    if (d.priceLast) {
      total += d.priceLast * n;
      priced += n;
      if (d.priceHigh) gain += (d.priceHigh - d.priceLast) * n;
    } else {
      unpriced += n;
    }
  }

  // 보유 병이 아예 없을 때만 숨긴다.
  // 시세를 아직 못 구한 상태에서도 카드는 보여 주는 편이 낫다 —
  // 값이 0원이라서가 아니라 아직 확인 전이라는 것을 알려야 하기 때문이다.
  if (!bottles) return null;
  return {
    total,
    bottles,
    priced,
    unpriced,
    gain,
    average: priced ? Math.round(total / priced) : null,
  };
}

// 가격 이력에서 화면에 필요한 값만 뽑는다.
// 그래프는 점이 두 개는 있어야 그릴 수 있으므로, 그전에는 null 을 준다.
// (한 점뿐일 때는 화면에서 priceLast 를 그대로 보여 준다)
export function priceTrend(doc) {
  const points = Array.isArray(doc.priceHistory) ? doc.priceHistory : [];
  if (points.length < 2) return null;

  const first = points[0].p;
  const last = points[points.length - 1].p;
  const values = points.map((p) => p.p);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const diff = last - first;

  return {
    points,
    min,
    max,
    last,
    diff,
    percent: first ? Math.round((diff / first) * 100) : 0,
    isLowest: last <= min,
  };
}

/**
 * 정해진 기간의 가격 통계 — 목표가를 정하는 근거로 쓴다.
 * "지금 8만원"만으로는 싼지 비싼지 알 수 없지만,
 * "6개월 최저 7.6만 / 최고 9.5만"이 함께 있으면 판단할 수 있다.
 *
 * @param {object} doc 셀러 문서
 * @param {number} days 되돌아볼 일수 (기본 6개월)
 */
export function priceStats(doc, days = 180) {
  const all = Array.isArray(doc.priceHistory) ? doc.priceHistory : [];
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const points = all.filter((p) => p.d >= cutoff);

  // 이력이 아직 없으면 지금 값만이라도 알려 준다
  if (!points.length) {
    return doc.priceLast
      ? { last: doc.priceLast, low: doc.priceLow || doc.priceLast, high: null, days: 0, isLowest: false }
      : null;
  }

  const values = points.map((p) => p.p);
  const low = Math.min(...values);
  const last = values[values.length - 1];

  return {
    last,
    low,
    high: Math.max(...values),
    days: points.length,
    isLowest: last <= low,
    // 지금 값이 기간 최저보다 얼마나 높은가 (%)
    overLow: low ? Math.round(((last - low) / low) * 100) : 0,
  };
}

/** 목표가 후보 — 기간 최저가를 기준으로 제안한다 */
export function targetSuggestions(stats) {
  if (!stats?.low) return [];
  const round = (n) => Math.max(1000, Math.round(n / 1000) * 1000);

  return [
    { label: "최저가 수준", value: round(stats.low) },
    { label: "5% 더", value: round(stats.low * 0.95) },
    { label: "10% 더", value: round(stats.low * 0.9) },
  ];
}

// 취향 프로필 — 별점 매긴 기록을 가중 평균해 선호 축을 산출
export function buildTasteProfile(docs) {
  const rated = docs.filter((d) => d.rating && Array.isArray(d.tasteProfile) && d.tasteProfile.length);
  if (rated.length < 2) return null;

  // 별점 3점 이상을 "좋아한 술"로 보고, 점수가 높을수록 크게 반영
  const sums = new Map();
  let weightTotal = 0;
  for (const d of rated) {
    const w = Math.max(0, d.rating - 2.5); // 3점=0.5, 5점=2.5
    if (!w) continue;
    weightTotal += w;
    for (const axis of d.tasteProfile) {
      if (!axis?.axis || typeof axis.value !== "number") continue;
      const cur = sums.get(axis.axis) || { sum: 0, weight: 0 };
      cur.sum += axis.value * w;
      cur.weight += w;
      sums.set(axis.axis, cur);
    }
  }
  if (!weightTotal) return null;

  const axes = [...sums.entries()]
    .map(([axis, v]) => ({ axis, value: Math.round(v.sum / v.weight), weight: v.weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
  if (axes.length < 3) return null;

  // 카테고리 선호
  const catCount = new Map();
  for (const d of rated) {
    if (!d.category) continue;
    catCount.set(d.category, (catCount.get(d.category) || 0) + 1);
  }
  const topCategory = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // 한 줄 요약 — 강한 축 2개를 골라 문장화
  const strong = [...axes].sort((a, b) => b.value - a.value).slice(0, 2);
  const summary = strong.length
    ? `${strong.map((a) => `${a.axis} ${a.value >= 66 ? "강한" : a.value >= 40 ? "중간" : "약한"}`).join(" · ")} 스타일을 선호합니다`
    : null;

  return {
    axes: axes.map(({ axis, value }) => ({ axis, value })),
    topCategory,
    summary,
    sampleSize: rated.length,
  };
}
