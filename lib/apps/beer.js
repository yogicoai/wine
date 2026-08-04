// 비어 렌즈.
// 맥주는 재우는 술이 아니라 신선할 때 마시는 술이다. 셀러도 빈티지도 어울리지 않는다.

const beer = {
  key: "beer",
  name: "비어 렌즈",
  nameEn: "Beer Lens",
  tagline: "맥주 라벨을 읽는 AI 안내",
  motto: "AI Guide for every beer",
  locale: "ko",
  categories: ["beer"],
  scope: ["beer"],
  storageKey: "beerlens",
  harvestCategories: ["beer"],

  theme: {
    // 맥아의 호박빛과 거품. 어둡되 와인보다 따뜻하다.
    accent: "#e0a838",
    wineish: "#5b3a12",
    bg: "#0c0a07",
    bg2: "#15110b",
    bg3: "#1e1810",
    ink: "#f5f0e6",
    inkDim: "#a3998a",
    radius: "20px",
    radiusSm: "14px",
    fontSet: "latin-serif",
    bgImage: "/img/bg_beer.jpg",
    bgVeil: 0.6,
    grain: 0.05,
    // 헤더 심볼 — 조리개 마크 패밀리
    brandMark: "/icons/beer-mark.png",
  },

  copy: {
    // 메뉴판은 앱마다 다른 자리에서 찍는다 — 이자카야 · 펍 · 바
    "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.":
      "펍 메뉴판을 한 장. 적힌 맥주를 모두 뽑아 정리합니다. 캔을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.",
    "술병 라벨과 식당 와인 리스트까지":
      "맥주 라벨과 펍 메뉴판까지",
    "{cat} 리스트":
      "메뉴판",

    "나의 셀러": "나의 냉장고",
    "나의 셀러로 이동": "나의 냉장고로 이동",
    "셀러": "냉장고",
    "셀러 가치": "냉장고 가치",
    "셀러에 담기": "냉장고에 담기",
    "셀러에 담았습니다.": "냉장고에 담았습니다.",
    "셀러 항목을 불러오지 못했습니다.": "냉장고 항목을 불러오지 못했습니다.",
    "셀러를 쓸 수 없습니다": "냉장고를 쓸 수 없습니다",
    "셀러 화면에서 설정": "냉장고 화면에서 설정",
    "보유 중인 술이 없습니다": "냉장고가 비어 있습니다",
    "음용 적기": "신선도",
    "숙성": "보관",
    "와인 리스트": "메뉴판",
    "식당 와인 리스트를 찍으면": "펍 메뉴판을 찍으면",
    "와인 둘러보기부터": "맥주 둘러보기부터",
    "우리가 아는 와인": "우리가 아는 맥주",
    "AI 소믈리에가 읽은 라벨": "AI가 읽은 맥주 라벨",
  },

  layout: {
    // 맥주는 온도와 잔이 먼저다. 빈티지·음용 적기·서빙 준비는 넣지 않는다 — 신선할 때 바로 마시는 술이다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "nearby", "serving", "glass", "gear", "taste",
      "specs", "pairing", "story", "history",
      "rating", "trivia", "tips", "similar",
      "deep",
    ],
  },
};

export default beer;
