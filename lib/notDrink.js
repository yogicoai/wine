// 판매처에서 "와인"으로 검색하면 잔·오프너·식초처럼 술이 아닌 상품이 함께 딸려 온다.
// 이것들이 카탈로그에 쌓이면 검색과 추천에 그대로 섞여 나오므로 들어오기 전에 걸러낸다.
//
// 한글은 \b(단어 경계)가 제대로 동작하지 않는다. "블랙"의 '랙'이 걸리는 식이라
// 조각 단어 대신 앞뒤 맥락을 붙여 쓴다.

// 이 말이 있으면 술일 수 없다.
const NEVER_DRINK = [
  /와인\s*잔|술잔|맥주잔|샴페인\s*잔|버건디\s*잔|디저트\s*잔|막걸리\s*잔|소주잔|물잔|유리컵|고블렛|텀블러|머그/,
  /글라스(?!고)/, // 글라스고(스코틀랜드 지명)는 제외
  /잔\s*\d+\s*[Pp](?![a-z])/, // "와인잔 2P"
  /잔\s*세트|잔세트|잔클리너/,
  /비네가|발사믹|와인\s*식초|와인식초|조리용\s*와인|맛술/,
  /와인\s*오프너|코르크\s*스크류|코르크스크류|와인\s*스토퍼|에어레이터/,
  /와인\s*모형|병\s*장식|라벨\s*스티커|와인\s*냉장고|와인\s*진열/,
  /재배기|제조기|양조기|숙성기|발효기|스테인리스\s*스틸/, // 만드는 장비
];

// 술과 묶어 파는 경우가 있어(위스키+아이스버킷, 포트+디캔터),
// 병 정보가 함께 적혀 있으면 술로 본다.
const USUALLY_TOOL = [
  /디캔터|디켄터/,
  /와인\s*셀러|와인셀러|와인\s*랙|와인랙|와인\s*보관함/,
  /아이스\s*버킷|아이스버킷|와인\s*칠러|와인칠러|보틀\s*쿨러/,
  /병따개|와인\s*코스터|와인\s*캐리어|와인\s*파우치|와인\s*가방/,
];

// 숙성 연수·도수·용량·빈티지 — 실제 병이라는 신호
const BOTTLE_HINT = /\d+\s*년|\d+(\.\d+)?\s*도(?![시자])|\d+\s*ml|\d+\s*mL|\d+\s*L(?![a-z])|빈티지\s*\d{4}/;

/** 술이 아닌 상품으로 보이면 true. 카탈로그에 넣기 전에 거른다. */
export function isNotDrink(name) {
  const n = String(name || "");
  if (!n) return false;
  if (NEVER_DRINK.some((re) => re.test(n))) return true;
  if (USUALLY_TOOL.some((re) => re.test(n))) return !BOTTLE_HINT.test(n);
  return false;
}

/** 걸러낸 이유를 알려 준다 (점검·로그용). 아니면 null. */
export function notDrinkReason(name) {
  const n = String(name || "");
  const hard = NEVER_DRINK.find((re) => re.test(n));
  if (hard) return String(hard);
  const soft = USUALLY_TOOL.find((re) => re.test(n));
  if (soft && !BOTTLE_HINT.test(n)) return String(soft);
  return null;
}
