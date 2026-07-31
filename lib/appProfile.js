// 앱 프로필 — 소스는 하나, 내보내는 앱은 넷.
//
// 와인 · 사케 · 맥주 · 전통술 네 앱은 하는 일이 같다. 라벨을 찍고, 술을 알아내고,
// 안주와 잔을 권하고, 살 곳을 잇는다. 다른 것은 어떤 술을 다루느냐와 이름·색·문구뿐이다.
// 그래서 코드를 넷으로 복사하지 않고 이 파일만 갈아끼운다.
//
// 고르는 법 — 환경변수 NEXT_PUBLIC_APP 에 아래 키를 넣고 각각 배포한다.
//   NEXT_PUBLIC_APP=wine      → 보틀 렌즈
//   NEXT_PUBLIC_APP=sake      → 사케 렌즈
//   NEXT_PUBLIC_APP=beer      → 비어 렌즈
//   NEXT_PUBLIC_APP=tradition → 전통술 (외국인 대상, 영어)
//
// 값을 주지 않으면 와인으로 동작한다. 지금까지 쓰던 것과 같다.

export const PROFILES = {
  wine: {
    key: "wine",
    name: "보틀 렌즈",
    nameEn: "Bottle Lens",
    tagline: "술 라벨을 읽는 AI 소믈리에",
    locale: "ko",
    // 이 앱이 다루는 주종. 첫 번째가 기본값이다.
    categories: ["wine"],
    // 검색·추천·수확에서 이 앱의 범위를 정한다
    scope: ["wine"],
    storageKey: "bottlelens",
    // 밤색과 금색 — 셀러의 어둠에 라벨의 금박
    accent: "#d4b278",
    wineish: "#6e1f30",
    // 수확 검색어의 뿌리. lib/seedList.js 가 주종별 목록을 갖고 있다.
    harvestCategories: ["wine"],
  },

  sake: {
    key: "sake",
    name: "사케 렌즈",
    nameEn: "Sake Lens",
    tagline: "사케 라벨을 읽는 AI 안내",
    locale: "ko",
    categories: ["sake"],
    scope: ["sake"],
    storageKey: "sakelens",
    // 청주의 맑음과 삼나무 — 남색과 옅은 나무빛
    accent: "#cbb894",
    wineish: "#2b3a55",
    harvestCategories: ["sake"],
  },

  beer: {
    key: "beer",
    name: "비어 렌즈",
    nameEn: "Beer Lens",
    tagline: "맥주 라벨을 읽는 AI 안내",
    locale: "ko",
    categories: ["beer"],
    scope: ["beer"],
    storageKey: "beerlens",
    // 맥아의 호박빛과 거품
    accent: "#e0a838",
    wineish: "#5b3a12",
    harvestCategories: ["beer"],
  },

  tradition: {
    key: "tradition",
    name: "Korean Spirits Lens",
    nameEn: "Korean Spirits Lens",
    tagline: "Read any Korean bottle. Know what you are drinking.",
    // 외국인 대상이라 화면과 내용이 모두 영어다.
    // 다른 셋과 성격이 달라 콘텐츠를 따로 쌓아야 한다.
    locale: "en",
    categories: ["traditional", "soju"],
    scope: ["traditional", "soju"],
    storageKey: "ksplens",
    // 백자와 소나무
    accent: "#c9b9a0",
    wineish: "#3c4a3a",
    harvestCategories: ["traditional", "soju"],
  },
};

const KEY = (process.env.NEXT_PUBLIC_APP || "wine").trim();

/** 지금 배포된 앱의 프로필. 모르는 값이면 와인으로 떨어뜨린다. */
export const APP = PROFILES[KEY] || PROFILES.wine;

/** 이 앱이 다루는 주종인가 — 검색·추천·수확이 범위를 벗어나지 않게 한다 */
export function inScope(category) {
  return !category || APP.scope.includes(category);
}

/** DB 조회에 바로 넣는 조건. 주종이 하나면 문자열, 여럿이면 $in 을 쓴다. */
export function scopeQuery() {
  return APP.scope.length === 1 ? APP.scope[0] : { $in: APP.scope };
}

/** 기본 주종 — 추천·둘러보기가 아무 값도 받지 못했을 때 쓴다 */
export const DEFAULT_CATEGORY = APP.categories[0];
