// 잔 다음은 도구다.
//
// 디캔터·아이스볼 몰드·도쿠리처럼 술맛을 실제로 바꾸는 도구만 권한다 — 장식품은 넣지 않는다.
// 잔(lib/glassware.js)과 같은 방식: 술 정보에서 규칙으로 고르므로 분석 비용이 0원이다.
// shopKeyword 는 구매 검색에 그대로 쓴다.

const GEAR = {
  // ── 와인
  decanter: {
    emoji: "🫗",
    name: "디캔터",
    why: "탄닌이 강한 레드를 공기와 넓게 만나게 해 떫은맛을 눕힙니다",
    shopKeyword: "와인 디캔터",
  },
  opener: {
    emoji: "🍾",
    name: "소믈리에 나이프",
    why: "호일 커터와 스크류가 하나로 — 코르크를 부수지 않고 뽑습니다",
    shopKeyword: "소믈리에 나이프",
  },
  iceBucket: {
    emoji: "🧊",
    name: "아이스 버킷",
    why: "얼음과 물을 반씩 채우면 냉장고보다 세 배 빠르게 차가워집니다",
    shopKeyword: "와인 아이스버킷",
  },
  vacuumStopper: {
    emoji: "🫙",
    name: "진공 마개",
    why: "남은 병의 공기를 뽑아 두면 며칠은 향이 버팁니다",
    shopKeyword: "와인 진공마개",
  },
  sparklingStopper: {
    emoji: "🍾",
    name: "샴페인 스토퍼",
    why: "남은 탄산을 병 안에 가둡니다 — 숟가락을 꽂는 속설보다 확실합니다",
    shopKeyword: "샴페인 스토퍼",
  },
  // ── 사케
  tokkuri: {
    emoji: "🍶",
    name: "도쿠리",
    why: "뜨거운 물에 앉혀 데우는 술병 — 칸(燗)의 기본 도구입니다",
    shopKeyword: "사케 도쿠리",
  },
  thermometer: {
    emoji: "🌡",
    name: "조리용 온도계",
    why: "칸의 적온 40~45℃는 감으로 맞추기 어렵습니다 — 온도계 하나면 정확해집니다",
    shopKeyword: "조리용 온도계",
  },
  sakeSet: {
    emoji: "🍶",
    name: "주기 세트",
    why: "도쿠리와 오초코 한 벌 — 따라 주고 받는 사케의 문법이 갖춰집니다",
    shopKeyword: "사케 주기세트",
  },
  // ── 맥주
  bottleOpener: {
    emoji: "🗝",
    name: "병따개",
    why: "병맥주의 왕관 뚜껑은 흔들지 말고 한 번에 — 기본 중의 기본입니다",
    shopKeyword: "병따개 오프너",
  },
  beerFoamer: {
    emoji: "🫧",
    name: "맥주 거품기",
    why: "캔맥주에 크림 같은 거품을 세워 줍니다 — 거품은 향을 가두는 뚜껑입니다",
    shopKeyword: "맥주 거품기",
  },
  // ── 위스키·증류주
  iceBallMold: {
    emoji: "⚪",
    name: "아이스볼 몰드",
    why: "큰 얼음일수록 천천히 녹아 덜 희석됩니다 — 온더락의 기본기입니다",
    shopKeyword: "아이스볼 몰드",
  },
  dropper: {
    emoji: "💧",
    name: "워터 드로퍼",
    why: "물 몇 방울이 닫힌 향을 엽니다 — 가수(加水)를 정확하게",
    shopKeyword: "위스키 스포이드",
  },
  jigger: {
    emoji: "⚖️",
    name: "지거",
    why: "칵테일은 계량이 절반입니다 — 30·45ml 를 눈대중 없이",
    shopKeyword: "칵테일 지거",
  },
  shaker: {
    emoji: "🍸",
    name: "셰이커",
    why: "차갑게 섞고 얼음 조각은 걸러 냅니다 — 홈 칵테일의 첫 도구",
    shopKeyword: "칵테일 셰이커",
  },
  barSpoon: {
    emoji: "🥄",
    name: "바 스푼",
    why: "긴 자루가 하이볼 바닥까지 닿아 탄산을 죽이지 않고 섞습니다",
    shopKeyword: "바스푼",
  },
  // ── 전통주
  kettle: {
    emoji: "🫖",
    name: "막걸리 주전자",
    why: "주전자에 옮기면 앙금이 자연히 섞이고, 나눠 따르기도 좋습니다",
    shopKeyword: "막걸리 주전자",
  },
  jugiSet: {
    emoji: "🏺",
    name: "전통주 주기 세트",
    why: "굽 있는 잔과 주병 한 벌 — 맑은술의 빛깔이 제대로 보입니다",
    shopKeyword: "전통주 주기세트",
  },
};

function textOf(result) {
  return `${result?.type || ""} ${result?.name || ""}`;
}

function axis(result, name) {
  return (result?.tasteProfile || []).find((a) => a.axis === name)?.value ?? null;
}

/**
 * 이 술에 맞는 도구를 고른다.
 * @returns {{items: object[], tip: string|null}} 권할 것이 없으면 빈 배열 — 카드도 뜨지 않는다
 */
export function gearFor(result) {
  if (!result?.category) return { items: [], tip: null };
  const t = textOf(result);

  let keys = [];
  let tip = null;

  switch (result.category) {
    case "wine": {
      const sparkling = /스파클링|샴페인|샹동|프로세코|아스티|크레망|카바|브뤼/.test(t);
      if (sparkling) {
        // 스파클링 코르크는 손으로 돌려 뽑는다 — 오프너가 필요 없다
        keys = ["iceBucket", "sparklingStopper"];
        tip = "코르크는 병을 돌려서 뽑습니다 — '펑' 소리가 작을수록 잘 딴 것입니다.";
        break;
      }
      keys = ["opener"];
      const whiteish = /화이트|로제|디저트|소테른|아이스와인|리슬링|모스카토/.test(t);
      const tannin = axis(result, "탄닌") ?? 40;
      if (whiteish) keys.push("iceBucket");
      else if (tannin >= 48) keys.unshift("decanter");
      keys.push("vacuumStopper");
      tip = "디캔터가 없으면 잔을 크게 흔들고, 버킷이 없으면 냉동실 15분이 대신합니다.";
      break;
    }
    case "sake": {
      // 데워 마시기 좋은 술에만 칸 도구를 권한다 — 긴조·다이긴조·생주는 차게 마시는 술이다
      const warmOk =
        /준마이|혼조조|키모토|야마하이|후츠슈|보통주/.test(t) &&
        !/긴조|다이긴조|나마|생주|스파클링|발포|니고리/.test(t);
      keys = warmOk ? ["tokkuri", "thermometer"] : ["sakeSet"];
      tip = warmOk
        ? "전자레인지로 데운다면 30초씩 끊어서 — 한 번에 돌리면 위만 뜨거워집니다."
        : "차게 마시는 술은 잔만 갖추면 됩니다 — 향이 화려할수록 볼이 넓은 잔으로.";
      break;
    }
    case "beer":
      keys = ["beerFoamer", "bottleOpener"];
      tip = "잔을 냉동실에 두면 서리는 예쁘지만 거품이 거칠어집니다 — 찬물 헹굼이 정석입니다.";
      break;
    case "traditional":
    case "soju":
      if (/막걸리|탁주|동동주|생탁/.test(t)) {
        keys = ["kettle"];
        tip = "밑에 가라앉은 앙금까지 섞어야 제 맛입니다 — 주전자에 옮기면 자연히 섞입니다.";
      } else if (/약주|청주|법주|가양주|증류|안동소주|문배|이강/.test(t)) {
        keys = ["jugiSet"];
        tip = "맑은술은 상에서 온도가 빨리 오릅니다 — 작은 병에 나눠 차게 두고 따르세요.";
      }
      break;
    case "whisky":
      keys = ["iceBallMold", "dropper"];
      tip = "니트 → 물 몇 방울 → 온더락 순서로 마셔 보면 한 병에서 세 가지 얼굴이 나옵니다.";
      break;
    case "brandy":
      // 브랜디는 잔이 도구의 전부다 — 손 온기로 데우는 술이라 더할 것이 없다
      break;
    case "vodka":
    case "gin":
    case "rum":
    case "tequila":
    case "liqueur":
      keys = ["jigger", "barSpoon", "shaker"];
      tip = "홈 칵테일은 계량이 절반입니다 — 지거 하나만 있어도 실패가 확 줄어듭니다.";
      break;
    case "highball":
    case "rtd":
      keys = ["iceBallMold"];
      tip = "잔에 얼음을 가득 채우고 캔을 천천히 따르면 탄산이 살아남습니다.";
      break;
    default:
      break;
  }

  return { items: keys.map((k) => ({ key: k, ...GEAR[k] })).filter((g) => g.name), tip };
}

export { GEAR };
