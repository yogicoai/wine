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
