// 보틀 렌즈 — 와인.
//
// 앱 하나는 세 가지로 정의된다.
//   theme  눈에 보이는 것 (색·서체·모서리·배경)
//   copy   앱이 쓰는 말 (같은 기능이라도 술마다 부르는 이름이 다르다)
//   layout 화면에 무엇을 어떤 순서로 놓는가
// 엔진(스캔·분석·카탈로그·추천)은 여섯 앱이 함께 쓴다.

const wine = {
  key: "wine",
  name: "보틀 렌즈",
  nameEn: "Bottle Lens",
  tagline: "술 라벨을 읽는 AI 소믈리에",
  motto: "AI Sommelier for every bottle",
  locale: "ko",
  categories: ["wine"],
  scope: ["wine"],
  storageKey: "bottlelens",
  harvestCategories: ["wine"],

  theme: {
    // 어두운 셀러의 밀도. 금색은 강조 한 곳에만.
    accent: "#d4b278",
    wineish: "#6e1f30",
    bg: "#0b0a09",
    bg2: "#131211",
    bg3: "#1c1a18",
    ink: "#f2efe9",
    inkDim: "#9b968e",
    radius: "18px",
    radiusSm: "12px",
    // 제목용 서체 세트 — app/layout.js 가 이 값을 보고 폰트를 고른다
    fontSet: "latin-serif",
    bgImage: "/img/bg_01.jpg",
    // 배경 사진을 얼마나 어둠에 잠기게 할지 (0=사진 그대로, 1=완전한 검정)
    bgVeil: 0.6,
    grain: 0.05,
  },

  // 와인이 기준 어휘라 바꿀 것이 없다
  copy: {},

  layout: {
    // 와인은 빈티지와 음용 적기가 핵심이다 — 가격 비교와 마실 때를 앞에 둔다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "vintage", "taste", "specs",
      "window", "history", "story", "pairing",
      "rating", "serving", "glass", "gear", "prep",
      "similar", "trivia", "tips", "deep",
    ],
  },
};

export default wine;
