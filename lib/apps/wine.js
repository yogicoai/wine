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
    // 밝은 낮의 셀러.
    //
    // 처음에는 검정에 가깝던 바닥을 한 단계 올려 봤는데, "조금 밝게"로는
    // 어두운 화면이 어두운 채로 남았다. 바탕을 아예 크림색으로 뒤집었다.
    //
    // mode: "light" 가 켜지면 어둠을 전제한 것들이 함께 뒤집힌다 —
    // 선(흰색 알파 → 검정 알파), 카드 표면, 강조색의 밝고 어두운 방향.
    // globals.css 는 어둠을 전제하고 쓰였으므로 그 전제를 여기서 끈다.
    mode: "light",

    // 금색은 밝은 바탕에서 대비가 1.98 밖에 안 나와 글자로 쓸 수 없다.
    // 같은 계열에서 톤을 내려 5.22 로 맞췄다 — 금빛 인상은 남고 읽힌다.
    accent: "#8a6520",
    wineish: "#7d2436",
    bg: "#f6f2ea",
    bg2: "#fffdf9",
    bg3: "#ece5d9",
    ink: "#23201c",
    inkDim: "#6d6558",
    radius: "18px",
    radiusSm: "12px",
    // 제목용 서체 세트 — app/layout.js 가 이 값을 보고 폰트를 고른다
    fontSet: "latin-serif",
    bgImage: "/img/bg_01.jpg",
    // 밝은 쪽에서 이 장막은 어둠이 아니라 크림색이다. 짙게 덮어 사진을
    // 흐린 무늬 정도로만 남긴다 — 어두운 사진이 그대로 비치면 밝힌 뜻이 없다.
    bgVeil: 0.82,
    grain: 0.02,
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
