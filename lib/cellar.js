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
