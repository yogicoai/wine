// Korean Spirits Lens — 한국 술을 처음 보는 외국인을 위한 영어 앱.
// 화면도 콘텐츠도 영어다. 어휘 사전은 i18n 이 맡으므로 copy 는 비워 둔다.

const tradition = {
  key: "tradition",
  name: "Korean Spirits Lens",
  nameEn: "Korean Spirits Lens",
  tagline: "Read any Korean bottle. Know what you are drinking.",
  motto: "Read any Korean bottle",
  locale: "en",
  // 막걸리는 분석 프롬프트가 makgeolli 로 따로 가른다 (탁주). 여기서 함께 받는다.
  categories: ["traditional", "makgeolli", "soju"],
  scope: ["traditional", "makgeolli", "soju"],
  storageKey: "ksplens",
  harvestCategories: ["traditional", "soju"],

  theme: {
    // 백자와 소나무. 장식을 걷어 낸 정갈함.
    accent: "#c9b9a0",
    wineish: "#3c4a3a",
    bg: "#0a0b09",
    bg2: "#12140f",
    bg3: "#1a1d16",
    ink: "#f1f0ea",
    inkDim: "#9a9a8e",
    radius: "12px",
    radiusSm: "9px",
    fontSet: "latin-serif",
    bgImage: "/img/bg_tradition.jpg",
    bgVeil: 0.58,
    grain: 0.045,
    // 헤더 심볼 — 조리개 마크 패밀리
    brandMark: "/icons/tradition-mark.png",
  },

  copy: {},
    // 메뉴판은 앱마다 다른 자리에서 찍는다 — 이자카야 · 펍 · 바
    "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.":
      "One shot of a restaurant menu. We pull out every drink listed and rank them by value — photograph the printed list, not the bottles.",
    "술병 라벨과 식당 와인 리스트까지":
      "Bottle labels and restaurant menus alike",
    "{cat} 리스트":
      "Menu",


  layout: {
    // 막걸리·약주는 신선도와 온도가 먼저다. 빈티지 비교는 넣지 않는다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "serving", "glass", "gear", "taste",
      "specs", "pairing", "story", "history",
      "rating", "trivia", "tips", "similar",
      "deep",
    ],
  },
};

export default tradition;
