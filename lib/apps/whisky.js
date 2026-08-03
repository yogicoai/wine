// 위스키 렌즈.
// 위스키는 병입하면 더 익지 않는다. "음용 적기"보다 "개봉 후 보관"이 중요하다.

const whisky = {
  key: "whisky",
  name: "위스키 렌즈",
  nameEn: "Whisky Lens",
  tagline: "위스키 라벨을 읽는 AI 안내",
  motto: "AI Guide for every dram",
  locale: "ko",
  categories: ["whisky"],
  scope: ["whisky"],
  storageKey: "whiskylens",
  harvestCategories: ["whisky"],

  theme: {
    // 캐스크의 구릿빛과 피트의 검붉음.
    accent: "#c98f3f",
    wineish: "#4a2612",
    bg: "#0b0908",
    bg2: "#14100d",
    bg3: "#1d1813",
    ink: "#f3ede4",
    inkDim: "#9d9187",
    radius: "16px",
    radiusSm: "11px",
    fontSet: "latin-serif",
    bgImage: "/img/bg_whisky.jpg",
    bgVeil: 0.62,
    grain: 0.055,
    // 헤더 심볼 — 조리개 마크 패밀리
    brandMark: "/icons/whisky-mark.png",
  },

  copy: {
    // 메뉴판은 앱마다 다른 자리에서 찍는다 — 이자카야 · 펍 · 바
    "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.":
      "바 메뉴판을 한 장. 적힌 위스키를 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.",
    "술병 라벨과 식당 와인 리스트까지":
      "위스키 라벨과 바 메뉴판까지",
    "{cat} 리스트":
      "바 메뉴판",

    "나의 셀러": "나의 진열장",
    "나의 셀러로 이동": "나의 진열장으로 이동",
    "셀러": "진열장",
    "셀러 가치": "진열장 가치",
    "셀러에 담기": "진열장에 담기",
    "셀러에 담았습니다.": "진열장에 담았습니다.",
    "셀러 항목을 불러오지 못했습니다.": "진열장 항목을 불러오지 못했습니다.",
    "셀러를 쓸 수 없습니다": "진열장을 쓸 수 없습니다",
    "셀러 화면에서 설정": "진열장 화면에서 설정",
    "보유 중인 술이 없습니다": "진열장이 비어 있습니다",
    "음용 적기": "개봉 후 보관",
    "빈티지별 가격": "숙성연수별 가격",
    "스캔한 빈티지": "스캔한 숙성연수",
    "와인 리스트": "메뉴판",
    "식당 와인 리스트를 찍으면": "바 메뉴판을 찍으면",
    "와인 둘러보기부터": "위스키 둘러보기부터",
    "우리가 아는 와인": "우리가 아는 위스키",
    "AI 소믈리에가 읽은 라벨": "AI가 읽은 위스키 라벨",
  },

  layout: {
    // 위스키는 잔과 마시는 법이 먼저다. 병입 후에는 익지 않으므로 음용 적기(window)는 넣지 않는다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "glass", "gear", "serving", "taste",
      "specs", "story", "history", "pairing",
      "rating", "trivia", "tips", "similar",
      "deep",
    ],
  },
};

export default whisky;
