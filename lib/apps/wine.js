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

    // 밝은 디자인(2026-10-28 사용자) — 위스키 렌즈(바탕화면 whisky 저장소)의 흰 바탕 · 회색 타일 · 떠 있는 유리 메뉴를
    // 와인 · 사케 두 앱에 입힌다. 이 값이 있으면 위의 어두운 값(배경 사진 · 그레인 · 세리프)은 쓰지 않는다(app/light.css).
    ui: "light",
    light: {
      accent: "#9b2f45", // 클라렛 — 지금 탭 · 점 · 막대
      accentText: "#7e2236", // 작은 강조 글자(흰 바탕 8:1)
      accentDeep: "#5d1626",
      accentSoft: "#f7e9ec", // 지금 탭 · 고른 것 바탕
      button: "linear-gradient(180deg, #a8394f 0%, #7a2236 100%)", // 누르는 단추 — 흰 글자
      tile: "#f5f3f0", // 판 — 흰 바탕 위 옅은 따뜻한 회색
      tile2: "#efece7",
      // 그림(힉스필드 2026-10-28, 원본 docs/design/light-2026-10-28) — 홈 촬영 판의 실사 사진 · 머리말 마크 · 앱 아이콘(app-wine-*.png)
      heroPhoto: "/img/hero_wine.jpg",
      mark: "/icons/mark-wine-light.png",
      tastePhoto: "/img/taste_wine.jpg", // 찾기 "나의 취향" 판 — 네 잔 시음
      // 홈(components/HomeScreen.js) — 위스키 렌즈 홈과 같은 자리에 와인의 것을 넣는다.
      //   1:3 칸 → 맛있는 온도 · 잭콕 사진 칸 → 페어링 사진 · 공지 배너 → 계절 한 잔. term 은 목록 탭 종류 검색어
      home: {
        noun: "와인",
        title: ["오늘은 어떤 와인을", "마셔 볼까요?"],
        temp: { big: "16~18℃", small: "레드 와인이 가장 맛있는 온도", term: "레드" },
        pair: { photo: "/img/pair_wine.jpg", label: "치즈·샤퀴테리와", small: "레드 와인", term: "레드" },
        banner: { title: "쌀쌀한 가을엔 보르도 한 잔", body: "묵직한 레드가 생각나는 계절이에요. 보르도 와인을 모아 봤어요.", term: "보르도" },
      },
      // 홈 종류 카드(components/KindRail.js) — term 으로 찾기를 연다(술 종류 칸까지 찾는다).
      // 2026-10-28 DB 기준 레드 1,289 · 화이트 781 · 스파클링 333 · 로제 205 · 디저트 122종
      // 사진 없는 와인의 종류 대표 병(lib/appProfile.js kindBottle) — 위에서부터 처음 걸리는 것, 마지막은 기본(레드)
      bottles: [
        { match: "스파클링|샴페인|크레망|카바|프로세코|아스티|브뤼|젝트", img: "/img/bottles/wine-sparkling.png" },
        { match: "로제", img: "/img/bottles/wine-rose.png" },
        { match: "디저트|주정강화|포트|셰리|마데이라|아이스와인|토카이|귀부|소테른", img: "/img/bottles/wine-dessert.png" },
        { match: "화이트|샤르도네|소비뇽 블랑|리슬링|모스카토|피노 그리|게뷔르츠|슈냉|비오니에", img: "/img/bottles/wine-white.png" },
        { match: "", img: "/img/bottles/wine-red.png" },
      ],
      kinds: [
        { label: "레드", en: "Red", term: "레드", color: "#eac6cc", img: "/img/kinds/wine-red.png" },
        { label: "화이트", en: "White", term: "화이트", color: "#e7ecd2", img: "/img/kinds/wine-white.png" },
        { label: "스파클링", en: "Sparkling", term: "스파클링", color: "#f1e1bd", img: "/img/kinds/wine-sparkling.png" },
        { label: "로제", en: "Rosé", term: "로제", color: "#f3cfc6", img: "/img/kinds/wine-rose.png" },
        { label: "디저트", en: "Dessert", term: "디저트", color: "#e9cfa8", img: "/img/kinds/wine-dessert.png" },
      ],
    },
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
