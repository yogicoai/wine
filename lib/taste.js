// 취향 문답 — 별점 기록이 없어도 첫날부터 추천을 받을 수 있게 한다.
//
// 기록에서 취향을 뽑는 방식(buildTasteProfile)은 별점이 두 개 이상 쌓여야 동작한다.
// 처음 온 사람에게는 아무것도 못 준다는 뜻이다. 그래서 여섯~여덟 개만 물어본다.
// 답은 모두 O / X 이고, 모르면 건너뛸 수 있다.
//
// 문항은 주종을 따라간다. 맛 축이 주종마다 다르기 때문이다(와인은 탄닌, 맥주는 홉).
// 와인 축으로만 물으면 맥주·위스키에서는 겹치는 축이 "바디" 하나뿐이라
// 추천 유사도(축 2개 이상 필요)가 성립하지 않아 결과가 통째로 비어 버린다.

import { axesOf, catOf } from "./cats";
import { t } from "./i18n";

// 축별 문항 — 이 앱이 다루는 주종의 축만 골라 쓴다.
// up/down 은 O/X 일 때 50 에서 움직이는 폭이다. 확신이 큰 축일수록 크게 잡았다.
const AXIS_Q = {
  바디: { text: "가벼운 것보다 묵직한 쪽이 좋다", hint: "입안을 꽉 채우는 무게감", up: 26, down: -26 },
  탄닌: { text: "떫은맛이 있어도 괜찮다", hint: "감이나 진한 홍차의 텁텁한 느낌", up: 26, down: -30 },
  당도: { text: "달콤한 술이 좋다", up: 32, down: -22 },
  단맛: { text: "달콤한 술이 좋다", up: 32, down: -22 },
  산도: { text: "새콤한 맛을 즐긴다", hint: "레몬이나 자몽 같은 산뜻함", up: 22, down: -22 },
  산미: { text: "새콤한 맛을 즐긴다", hint: "레몬이나 자몽 같은 산뜻함", up: 22, down: -22 },
  감칠맛: { text: "구수하게 입에 남는 맛이 좋다", hint: "쌀이나 된장에서 오는 감칠맛", up: 26, down: -24 },
  피트: { text: "스모키한 향을 좋아한다", hint: "모닥불이나 소독약에 비유되는 향", up: 30, down: -34 },
  과일향: { text: "과일 향이 뚜렷한 쪽이 좋다", up: 26, down: -20 },
  스파이스: { text: "알싸한 향신료 느낌이 좋다", hint: "후추나 계피처럼 톡 쏘는 향", up: 24, down: -22 },
  쓴맛: { text: "쌉싸름한 맛이 있어도 괜찮다", hint: "홉에서 오는 씁쓸함", up: 28, down: -30 },
  홉향: { text: "홉의 꽃·풀 향이 진한 쪽이 좋다", up: 26, down: -24 },
  몰트: { text: "곡물의 고소한 단맛이 좋다", hint: "빵이나 비스킷 같은 구수함", up: 26, down: -22 },
  오크: { text: "나무통 숙성 향을 좋아한다", hint: "바닐라와 나무 냄새", up: 26, down: -24 },
  "향의 강도": { text: "향이 강한 술이 좋다", up: 28, down: -28 },
  아가베: { text: "아가베의 풀 같은 향이 좋다", hint: "데킬라 특유의 식물 향", up: 26, down: -24 },
  당밀: { text: "당밀의 진한 단 향이 좋다", hint: "흑설탕이나 캐러멜 향", up: 26, down: -24 },
  주니퍼: { text: "솔 향이 강한 쪽이 좋다", hint: "진 특유의 주니퍼 향", up: 26, down: -26 },
  시트러스: { text: "감귤 향이 뚜렷한 쪽이 좋다", up: 24, down: -22 },
  허브: { text: "허브나 약초 향을 좋아한다", up: 24, down: -24 },
  깔끔함: { text: "복잡한 맛보다 깔끔하게 넘어가는 쪽이 좋다", up: 24, down: -24 },
  곡물향: { text: "곡물 향이 느껴지는 쪽이 좋다", hint: "쌀이나 보리의 구수함", up: 24, down: -22 },
  부드러움: { text: "목넘김이 부드러운 쪽이 좋다", up: 26, down: -24 },
  탄산감: { text: "탄산이 톡 쏘는 쪽이 좋다", up: 26, down: -26 },
};

// 와인에서만 뜻이 통하는 문항 — 레드/화이트/스파클링 선택
const WINE_ONLY = [
  {
    id: "red",
    text: "화이트보다 레드와인이 더 좋다",
    yes: { category: "red" },
    no: { category: "white" },
  },
  {
    id: "sparkling",
    text: "탄산이 있는 술을 좋아한다",
    yes: { category: "sparkling", 산도: +10 },
    no: {},
  },
];

// 편의점에서 사는 값이 기본인 주종 — "5만원" 을 물으면 아무 뜻이 없다
const EVERYDAY = new Set(["beer", "soju", "makgeolli", "highball"]);

// 받침 유무로 조사를 고른다 ("와인을", "사케를")
function objectParticle(word) {
  const code = String(word).charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "를";
  return code % 28 ? "을" : "를";
}

/** 이 주종에서 물어볼 문항 목록 */
export function questionsFor(category = "wine") {
  const label = catOf(category).label;
  const list = [];

  for (const axis of axesOf(category)) {
    const q = AXIS_Q[axis];
    if (!q) continue; // 사전에 없는 축은 묻지 않는다 (값은 중립 50 으로 남는다)
    list.push({
      id: `axis:${axis}`,
      text: q.text,
      hint: q.hint || null,
      yes: { [axis]: q.up },
      no: { [axis]: q.down },
    });
  }

  if (category === "wine") list.push(...WINE_ONLY);

  list.push({
    id: "novice",
    text: `${label}${objectParticle(label)} 마셔본 지 1년이 안 됐다`,
    yes: { novice: true },
    no: { novice: false },
  });

  list.push(
    EVERYDAY.has(category)
      ? {
          // 맥주·소주는 대부분 2만원 아래다. 값을 더 쓸 생각이 있는지만 가른다.
          id: "budget",
          text: "편의점 가격보다 비싸도 괜찮다",
          yes: { maxBand: 5 },
          no: { maxBand: 1 },
        }
      : {
          id: "budget",
          text: "한 병에 5만원 넘게 쓸 수 있다",
          yes: { maxBand: 5 },
          no: { maxBand: 2 },
        }
  );

  return list;
}

// 지난 버전(와인 전용 문항)으로 저장된 답을 새 id 로 읽어 준다.
// 문답을 다시 하게 만들지 않으려는 것뿐이라, 와인 축에만 해당한다.
const LEGACY_ID = {
  body: "axis:바디",
  tannin: "axis:탄닌",
  sweet: "axis:당도",
  acid: "axis:산도",
};

/**
 * 답변 → 취향 프로필
 * @param {Record<string, "yes"|"no">} answers
 * @param {string} category 이 앱(또는 화면)이 보는 주종 — 축이 여기서 정해진다
 * @returns {{axes: {axis,value}[], novice: boolean|null, maxBand: number|null, prefer: string[], answered: number}}
 */
export function profileFromAnswers(answers = {}, category = "wine") {
  const axes = axesOf(category);
  const values = Object.fromEntries(axes.map((a) => [a, 50])); // 중간에서 시작
  const prefer = [];
  let novice = null;
  let maxBand = null;
  let answered = 0;

  // 옛 id 로 저장된 답을 새 id 자리에 채워 둔다 (이미 새 id 가 있으면 그쪽이 우선)
  const merged = { ...answers };
  for (const [oldId, newId] of Object.entries(LEGACY_ID)) {
    if (merged[newId] == null && answers[oldId] != null) merged[newId] = answers[oldId];
  }

  for (const q of questionsFor(category)) {
    const pick = merged[q.id];
    if (pick !== "yes" && pick !== "no") continue; // 건너뛴 문항
    answered++;

    const effect = pick === "yes" ? q.yes : q.no;
    for (const [k, v] of Object.entries(effect || {})) {
      if (k in values) values[k] += v;
      else if (k === "category") prefer.push(v);
      else if (k === "novice") novice = v;
      else if (k === "maxBand") maxBand = v;
    }
  }

  return {
    axes: axes.map((axis) => ({ axis, value: Math.max(0, Math.min(100, values[axis])) })),
    novice,
    maxBand,
    prefer,
    answered,
    category,
  };
}

// 축별 형용사 — [높을 때, 낮을 때]
const ADJ = {
  바디: ["묵직한", "가벼운"],
  탄닌: ["탄닌이 있는", "부드러운"],
  당도: ["달콤한", "드라이한"],
  단맛: ["달콤한", "드라이한"],
  산도: ["산뜻한", "산미가 낮은"],
  산미: ["산뜻한", "산미가 낮은"],
  감칠맛: ["감칠맛 있는", "담백한"],
  피트: ["스모키한", "피트 없는"],
  과일향: ["과일 향 짙은", "과일 향 절제된"],
  스파이스: ["알싸한", "순한"],
  쓴맛: ["쌉싸름한", "쓴맛 적은"],
  홉향: ["홉 향 진한", "홉 향 절제된"],
  몰트: ["고소한", "몰트가 가벼운"],
  오크: ["오크 향 짙은", "오크 향 절제된"],
  "향의 강도": ["향이 강한", "향이 은은한"],
  아가베: ["아가베 향 짙은", "아가베 향 절제된"],
  당밀: ["당밀 향 짙은", "당밀 향 절제된"],
  주니퍼: ["솔 향 강한", "솔 향 절제된"],
  시트러스: ["감귤 향 나는", "감귤 향 적은"],
  허브: ["허브 향 나는", "허브 향 적은"],
  깔끔함: ["깔끔한", "진한"],
  곡물향: ["곡물 향 나는", "곡물 향 적은"],
  부드러움: ["부드러운", "묵직하게 강한"],
  탄산감: ["탄산 강한", "탄산 약한"],
};

// 한 줄 요약 — 설정 화면에서 "지금 이렇게 설정되어 있습니다"로 보여 준다
export function describe(profile) {
  if (!profile?.answered) return null;

  const words = [];
  for (const { axis, value } of profile.axes) {
    const pair = ADJ[axis];
    if (!pair) continue;
    if (value >= 65) words.push(pair[0]);
    else if (value <= 33) words.push(pair[1]);
  }

  if (!words.length) words.push("무난한");
  // 이 문장은 서버에서 만들어져 화면에 그대로 실리므로 여기서 번역까지 마친다
  return t("{s} 스타일", { s: words.slice(0, 3).map((w) => t(w)).join(" · ") });
}
