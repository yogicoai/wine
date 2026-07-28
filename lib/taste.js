// 취향 문답 — 별점 기록이 없어도 첫날부터 추천을 받을 수 있게 한다.
//
// 기록에서 취향을 뽑는 방식(buildTasteProfile)은 별점이 두 개 이상 쌓여야 동작한다.
// 처음 온 사람에게는 아무것도 못 준다는 뜻이다. 그래서 여덟 개만 물어본다.
// 답은 모두 O / X 이고, 모르면 건너뛸 수 있다.

export const QUESTIONS = [
  {
    id: "red",
    text: "화이트보다 레드와인이 더 좋다",
    yes: { category: "red" },
    no: { category: "white" },
  },
  {
    id: "tannin",
    text: "떫은맛이 있어도 괜찮다",
    hint: "감이나 진한 홍차의 텁텁한 느낌",
    yes: { 탄닌: +26 },
    no: { 탄닌: -30 },
  },
  {
    id: "sweet",
    text: "달콤한 술이 좋다",
    yes: { 당도: +32 },
    no: { 당도: -22 },
  },
  {
    id: "body",
    text: "가벼운 것보다 묵직한 쪽이 좋다",
    hint: "입안을 꽉 채우는 무게감",
    yes: { 바디: +26 },
    no: { 바디: -26 },
  },
  {
    id: "acid",
    text: "새콤한 맛을 즐긴다",
    hint: "레몬이나 자몽 같은 산뜻함",
    yes: { 산도: +22 },
    no: { 산도: -22 },
  },
  {
    id: "sparkling",
    text: "탄산이 있는 술을 좋아한다",
    yes: { category: "sparkling", 산도: +10 },
    no: {},
  },
  {
    id: "novice",
    text: "와인을 마셔본 지 1년이 안 됐다",
    yes: { novice: true },
    no: { novice: false },
  },
  {
    id: "budget",
    text: "한 병에 5만원 넘게 쓸 수 있다",
    yes: { maxBand: 5 },
    no: { maxBand: 2 },
  },
];

const AXES = ["바디", "당도", "산도", "탄닌"];

/**
 * 답변 → 취향 프로필
 * @param {Record<string, "yes"|"no">} answers
 * @returns {{axes: {axis,value}[], novice: boolean|null, maxBand: number|null, prefer: string[], answered: number}}
 */
export function profileFromAnswers(answers = {}) {
  const values = Object.fromEntries(AXES.map((a) => [a, 50])); // 중간에서 시작
  const prefer = [];
  let novice = null;
  let maxBand = null;
  let answered = 0;

  for (const q of QUESTIONS) {
    const pick = answers[q.id];
    if (pick !== "yes" && pick !== "no") continue; // 건너뛴 문항
    answered++;

    const effect = pick === "yes" ? q.yes : q.no;
    for (const [k, v] of Object.entries(effect || {})) {
      if (AXES.includes(k)) values[k] += v;
      else if (k === "category") prefer.push(v);
      else if (k === "novice") novice = v;
      else if (k === "maxBand") maxBand = v;
    }
  }

  return {
    axes: AXES.map((axis) => ({ axis, value: Math.max(0, Math.min(100, values[axis])) })),
    novice,
    maxBand,
    prefer,
    answered,
  };
}

// 한 줄 요약 — 설정 화면에서 "지금 이렇게 설정되어 있습니다"로 보여 준다
export function describe(profile) {
  if (!profile?.answered) return null;
  const by = Object.fromEntries(profile.axes.map((a) => [a.axis, a.value]));
  const words = [];

  if (by["바디"] >= 65) words.push("묵직한");
  else if (by["바디"] <= 38) words.push("가벼운");
  if (by["탄닌"] >= 65) words.push("탄닌이 있는");
  else if (by["탄닌"] <= 32) words.push("부드러운");
  if (by["당도"] >= 62) words.push("달콤한");
  else if (by["당도"] <= 30) words.push("드라이한");
  if (by["산도"] >= 68) words.push("산뜻한");

  if (!words.length) words.push("무난한");
  return `${words.join(" · ")} 스타일`;
}
