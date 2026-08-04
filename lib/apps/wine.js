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
    // 셀러의 밀도는 남기되 한 단계 밝게. "조금 밝았으면" 하는 요청이라
    // 라이트 테마로 뒤집지 않고 검정에 가깝던 바닥을 위로 올렸다.
    //
    //   bg  #0b0a09 → #17130f   거의 검정이던 것을 따뜻한 어둠으로
    //   veil 0.6    → 0.42      배경 사진이 그만큼 더 비친다
    //
    // 바닥이 밝아지면 흐린 글자가 묻히므로 --ink-dim 도 함께 올렸다.
    // 금색은 그대로 둔다 — 배경이 밝아진 만큼 이미 더 잘 보인다.
    accent: "#d4b278",
    wineish: "#7d2436",
    bg: "#17130f",
    bg2: "#221d17",
    bg3: "#2e2820",
    ink: "#f5f2ec",
    inkDim: "#b3aa9c",
    radius: "18px",
    radiusSm: "12px",
    // 제목용 서체 세트 — app/layout.js 가 이 값을 보고 폰트를 고른다
    fontSet: "latin-serif",
    bgImage: "/img/bg_01.jpg",
    // 배경 사진을 얼마나 어둠에 잠기게 할지 (0=사진 그대로, 1=완전한 검정)
    bgVeil: 0.42,
    grain: 0.04,
  },

  // 와인이 기준 어휘라 바꿀 것이 없다
  copy: {},

  layout: {
    // 와인은 빈티지와 음용 적기가 핵심이다 — 가격 비교와 마실 때를 앞에 둔다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "nearby", "vintage", "taste", "specs",
      "window", "history", "story", "pairing",
      "rating", "serving", "glass", "gear", "prep",
      "similar", "trivia", "tips", "deep",
    ],
  },
};

export default wine;
