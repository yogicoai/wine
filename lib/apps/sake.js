// 사케 렌즈.
//
// 와인의 리스킨이 아니다. 사케는 다른 술이고, 다른 말을 쓴다.
//   · 눕혀 재우지 않는다 — "셀러"가 아니라 "술창고"다
//   · 빈티지 개념이 거의 없다 — 해가 아니라 "제조연월(BY)"을 본다
//   · 오래 둘수록 좋아지지 않는다 — "음용 적기"가 아니라 "신선도"다
//   · 디캔팅하지 않는다 — 대신 냉주·열간처럼 온도를 고른다
// 그래서 색과 서체만이 아니라 어휘와 화면 구성까지 갈아끼운다.

const sake = {
  key: "sake",
  name: "사케 렌즈",
  nameEn: "Sake Lens",
  tagline: "사케 라벨을 읽는 AI 안내",
  motto: "AI Guide for every sake",
  locale: "ko",
  categories: ["sake"],
  scope: ["sake"],
  storageKey: "sakelens",
  harvestCategories: ["sake"],

  theme: {
    // 남색 밤과 한지, 삼나무. 와인의 금빛 밀도 대신 물의 맑음과 여백.
    accent: "#cbb894",
    wineish: "#22304a",
    bg: "#0a0d12",
    bg2: "#111721",
    bg3: "#18202c",
    ink: "#eef1f4",
    inkDim: "#93a0ad",
    // 각을 조금 덜 깎는다 — 일본 기물의 단정함
    radius: "14px",
    radiusSm: "10px",
    fontSet: "jp-serif",
    bgImage: "/img/bg_sake.jpg",
    bgVeil: 0.52,
    grain: 0.045,
    // 헤더 심볼 — 도쿠리 안에 조리개. 와인 앱 병 심볼의 형제 마크다.
    brandMark: "/icons/sake-mark.png",
    brandEmblem: "/icons/sake-mark.png",
    // ── 일본풍 장치 ──
    // 세이가이하(청해파) 물결 문양을 화면 전체에 아주 옅게 깐다
    pattern: "seigaiha",
    // 주홍 낙관 — 헤더 워드마크 옆에 도장 하나. 일본 문서의 서명이다.
    seal: "酒",
    sealColor: "#c73e3a",

    // 밝은 디자인(2026-10-28 사용자) — 와인과 같은 틀에 쪽빛(藍) 하나. 어두운 테마의 남색(#22304a)을 밝은 바탕용으로 옮겼다.
    // 판은 와인보다 조금 차가운 회색 — 물과 한지 쪽. 낙관(酒)은 그대로 둔다.
    ui: "light",
    light: {
      accent: "#2f6292",
      accentText: "#24527d",
      accentDeep: "#183a5c",
      accentSoft: "#e8eff7",
      button: "linear-gradient(180deg, #3a6ea0 0%, #22507c 100%)",
      tile: "#f2f4f6",
      tile2: "#e9edf1",
      heroPhoto: "/img/hero_sake.jpg",
      mark: "/icons/mark-sake-light.png",
      tastePhoto: "/img/taste_sake.jpg", // 찾기 "나의 취향" 판 — 기키초코 시음 잔
      // 2026-10-28 DB 기준 준마이 334 · 긴조 254 · 다이긴조 160 · 나마 34 · 니고리 10종.
      // 혼조조(10) · 스파클링(6)은 아직 적어 카드로 두지 않았다
      // 사진 없는 사케의 종류 대표 병 — 나마는 종류 카드의 생주 병을 같이 쓴다. 마지막은 기본(준마이 갈색 병)
      bottles: [
        { match: "니고리|탁", img: "/img/bottles/sake-nigori.png" },
        { match: "나마|생주|생원주", img: "/img/kinds/sake-nama.png" },
        { match: "다이긴조", img: "/img/bottles/sake-daiginjo.png" },
        { match: "긴조", img: "/img/bottles/sake-ginjo.png" },
        { match: "", img: "/img/bottles/sake-junmai.png" },
      ],
      kinds: [
        { label: "준마이", en: "Junmai", term: "준마이", color: "#e6dccb", img: "/img/kinds/sake-junmai.png" },
        { label: "긴조", en: "Ginjo", term: "긴조", color: "#dfe9f1", img: "/img/kinds/sake-ginjo.png" },
        { label: "다이긴조", en: "Daiginjo", term: "다이긴조", color: "#d9e3f0", img: "/img/kinds/sake-daiginjo.png" },
        { label: "나마 (생주)", en: "Nama", term: "나마", color: "#e3eef3", img: "/img/kinds/sake-nama.png" },
        { label: "니고리", en: "Nigori", term: "니고리", color: "#ebe8e2", img: "/img/kinds/sake-nigori.png" },
      ],
    },
  },

  // 앱의 어휘. 왼쪽(와인 기준 문구)을 오른쪽으로 바꿔 내보낸다.
  copy: {
    // 근처 가게 — 앱마다 찾아 주는 가게가 다르다
    "지역을 적으면 그 근처 와인바와 와인을 파는 곳을 찾아 드립니다.":
      "지역을 적으면 그 근처 이자카야와 사케를 파는 곳을 찾아 드립니다.",
    "가게 분류로 찾은 곳이라 이 와인이 있는지는 가게에 확인해 주세요.":
      "가게 분류로 찾은 곳이라 이 사케가 있는지는 가게에 확인해 주세요.",

    // 메뉴판은 앱마다 다른 자리에서 찍는다 — 이자카야 · 펍 · 바
    "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.":
      "이자카야 메뉴판을 한 장. 적힌 사케를 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.",
    "술병 라벨과 식당 와인 리스트까지":
      "사케 라벨과 이자카야 메뉴판까지",
    "{cat} 리스트":
      "메뉴판",

    "나의 셀러": "나의 술창고",
    "나의 셀러로 이동": "나의 술창고로 이동",
    "셀러": "술창고",
    "셀러 가치": "술창고 가치",
    "셀러에 담기": "술창고에 담기",
    "셀러에 담았습니다.": "술창고에 담았습니다.",
    "셀러 항목을 불러오지 못했습니다.": "술창고 항목을 불러오지 못했습니다.",
    "셀러를 쓸 수 없습니다": "술창고를 쓸 수 없습니다",
    "셀러 화면에서 설정": "술창고 화면에서 설정",
    "셀러에서 테이스팅 노트를 남기면 이 점수에 반영됩니다.":
      "술창고에서 시음 기록을 남기면 이 점수에 반영됩니다.",
    "셀러에 저장됨 · 상단 🍷 아이콘에서 확인하고 목표가를 설정할 수 있습니다.":
      "술창고에 담았습니다 · 아래 술창고 탭에서 목표가를 설정할 수 있습니다.",
    "보유 중인 술이 없습니다": "술창고가 비어 있습니다",

    // 사케는 해가 아니라 담근 때를 본다 (BY = 주조연도, 7월 시작)
    "빈티지별 가격": "제조시기별 가격",
    "스캔한 빈티지": "스캔한 제조시기",
    "판매 중인 상품명에서 추출한 빈티지별 최저가입니다. 작황에 따라 같은 와인도 해마다 평가가 달라집니다.":
      "판매 중인 상품명에서 추출한 제조시기별 최저가입니다. 사케는 갓 나온 것일수록 향이 살아 있습니다.",

    // 숙성이 아니라 신선도
    "음용 적기": "마시기 좋은 때",
    "숙성": "보관",
    "마시기 전 준비": "마시기 전에",

    // 메뉴판은 와인 리스트가 아니다
    "와인 리스트": "메뉴판",
    "식당 와인 리스트를 찍으면": "이자카야 메뉴판을 찍으면",
    "와인 둘러보기부터": "사케 둘러보기부터",
    "우리가 아는 와인": "우리가 아는 사케",
    "메뉴 가격을 온라인 최저가와 견주어 배수를 냅니다. 와인은 통상 시중가의 2~3배가 관행이라, 2배 아래면 값이 좋은 편입니다.":
      "메뉴 가격을 온라인 최저가와 견주어 배수를 냅니다. 사케도 통상 시중가의 2~3배가 관행이라, 2배 아래면 값이 좋은 편입니다.",
    "O · X 여덟 문항이면 취향에 맞는 와인을 골라 드립니다. 30초면 끝납니다.":
      "O · X 몇 문항이면 취향에 맞는 사케를 골라 드립니다. 30초면 끝납니다.",

    "AI 소믈리에가 읽은 라벨": "AI가 읽은 사케 라벨",
    "어떤 잔에": "어떤 그릇에",
  },

  layout: {
    // 사케는 온도와 그릇이 먼저다. 빈티지 비교(vintage)는 넣지 않는다 — 해마다 값이 갈리는 술이 아니다.
    // 조각 이름은 components/ResultScreen.js 의 sections 를 따른다.
    result: [
      "confidence", "community", "price", "cellar",
      "buy", "nearby", "serving", "glass", "gear", "taste", "sakenowa",
      "specs", "pairing", "story", "history",
      "prep", "rating", "trivia", "tips",
      "similar", "deep",
    ],
  },
};

export default sake;
