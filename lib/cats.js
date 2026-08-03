// 12주종 레지스트리 — 카테고리별 라벨/아이콘/섹션명/맛 축
export const CATS = {
  wine: {
    label: "와인",
    icon: "🍷",
    producerLabel: "와이너리",
    axes: ["바디", "탄닌", "산도", "당도"],
  },
  sake: {
    label: "사케",
    icon: "🍶",
    producerLabel: "양조장",
    axes: ["바디", "감칠맛", "산도", "당도"],
  },
  whisky: {
    label: "위스키",
    icon: "🥃",
    producerLabel: "증류소",
    axes: ["바디", "피트", "과일향", "스파이스"],
  },
  traditional: {
    label: "전통주",
    icon: "🏺",
    producerLabel: "양조장",
    axes: ["바디", "감칠맛", "산도", "당도"],
  },
  beer: {
    label: "맥주",
    icon: "🍺",
    producerLabel: "브루어리",
    axes: ["바디", "쓴맛", "홉향", "몰트"],
  },
  brandy: {
    label: "브랜디",
    icon: "🍸",
    producerLabel: "증류소",
    axes: ["바디", "과일향", "오크", "당도"],
  },
  baijiu: {
    label: "백주",
    icon: "🀄",
    producerLabel: "양조장",
    axes: ["바디", "향의 강도", "곡물향", "당도"],
  },
  tequila: {
    label: "데킬라",
    icon: "🌵",
    producerLabel: "증류소",
    axes: ["바디", "아가베", "오크", "스파이스"],
  },
  rum: {
    label: "럼",
    icon: "🏝️",
    producerLabel: "증류소",
    axes: ["바디", "당밀", "오크", "스파이스"],
  },
  gin: {
    label: "진",
    icon: "🌿",
    producerLabel: "증류소",
    axes: ["주니퍼", "시트러스", "허브", "스파이스"],
  },
  soju: {
    label: "소주",
    icon: "🥂",
    producerLabel: "제조사",
    axes: ["바디", "깔끔함", "곡물향", "당도"],
  },
  vodka: {
    label: "보드카",
    icon: "🧊",
    producerLabel: "증류소",
    axes: ["바디", "깔끔함", "곡물향", "스파이스"],
  },
  liqueur: {
    label: "리큐르",
    icon: "🍹",
    producerLabel: "제조사",
    axes: ["바디", "당도", "산도", "향의 강도"],
  },
  highball: {
    label: "하이볼·RTD",
    icon: "🥤",
    producerLabel: "제조사",
    axes: ["바디", "탄산감", "당도", "산미"],
  },
  makgeolli: {
    label: "막걸리",
    icon: "🥛",
    producerLabel: "양조장",
    axes: ["바디", "단맛", "산미", "탄산감"],
  },
  spirits: {
    label: "기타 주류",
    icon: "🍾",
    producerLabel: "제조사",
    axes: ["바디", "향의 강도", "오크", "당도"],
  },
};

export const CATEGORY_KEYS = Object.keys(CATS);

export function catOf(category) {
  return CATS[category] || CATS.spirits;
}

/**
 * 이 주종의 맛 축 네 개.
 *
 * 축이 주종마다 다르다는 것이 이 앱의 전제다 — 위스키에 탄닌을 물을 수 없고
 * 사케에 피트를 물을 수 없다. 그래서 추천의 유사도 계산도 여기서 축을 받아야 한다.
 * 와인 축을 고정으로 쓰면 사케끼리 비교할 때 겹치는 축이 없어 추천이 아예 비어 버린다.
 */
export function axesOf(category) {
  return catOf(category).axes;
}

// AI 가 돌려주는 축 이름은 조금씩 흔들린다 — "타닌"(탄닌), "바디감"(바디),
// "단맛"(당도) 처럼. 표기만 다른 것은 규격 이름으로 되돌리고,
// 표에 없는 축("미네랄감", "알코올감")은 버린다.
const AXIS_ALIAS = {
  타닌: "탄닌", 탄닌감: "탄닌",
  바디감: "바디", 무게감: "바디",
  단맛: "당도", 달콤함: "당도", 스위트: "당도",
  산미: "산도", 신맛: "산도",
  우마미: "감칠맛", 감칠맛도: "감칠맛",
  쓴맛도: "쓴맛", 씁쓸함: "쓴맛",
  홉: "홉향", 홉의향: "홉향",
  피트감: "피트", 스모키: "피트",
  과일: "과일향", 프루티: "과일향",
  스파이시: "스파이스", 향신료: "스파이스",
  오크향: "오크", 나무향: "오크",
  곡물: "곡물향",
  주니퍼향: "주니퍼",
  탄산: "탄산감",
};

/**
 * AI 가 준 맛 축을 이 주종의 규격으로 맞춘다.
 *
 * 축이 어긋나면 그 술은 추천에서 통째로 빠진다 — 유사도는 공통 축이 둘 이상이어야
 * 서기 때문이다. 화면의 레이더도 주종마다 다른 모양으로 그려져 비교가 되지 않는다.
 * 프롬프트로 일러 두었지만 그것만 믿을 수는 없어 받은 뒤에 한 번 더 맞춘다.
 *
 * 값이 없는 축은 채우지 않는다 — 모르는 것을 50 으로 메우면 그럴듯한 거짓이 된다.
 */
export function normalizeTasteProfile(profile, category) {
  const want = axesOf(category);
  if (!Array.isArray(profile) || !profile.length) return profile;

  const got = new Map();
  for (const item of profile) {
    const raw = String(item?.axis || "").trim();
    const axis = AXIS_ALIAS[raw] || raw;
    const value = Number(item?.value);
    if (!axis || !Number.isFinite(value)) continue;
    if (!got.has(axis)) got.set(axis, Math.max(0, Math.min(100, Math.round(value))));
  }

  const out = want.filter((a) => got.has(a)).map((a) => ({ axis: a, value: got.get(a) }));
  // 규격 축을 하나도 못 채웠으면 손대지 않는다. 빈 배열보다 원본이 낫다.
  return out.length >= 2 ? out : profile;
}
