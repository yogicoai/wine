// 무슨 잔에 마실 것인가.
//
// 잔은 술맛을 실제로 바꾼다. 입구가 좁으면 향이 모이고, 넓으면 흩어진다.
// 그런데 어떤 잔을 써야 하는지는 대개 술을 산 뒤에야 궁금해지고, 그때는 물어볼 데가 없다.
//
// 이 값들은 술 정보에서 규칙으로 뽑아 낸다. AI를 부르지 않으므로 비용이 0원이다.
// 카탈로그에는 잔이 술로 섞여 들어오지 못하게 막아 두었지만(lib/notDrink.js),
// 여기서는 반대로 잔을 제대로 권한다 — 상품으로 섞이는 것과 추천하는 것은 다른 일이다.

/** 잔 하나의 정의. shopKeyword 는 구매 링크에 그대로 쓴다. */
const GLASS = {
  bordeaux: {
    name: "보르도 잔",
    shape: "볼이 크고 입구가 곧게 선 잔",
    why: "탄닌이 강한 술을 넓은 볼에서 공기와 만나게 해 떫은맛을 눕힙니다",
    shopKeyword: "보르도 와인잔",
  },
  burgundy: {
    name: "부르고뉴 잔",
    shape: "볼이 둥글게 부풀고 입구가 좁아지는 잔",
    why: "향이 섬세한 술의 냄새를 볼에 모아 코끝으로 올려 줍니다",
    shopKeyword: "부르고뉴 와인잔",
  },
  white: {
    name: "화이트 와인 잔",
    shape: "볼이 작고 갸름한 잔",
    why: "잔이 작아 술이 덜 데워지고, 산도와 과일 향이 또렷하게 남습니다",
    shopKeyword: "화이트 와인잔",
  },
  flute: {
    name: "플루트 잔",
    shape: "길고 좁은 잔",
    why: "바닥이 좁아 기포가 한 줄로 길게 올라옵니다",
    shopKeyword: "샴페인 플루트잔",
  },
  tulipSparkling: {
    name: "튤립형 스파클링 잔",
    shape: "가운데가 부풀고 입구가 살짝 좁아지는 잔",
    why: "기포는 지키면서 향은 플루트보다 잘 퍼집니다. 향이 좋은 샴페인에 권합니다",
    shopKeyword: "샴페인 튤립잔",
  },
  dessert: {
    name: "디저트 와인 잔",
    shape: "아주 작은 잔",
    why: "단맛이 강한 술은 조금씩 마셔야 물리지 않습니다",
    shopKeyword: "디저트 와인잔",
  },
  port: {
    name: "포트 잔",
    shape: "작고 볼이 도톰한 잔",
    why: "도수가 높아 적게 따르고, 볼에서 향이 열리게 합니다",
    shopKeyword: "포트 와인잔",
  },
  copita: {
    name: "코피타 잔",
    shape: "튤립을 닮은 작은 잔",
    why: "셰리와 증류주의 향을 모아 주는 잔입니다. 위스키 테이스팅에도 씁니다",
    shopKeyword: "코피타 잔",
  },
  ochoko: {
    name: "오초코",
    shape: "한 모금 크기의 작은 잔",
    why: "따라 주고 받는 자리에 맞는 크기이고, 데운 술이 식기 전에 비웁니다",
    shopKeyword: "사케잔 오초코",
  },
  masu: {
    name: "마스",
    shape: "네모난 나무 됫박",
    why: "삼나무 향이 술에 옮아 붙습니다. 축하 자리에 쓰는 전통 방식입니다",
    shopKeyword: "사케 마스",
  },
  wineForSake: {
    name: "화이트 와인 잔",
    shape: "볼이 작고 갸름한 잔",
    why: "향이 화려한 다이긴조는 작은 잔보다 와인 잔에서 향이 제대로 열립니다",
    shopKeyword: "화이트 와인잔",
  },
  pilsner: {
    name: "필스너 잔",
    shape: "길고 위로 벌어지는 잔",
    why: "탄산과 거품이 오래 가고, 맑은 색이 잘 보입니다",
    shopKeyword: "필스너 맥주잔",
  },
  weizen: {
    name: "바이젠 잔",
    shape: "허리가 잘록하고 위가 넓은 큰 잔",
    why: "밀맥주의 두꺼운 거품을 받아 낼 자리가 필요합니다",
    shopKeyword: "바이젠 맥주잔",
  },
  tulipBeer: {
    name: "튤립 잔",
    shape: "볼이 부풀고 입구가 밖으로 말린 잔",
    why: "향이 진한 에일의 냄새를 모으고 거품을 단단하게 세웁니다",
    shopKeyword: "튤립 맥주잔",
  },
  snifter: {
    name: "스니프터",
    shape: "볼이 둥글고 입구가 좁은 잔",
    why: "도수가 높은 흑맥주와 브랜디의 향을 손 온기로 열어 줍니다",
    shopKeyword: "스니프터 잔",
  },
  pint: {
    name: "파인트 잔",
    shape: "위로 곧게 벌어지는 큰 잔",
    why: "많이 담기고 잡기 편해, 가볍게 넘기는 맥주에 맞습니다",
    shopKeyword: "파인트 맥주잔",
  },
  makgeolliBowl: {
    name: "막걸리 사발",
    shape: "넓고 낮은 사발",
    why: "가라앉은 앙금을 저어 마시기 좋고, 나눠 마시는 술자리에 맞습니다",
    shopKeyword: "막걸리 사발",
  },
  sojuGlass: {
    name: "소주잔",
    shape: "한 모금 크기의 작은 잔",
    why: "도수가 높아 조금씩 마시고, 따라 주고 받는 자리에 맞습니다",
    shopKeyword: "소주잔",
  },
  baekjaCup: {
    name: "백자 잔",
    shape: "굽이 있는 흰 도자기 잔",
    why: "약주·청주의 맑은 빛이 흰 바탕에서 잘 보입니다",
    shopKeyword: "백자 술잔",
  },
  whiskyGlass: {
    name: "위스키 잔",
    shape: "볼이 도톰하고 입구가 좁아지는 잔",
    why: "알코올 향이 코를 찌르지 않게 향만 모아 올려 줍니다",
    shopKeyword: "위스키 테이스팅잔",
  },
};

function textOf(result) {
  return `${result?.type || ""} ${result?.name || ""}`;
}

function axis(result, name) {
  return (result?.tasteProfile || []).find((a) => a.axis === name)?.value ?? null;
}

/** 와인은 품종·유형에 따라 잔이 갈린다 */
function forWine(result) {
  const t = textOf(result);

  if (/디저트|소테른|아이스와인|토카이|바르삭|귀부/.test(t)) return ["dessert"];
  if (/포트|셰리|마데이라|주정강화/.test(t)) return ["port", "copita"];
  if (/스파클링|샴페인|프로세코|카바|크레망|아스티|젝트|프란차코르타/.test(t)) {
    // 향이 좋은 샴페인은 플루트보다 튤립이 낫다
    return /샴페인|블랑 드 블랑|밀레짐|프레스티지/.test(t) ? ["tulipSparkling", "flute"] : ["flute"];
  }
  if (/로제/.test(t)) return ["white"];
  if (/화이트|샤르도네|소비뇽 블랑|리슬링|모스카토|피노 그리|알바리뇨|슈냉|비오니에|그뤼너|코르테제|고슈/.test(t)) {
    return ["white"];
  }
  // 레드 — 섬세한 품종은 부르고뉴 잔, 탄닌이 센 쪽은 보르도 잔
  if (/피노 누아|네비올로|바롤로|바르바레스코|가메|보졸레|산지오베제|키안티|브루넬로/.test(t)) {
    return ["burgundy"];
  }
  const tannin = axis(result, "탄닌");
  if (tannin != null && tannin < 50) return ["burgundy"];
  return ["bordeaux"];
}

function forSake(result) {
  const t = textOf(result);
  // 다이긴조·긴조는 향이 화려해 와인 잔이 낫다는 것이 요즘 일본 양조장들의 권고다
  if (/다이긴조|긴조|준마이 다이긴조/.test(t)) return ["wineForSake", "ochoko"];
  if (/니고리|탁주/.test(t)) return ["ochoko"];
  return ["ochoko", "masu"];
}

function forBeer(result) {
  const t = textOf(result);
  if (/바이젠|밀맥주|헤페|바이스/.test(t)) return ["weizen"];
  if (/스타우트|포터|임페리얼|배럴/.test(t)) return ["snifter", "tulipBeer"];
  if (/IPA|에일|페일|세종|트리펠|두벨/i.test(t)) return ["tulipBeer", "pint"];
  if (/라거|필스너|필젠/.test(t)) return ["pilsner"];
  return ["pint"];
}

function forTraditional(result) {
  const t = textOf(result);
  if (/막걸리|탁주|동동주|생탁/.test(t)) return ["makgeolliBowl"];
  if (/약주|청주|법주|가양주/.test(t)) return ["baekjaCup"];
  if (/증류|소주|안동소주|문배|이강/.test(t)) return ["sojuGlass", "baekjaCup"];
  return ["baekjaCup"];
}

/**
 * 이 술에 맞는 잔을 고른다.
 * @returns {{glasses: object[], tip: string|null}} 모르면 빈 배열 — 아무 잔이나 권하지 않는다
 */
export function glasswareFor(result) {
  if (!result?.category) return { glasses: [], tip: null };

  let keys = [];
  let tip = null;

  switch (result.category) {
    case "wine":
      keys = forWine(result);
      tip = "잔 하나만 산다면 부르고뉴 잔이 두루 무난합니다.";
      break;
    case "sake":
      keys = forSake(result);
      tip = "데워 마실 술은 작은 잔이라야 식기 전에 비웁니다.";
      break;
    case "beer":
      keys = forBeer(result);
      tip = "잔은 찬물로 헹궈 두면 거품이 더 곱게 섭니다.";
      break;
    case "traditional":
    case "soju":
      keys = forTraditional(result);
      tip = "막걸리는 마시기 전에 병을 눕혀 굴리면 앙금이 고르게 섞입니다.";
      break;
    case "whisky":
    case "brandy":
      keys = ["whiskyGlass", "copita"];
      tip = "향을 볼 때는 입구가 좁은 잔, 편하게 마실 때는 넓은 잔을 씁니다.";
      break;
    default:
      return { glasses: [], tip: null };
  }

  return { glasses: keys.map((k) => ({ key: k, ...GLASS[k] })).filter((g) => g.name), tip };
}

export { GLASS };
