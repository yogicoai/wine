// 섞어 마시기 — 위스키 + 믹서 (+ 맛 더하기) 를 비율로.
//
// 잭콕·진저 하이볼처럼 비율을 정해 섞어 마시는 것이 요즘 위스키를 마시는 가장 흔한 방법이다.
// 그런데 술 정보에는 "하이볼로 만들 때는 탄산수를 3~4배로" 같은 한 줄뿐이었다.
//
// 사람들이 실제로 어떻게 섞는지는 네이버 카페·블로그 글에서 셌다(2026-10-27, 위스키 글 4,427건).
//   재료  레몬 870 · 탄산수 618 · 토닉 528 · 콜라 476 · 진저에일 309 · 얼그레이 269 · 유자 244 ·
//         매실 187 · 사이다 187 · 녹차 96
//   조합  탄산수+레몬 215 · 토닉+레몬 205 · 진저에일+라임 150 · 얼그레이+시럽 144
//   비율  1 : 3 이 가장 많다 (탄산수 66 · 콜라 24 · 토닉 21건, 그다음 탄산수 1 : 4 가 36건)
// 사람마다 레시피가 달라 보여도 대부분 "위스키 + 믹서 + 맛을 더하는 것 하나"로 정리된다.
// 그래서 믹서와 맛 더하기를 따로 갖고, 레시피는 그 둘의 짝으로 적는다.
//
// 이 위스키에 맞는 것은 규칙으로 고른다(분석 비용 없음). 비율과 위스키 양을 고르면 나머지 양과
// 완성 도수를 계산하고, 순서는 components/MixGuide.js 가 잔 그림으로 보여 준다.
// 따뜻한 것(핫 토디)과 칵테일(올드패션드·위스키 사워·갓파더)은 잔과 순서가 달라 다음 단계다.
//
// 다른 모듈에 기대지 않는다 — 규칙을 Node 로 바로 시험해 볼 수 있게.

/** 믹서 — tint 는 잔에 그릴 색, clear 는 위스키 색이 비치는 맑은 믹서 */
export const MIXERS = {
  soda: { name: "탄산수", tint: "#e4f1f4", opacity: 0.16, clear: true, fizzy: true },
  ginger: { name: "진저에일", tint: "#e7c66e", opacity: 0.5, clear: false, fizzy: true },
  cola: { name: "콜라", tint: "#3b1d12", opacity: 0.92, clear: false, fizzy: true },
  tonic: { name: "토닉워터", tint: "#e9f3f6", opacity: 0.22, clear: true, fizzy: true },
  cider: { name: "사이다", tint: "#eef5e6", opacity: 0.2, clear: true, fizzy: true },
  greentea: { name: "차가운 녹차", tint: "#b8b25a", opacity: 0.55, clear: false, fizzy: false },
};

/**
 * 맛 더하기 — 위스키 45ml 에 넣는 양(per45)을 기준으로 위스키 양에 맞춰 늘고 준다.
 * 양은 글에 가장 자주 나온 값이다 — 레몬즙 10~15ml · 얼그레이 시럽 = 위스키의 1/3 ·
 * 유자청 = 위스키 30ml 에 1큰술 · 매실청 10~20ml.
 */
export const ADDINS = {
  lemon: { name: "레몬즙", per45: 10, tint: "#f3e7a1", text: "레몬즙 {a}ml를 넣습니다" },
  earlgrey: { name: "얼그레이 시럽", per45: 15, tint: "#6b3b1c", text: "얼그레이 시럽 {a}ml를 넣고 저어 녹입니다" },
  yuja: { name: "유자청", per45: 20, tint: "#f0b43a", text: "유자청 {a}ml를 넣고 녹을 때까지 저어 줍니다" },
  maesil: { name: "매실청", per45: 15, tint: "#9a6a2a", text: "매실청 {a}ml를 넣고 녹을 때까지 저어 줍니다" },
};

/** 가니시 — 잔 테두리에 걸 것 (none 이면 그리지 않는다) */
export const GARNISH = {
  lemon: { color: "#f1d54a", rind: "#e2b52c" },
  lime: { color: "#a8cf4f", rind: "#7fa83a" },
};

// 적은 순서가 곧 점수가 같을 때의 순서다 — 많이 찾는 것을 앞에 둔다.
export const RECIPES = {
  highball: {
    key: "highball",
    name: "하이볼",
    mixer: "soda",
    garnish: "lemon",
    garnishText: "레몬 껍질을 비틀어 향을 얹습니다 (선택)",
    why: "위스키 본래 향을 가장 덜 가리는 기본",
    tip: "탄산수는 냉장고에서 꺼낸 강탄산일수록 좋습니다. 산토리는 위스키 1 : 탄산수 4 를 권합니다.",
  },
  lemon: {
    key: "lemon",
    name: "레몬 하이볼",
    mixer: "soda",
    addin: "lemon",
    garnish: "lemon",
    garnishText: "레몬 한 조각을 넣습니다 (선택)",
    why: "탄산수 + 레몬 — 섞어 마시는 글에서 가장 많이 나온 조합",
    tip: "레몬즙 대신 레몬 슬라이스를 꾹 눌러 짜도 됩니다. 탄산수를 토닉워터로 바꾸는 사람도 많습니다.",
  },
  ginger: {
    key: "ginger",
    name: "진저 하이볼",
    mixer: "ginger",
    garnish: "lime",
    garnishText: "라임 한 조각을 짜 넣습니다 (선택)",
    why: "생강의 단맛과 매운맛이 거친 알코올을 감싼다",
    tip: "드라이 진저에일을 쓰면 덜 달고 위스키 맛이 더 남습니다.",
  },
  cola: {
    key: "cola",
    name: "위스키 콜라",
    mixer: "cola",
    garnish: "lemon",
    garnishText: "레몬 한 조각을 걸칩니다 (선택)",
    why: "콜라의 캐러멜 단맛이 위스키의 바닐라와 겹친다",
    tip: "잭다니엘로 만들면 '잭콕'입니다. 제로 콜라를 쓰면 단맛이 줄어 위스키가 더 또렷합니다.",
  },
  earlgrey: {
    key: "earlgrey",
    name: "얼그레이 하이볼",
    mixer: "soda",
    addin: "earlgrey",
    garnish: "lemon",
    garnishText: "레몬 슬라이스를 얹습니다 (선택)",
    why: "홍차 향이 위스키를 부드럽게 감싼다 — 저렴한 위스키를 살리는 조합으로도 꼽힌다",
    tip: "탄산수를 토닉워터로 바꾸면 더 달고 쌉쌀해집니다. 시럽 대신 진하게 우린 얼그레이를 식혀 써도 됩니다.",
  },
  tonic: {
    key: "tonic",
    name: "위스키 토닉",
    mixer: "tonic",
    garnish: "lemon",
    garnishText: "레몬이나 오렌지 껍질을 얹습니다 (선택)",
    why: "토닉의 쌉쌀함이 과일향을 또렷하게 세운다",
    tip: "토닉은 탄산수보다 달아서 같은 비율이면 더 부드럽게 넘어갑니다. 너무 달면 탄산수와 반씩 섞어도 됩니다.",
  },
  yuja: {
    key: "yuja",
    name: "유자 하이볼",
    mixer: "soda",
    addin: "yuja",
    garnish: "none",
    garnishText: null,
    why: "유자의 새콤한 향이 위스키의 단맛과 만난다",
    tip: "유자청 1큰술은 15ml 입니다. 토닉워터로 바꾸면 더 달콤해집니다.",
  },
  maesil: {
    key: "maesil",
    name: "매실 하이볼",
    mixer: "soda",
    addin: "maesil",
    garnish: "none",
    garnishText: null,
    why: "매실의 새콤달콤함이 알코올을 가려 처음 마시는 사람도 편하다",
    tip: "매실청은 단맛이 강합니다. 처음엔 적게 넣고 맛을 보며 늘리세요.",
  },
  cider: {
    key: "cider",
    name: "위스키 사이다",
    mixer: "cider",
    garnish: "lemon",
    garnishText: "레몬 한 조각을 넣습니다 (선택)",
    why: "탄산수 대신 사이다 — 달아서 위스키가 처음이어도 마시기 쉽다",
    tip: "제로 사이다를 쓰면 단맛과 열량이 줄어듭니다.",
  },
  greentea: {
    key: "greentea",
    name: "위스키 녹차",
    mixer: "greentea",
    garnish: "none",
    garnishText: null,
    why: "녹차가 단맛을 눌러 깔끔하게 끝난다 — 한국에서 오래 즐겨 온 방식",
    tip: "우린 녹차를 충분히 식혀서 쓰세요. 병 녹차도 됩니다.",
  },
};

// 농도 — 위스키 1 에 믹서 몇
export const RATIOS = [
  { ratio: 2, label: "진하게", hint: "1 : 2" },
  { ratio: 3, label: "보통", hint: "1 : 3" },
  { ratio: 4, label: "연하게", hint: "1 : 4" },
];

// 위스키 양 — 한국에서 "한 샷"은 보통 30ml, 지거 큰 쪽이 45ml 다
export const SHOTS = [
  { ml: 30, label: "1샷" },
  { ml: 45, label: "지거 1잔" },
  { ml: 60, label: "더블" },
];

// 위스키 갈래별로 어울리는 정도. 0 은 권하지 않는다(목록에도 내지 않는다).
// 피트 위스키에 콜라·녹차·단 청을 권하지 않는 것은 연기 향이 단맛·찻잎과 부딪혀서다.
const FIT = {
  peated: { highball: 3, lemon: 2, ginger: 2 },
  american: { cola: 3, ginger: 2, lemon: 2, highball: 1, earlgrey: 1, cider: 1 },
  rye: { ginger: 3, cola: 2, highball: 2, lemon: 2 },
  irish: { ginger: 3, highball: 2, lemon: 2, tonic: 1, cola: 1, earlgrey: 1, yuja: 1 },
  japanese: { highball: 3, lemon: 2, earlgrey: 2, ginger: 1, tonic: 1, yuja: 1, maesil: 1, cider: 1, greentea: 1 },
  blended: { highball: 3, lemon: 2, ginger: 2, earlgrey: 2, greentea: 2, cola: 1, tonic: 1, yuja: 1, maesil: 1, cider: 1 },
  malt: { highball: 3, lemon: 2, tonic: 2, ginger: 1, earlgrey: 1, yuja: 1 },
};

const STYLE_NOTE = {
  peated: "스모키한 위스키는 탄산수 하이볼로 연기 향이 오히려 또렷해집니다.",
  american: "버번·테네시는 단맛이 있는 믹서와 잘 맞습니다.",
  rye: "라이의 매운 향은 진저에일과 특히 잘 어울립니다.",
  irish: "아이리시는 부드러워서 진저에일과 라임이 정석으로 꼽힙니다.",
  japanese: "재패니스 위스키는 하이볼 문화와 함께 자랐습니다.",
  blended: "블렌디드는 어떤 믹서와도 무난해 섞어 마시기에 가장 편합니다.",
  malt: "싱글몰트는 향을 살리는 탄산수·토닉이 잘 맞습니다.",
};

const PICKS = 3; // 먼저 보여 줄 추천 수 — 나머지는 "다른 레시피"로 접는다

function axisValue(result, axis) {
  return (result.tasteProfile || []).find((a) => a.axis === axis)?.value ?? null;
}

/** 도수 숫자 — "40%" · "57.1%" · 없으면 null */
export function abvOf(result) {
  const n = parseFloat(String(result?.alcohol || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 80 ? n : null;
}

/** 숙성 연수 — 이름이나 숙성 칸의 "18년" · "18 Year" */
function ageOf(result) {
  const text = `${result.name || ""} ${result.aging || ""}`;
  const m = text.match(/(\d{1,2})\s*(?:년|yo\b|years?\b)/i);
  return m ? Number(m[1]) : null;
}

/** 이 위스키의 갈래 — 순서가 곧 우선순위다 (피트가 버번보다 먼저) */
export function styleOf(result) {
  const type = String(result.type || "");
  const text = `${type} ${result.name || ""}`;
  const peat = axisValue(result, "피트");
  if ((peat != null && peat >= 55) || /피티드|피트|아일라|스모키/.test(type)) return "peated";
  if (/버번|bourbon|테네시|tennessee|아메리칸/i.test(text)) return "american";
  if (/라이\s*위스키|^라이$|스트레이트 라이|\brye\b/i.test(type)) return "rye";
  // 제임슨처럼 종류 칸에 "아이리시"가 없는 것이 있어 나라로도 본다
  if (/아이리[시쉬]|irish/i.test(text) || result.country === "아일랜드") return "irish";
  if (result.country === "미국") return "american";
  if (/재패니[즈스]|japanese/i.test(type) || result.country === "일본") return "japanese";
  if (/블렌디드|blended/i.test(type)) return "blended";
  return "malt";
}

/**
 * 이 위스키로 만들 섞어 마시기.
 * @returns {{recipes: object[], picks: number, style: string|null, styleNote: string|null,
 *            ratio: number, abv: number, abvGuessed: boolean, notes: string[]}}
 *   recipes 는 어울리는 순서다. 앞의 picks 개가 추천이고 나머지는 "다른 레시피"다.
 */
export function mixPlan(result) {
  const empty = { recipes: [], picks: 0, style: null, styleNote: null, ratio: 3, abv: 40, abvGuessed: true, notes: [] };
  if (!result || result.category !== "whisky") return empty;
  // 캔·병에 이미 섞여 나온 하이볼은 위스키 목록에 있어도 섞을 것이 아니다
  if (/하이볼|\(캔\)|RTD|프리믹스|칵테일/i.test(String(result.type || ""))) return empty;

  const style = styleOf(result);
  const fit = FIT[style];
  const recipes = Object.values(RECIPES)
    .map((r, i) => ({ ...r, score: fit[r.key] ?? 0, order: i }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => ({
      ...r,
      // 잭다니엘 + 콜라는 이름이 따로 있다 — 사람들이 그 이름으로 찾는다
      name: r.key === "cola" && /잭\s*다니엘|jack\s*daniel/i.test(result.name || "") ? "잭콕" : r.name,
    }));

  const abv = abvOf(result);
  const age = ageOf(result);
  const strong = (abv ?? 0) >= 52 || /캐스크\s*스트렝스|cask strength/i.test(String(result.type || ""));
  const notes = [];
  // 섞는 것을 막지는 않는다 — 다만 비싼 술은 먼저 그대로 맛보길 권한다
  if ((age != null && age >= 18) || result.priceBand >= 5) {
    notes.push("숙성이 길고 귀한 위스키입니다. 섞기 전에 니트로 한 모금 먼저 맛보길 권합니다.");
  }
  if (strong) {
    notes.push(`도수가 ${abv ?? "높은"}${abv ? "%로" : ""} 높아 같은 비율이면 완성 도수도 높습니다. 연하게(1 : 4)부터 권합니다.`);
  }

  return {
    recipes,
    picks: Math.min(PICKS, recipes.length),
    style,
    styleNote: STYLE_NOTE[style],
    ratio: strong ? 4 : 3,
    abv: abv ?? 40,
    abvGuessed: abv == null,
    notes,
  };
}

/** 5ml 단위로 — 계량스푼으로 잴 수 있는 양만 말한다 */
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

/**
 * 한 잔에 들어가는 양과 완성 도수. 완성 도수는 얼음이 녹기 전 기준이다.
 * @returns {{whisky: number, addin: {name: string, ml: number}|null, mixer: {name: string, ml: number}, abv: number}}
 */
export function amountsOf(recipe, { shot, ratio, abv }) {
  const add = recipe.addin ? ADDINS[recipe.addin] : null;
  const addMl = add ? round5((add.per45 * shot) / 45) : 0;
  const mixerMl = shot * ratio;
  const total = shot + addMl + mixerMl;
  return {
    whisky: shot,
    addin: add ? { name: add.name, ml: addMl } : null,
    mixer: { name: MIXERS[recipe.mixer].name, ml: mixerMl },
    abv: total ? Math.round(((abv * shot) / total) * 10) / 10 : 0,
  };
}

/**
 * 만드는 순서. act 는 잔 그림이 무엇을 보여 줄지 정한다(components/MixGuide.js).
 * 숫자는 화면에서 t() 로 채운다 — {w} 위스키 ml · {a} 맛 더하기 ml · {m} 믹서 ml · {mixer} 믹서 이름.
 * 청·시럽은 탄산을 붓기 전에 위스키에 녹인다 — 나중에 넣으면 바닥에 가라앉고 저으면 탄산이 죽는다.
 */
export function stepsOf(recipe) {
  const mixer = MIXERS[recipe.mixer];
  const add = recipe.addin ? ADDINS[recipe.addin] : null;
  const steps = [
    { act: "ice", text: "잔에 얼음을 가득 채웁니다" },
    { act: "chill", text: "바스푼으로 열 번쯤 저어 잔을 차갑게 하고, 녹은 물은 따라 버립니다" },
    { act: "whisky", text: "위스키 {w}ml를 붓습니다" },
  ];
  if (add) steps.push({ act: "addin", text: add.text });
  steps.push(
    { act: "stir", text: add ? "위스키와 함께 한 번 더 저어 차갑게 식힙니다" : "위스키만 한 번 더 저어 차갑게 식힙니다" },
    mixer.fizzy
      ? { act: "mixer", text: "{mixer} {m}ml를 얼음에 닿지 않게 잔 벽을 따라 천천히 붓습니다" }
      : { act: "mixer", text: "{mixer} {m}ml를 붓습니다" },
    mixer.fizzy
      ? { act: "lift", text: "바스푼을 바닥까지 넣어 위아래로 한 번만 — 탄산이 살아 있도록" }
      : { act: "lift", text: "두세 번 저어 고르게 섞습니다" }
  );
  if (recipe.garnishText) steps.push({ act: "garnish", text: recipe.garnishText });
  return steps;
}
