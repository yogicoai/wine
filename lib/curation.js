// 큐레이션 기준 — "가격대별", "초보자용" 같은 묶음을 만들기 위한 값.
//
// 실시간 시세가 아니라 우리가 매긴 대역이다. 시세는 매일 바뀌지만 "이 술은 어느 급인가"는
// 잘 바뀌지 않으므로, 목록을 세우는 데는 대역이 낫다. (실제 최저가는 상세 화면에서 조회한다)

export const PRICE_BANDS = [
  { band: 1, label: "2만원 이하", short: "~2만", note: "부담 없이 자주" },
  { band: 2, label: "2~5만원", short: "2~5만", note: "주말 저녁에" },
  { band: 3, label: "5~10만원", short: "5~10만", note: "좋은 날에" },
  { band: 4, label: "10~30만원", short: "10~30만", note: "특별한 자리" },
  { band: 5, label: "30만원 이상", short: "30만~", note: "기념할 만한 순간" },
];

export function bandOf(n) {
  return PRICE_BANDS.find((b) => b.band === Number(n)) || null;
}

// 주정강화·디저트 술 — 달아서 점수가 잘 나오지만 도수가 높고 무거워 첫 잔에는 맞지 않는다
const HEAVY = /포트|셰리|마데이라|주정강화|아이스와인|디저트 와인|베르무트/;

// 초보자 점수 — 떫음이 적고 과일향이 살아 있으며 값이 부담스럽지 않을수록 높다.
// 직접 매긴 값이 있으면 그것을 쓰고, 없으면 맛 프로필에서 추정한다.
export function beginnerScore(doc) {
  if (typeof doc.beginner === "number") return doc.beginner;

  const axes = Object.fromEntries(
    (doc.result?.tasteProfile || []).map((a) => [a.axis, a.value])
  );
  if (!Object.keys(axes).length) return null;

  const tannin = axes["탄닌"] ?? 40;
  const sweet = axes["당도"] ?? 30;
  const acid = axes["산도"] ?? 55;
  const body = axes["바디"] ?? 55;

  // 떫을수록·시큼할수록 어렵고, 약간의 단맛은 진입장벽을 낮춘다
  let score = 100 - tannin * 0.55 - Math.max(0, acid - 60) * 0.6 + Math.min(sweet, 45) * 0.35;
  // 무거우면 첫 잔으로 버겁다. 단맛만 보고 점수를 주면 포트가 1위가 된다.
  score -= Math.max(0, body - 60) * 0.7;
  if (HEAVY.test(`${doc.result?.type || ""} ${doc.name || ""}`)) score -= 25;
  if (doc.category && doc.category !== "wine") score -= 20; // 증류주는 입문 와인이 아니다
  if (doc.priceBand >= 4) score -= 18; // 비싼 술은 입문용으로 권하지 않는다
  if (doc.priceBand <= 2) score += 6;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export const TAGS = {
  데일리: "부담 없이 자주",
  선물: "선물하기 좋은",
  기념일: "특별한 날",
  파티: "여럿이 모일 때",
  혼술: "혼자 마시기 좋은",
  식사: "밥과 함께",
  숙성: "묵혔다 마시는",
  입문: "처음 마신다면",
};
