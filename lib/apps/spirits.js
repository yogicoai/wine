// 스피리츠 렌즈 — 브랜디·진·럼·데킬라·백주·리큐르.
// 한 주종만으로는 앱이 되지 않는 것들을 한데 모은다.
// 병을 찍었을 때 "우리 앱 밖입니다"가 나오지 않게 하는 그릇이기도 하다.

const spirits = {
  key: "spirits",
  name: "스피리츠 렌즈",
  nameEn: "Spirits Lens",
  tagline: "증류주 라벨을 읽는 AI 안내",
  motto: "AI Guide for every spirit",
  locale: "ko",
  categories: ["brandy", "gin", "rum", "tequila", "baijiu", "liqueur", "vodka", "highball", "spirits"],
  scope: ["brandy", "gin", "rum", "tequila", "baijiu", "liqueur", "vodka", "highball", "spirits"],
  storageKey: "spiritslens",
  harvestCategories: ["brandy", "gin", "rum", "tequila", "baijiu", "liqueur"],

  theme: {
    // 유리와 은 — 증류주의 투명함.
    accent: "#bfc3c9",
    wineish: "#2d3540",
    bg: "#08090b",
    bg2: "#101317",
    bg3: "#171b21",
    ink: "#f0f2f4",
    inkDim: "#949aa2",
    radius: "16px",
    radiusSm: "11px",
    fontSet: "latin-serif",
    bgImage: "/img/bg_spirits.jpg",
    bgVeil: 0.6,
    grain: 0.05,
    // 헤더 심볼 — 조리개 마크 패밀리
    brandMark: "/icons/spirits-mark.png",
  },

  copy: {
    // 메뉴판은 앱마다 다른 자리에서 찍는다 — 이자카야 · 펍 · 바
    "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.":
      "바 메뉴판을 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.",
    "술병 라벨과 식당 와인 리스트까지":
      "증류주 라벨과 바 메뉴판까지",
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
    "와인 리스트": "메뉴판",
    "식당 와인 리스트를 찍으면": "바 메뉴판을 찍으면",
    "와인 둘러보기부터": "둘러보기부터",
    "우리가 아는 와인": "우리가 아는 증류주",
    "AI 소믈리에가 읽은 라벨": "AI가 읽은 라벨",
  },

  layout: {
    // 증류주는 잔과 마시는 법이 먼저다. 음용 적기는 넣지 않는다.
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

export default spirits;
