// 판매처에서 "와인"으로 검색하면 잔·오프너·식초처럼 술이 아닌 상품이 함께 딸려 온다.
// 이것들이 카탈로그에 쌓이면 검색과 추천에 그대로 섞여 나오므로 들어오기 전에 걸러낸다.
//
// 한글은 \b(단어 경계)가 제대로 동작하지 않는다. "블랙"의 '랙'이 걸리는 식이라
// 조각 단어 대신 앞뒤 맥락을 붙여 쓴다.

// 이 말이 있으면 술일 수 없다.
const NEVER_DRINK = [
  // 주종 이름 + '잔' 은 모두 잔이다. "안동소주 45도 잔2 보자기"처럼 술에 잔을 끼워
  // 파는 것과 헷갈리지 않게, 주종 이름이 잔에 바로 붙은 형태만 본다.
  /와인\s*잔|술잔|맥주잔|샴페인\s*잔|버건디\s*잔|디저트\s*잔|막걸리\s*잔|소주잔|물잔|유리컵|고블렛|텀블러|머그/,
  /위스키\s*잔|꼬냑\s*잔|코냑\s*잔|브랜디\s*잔|칵테일\s*잔|테이스팅\s*잔|하이볼\s*잔|샷\s*잔|유리잔|투명컵/,
  // 사케 잔과 잔 브랜드 — "리델 비늄 다이긴조"처럼 술 이름을 달고 있어 눈에 잘 띄지 않는다.
  // 브랜드 이름 앞에 한글이 붙어 있으면 낱말의 일부다 — 바하우의 밭 "싱어리델"이
  // 잔 브랜드 "리델"에 걸리면 멀쩡한 리슬링이 지워진다.
  /사케\s*잔|사기잔|막사발|리큐어\s*잔|우스하리|도쿠리\s*잔|오초코\s*잔/,
  /(?<![가-힣])(리델|비늄|비넘|쇼트\s*즈위젤|슈피겔라우|보르미올리)/,
  /글라스(?!고)|글래스/, // 글라스고(스코틀랜드 지명)는 제외
  /잔\s*\d+\s*[Pp](?![a-z])/, // "와인잔 2P"
  /잔\s*세트|잔세트|잔클리너|전용\s*잔/,
  // 술 이름을 그대로 달고 파는 기념품·잡화. 라벨만 빌려 쓴 물건이라 술이 아니다.
  /공병|빈병|캔들|마그넷|냉장고\s*자석|인테리어\s*소품|포스터|미니어처\s*모형/,
  /올리브\s*오일|식용유|참기름|들기름|드레싱/,
  /비네가|발사믹|와인\s*식초|와인식초|조리용\s*와인|맛술/,
  /와인\s*오프너|코르크\s*스크류|코르크스크류|와인\s*스토퍼|에어레이터/,
  /와인\s*모형|병\s*장식|라벨\s*스티커|와인\s*냉장고|와인\s*진열/,
  /재배기|제조기|양조기|숙성기|발효기|스테인리스\s*스틸/, // 만드는 장비

  // 산지 이름으로 검색하면 그 고장의 숙소와 여행 상품이 딸려 온다.
  // "빌라"는 빌라 마리아·빌라 산디 같은 와이너리 이름이라 쓰지 않는다.
  // 끝에 붙은 "BB"는 민박 표기다. 위스키 병입사 "BB&R"과 헷갈리지 않게 끝자리만 본다.
  /아파트먼트|아파트\b|게스트\s*하우스|펜션|리조트|민박|숙소|아그리투리스모|와인\s*호텔|B&B\b|\sBB\s*$/,
  /여행\s*\d+일|자유여행|패키지\s*여행|하나투어|모두투어|항공권|숙박권|입장권|렌터카/,

  // 산지·품종 이름이 옷과 신발 색 이름으로도 쓰인다 (보르도 스니커즈, 로제 반팔 티)
  /스니커즈|트레이너스|운동화|구두|핸드백|호보백|숄더백|백팩|파우치백/,
  /반팔|긴팔|민소매|티셔츠|원피스|자켓|재킷|스웨이드|니트|가디건|블라우스/,
];

// 술과 묶어 파는 경우가 있어(위스키+아이스버킷, 포트+디캔터),
// 병 정보가 함께 적혀 있으면 술로 본다.
const USUALLY_TOOL = [
  /디캔터|디켄터/,
  /와인\s*셀러|와인셀러|와인\s*랙|와인랙|와인\s*보관함/,
  /아이스\s*버킷|아이스버킷|와인\s*칠러|와인칠러|보틀\s*쿨러|와인쿨러|아이스\s*쿨러/,
  /병따개|와인\s*코스터|와인\s*캐리어|와인\s*파우치|와인\s*가방/,
];

// 숙성 연수·도수·용량·빈티지·한정판 — 실제 병이라는 신호.
// "뵈브 클리코 로제 쿨러 에디션"처럼 병에 보냉 커버를 씌워 파는 것이 있다.
const BOTTLE_HINT =
  /\d+\s*년|\d+(\.\d+)?\s*도(?![시자])|\d+\s*ml|\d+\s*mL|\d+\s*L(?![a-z])|빈티지\s*\d{4}|에디션|한정판/;

// 국내 판매처의 술 상품명에는 거의 언제나 한글이 섞인다.
// 한글이 한 자도 없으면 해외 브랜드 검색에 딸려 온 옷·가구·잡화일 확률이 높다.
// 그래서 이 경우에만 "술이라는 증거"를 요구한다.
const LATIN_DRINK =
  /\b(wine|wein|vino|vinho|vin|whisky|whiskey|bourbon|scotch|gin|rum|vodka|cognac|brandy|champagne|prosecco|cava|sake|tequila|mezcal|port|sherry|beer|ale|lager|ipa|stout|riesling|chardonnay|malbec|cabernet|merlot|pinot|sauvignon|syrah|shiraz|zinfandel|sangiovese|nebbiolo|tempranillo|grenache|albari[nñ]o|rioja|chianti|barolo|brunello|amarone|rias|magnum|brut|igt|doc|docg|aoc|grand\s*cru)\b/i;
// 옷·가구·잡화에서 자주 보이는 말. 위 단어가 함께 있어도 이쪽이 이긴다.
const LATIN_GOODS =
  /\b(bag|pot|settee|sofa|armchair|ottoman|sneakers?|gilet|shoulder|handbag|shoes?|boots?|sandals?|dress|shirt|knit|cardigan|jacket|coat|sunglasses)\b/i;
// 옷 시즌 코드(25FW, 25 SS)와 신발 치수(EU 42, 265mm)
const FASHION_CODE = /\b\d{2}\s?(FW|SS|AW)\b|\bEU\s*\d{2}\b|\b\d{3}\s*mm\b/i;

/** 술이 아닌 상품으로 보이면 true. 카탈로그에 넣기 전에 거른다. */
export function isNotDrink(name) {
  const n = String(name || "");
  if (!n) return false;
  if (NEVER_DRINK.some((re) => re.test(n))) return true;
  if (USUALLY_TOOL.some((re) => re.test(n))) return !BOTTLE_HINT.test(n);

  if (FASHION_CODE.test(n)) return true;
  if (LATIN_GOODS.test(n)) return true;
  // 한글이 없고 술이라는 말도 없고 빈티지 연도도 없으면 술로 보지 않는다
  if (!/[가-힣]/.test(n) && !LATIN_DRINK.test(n) && !/\b(19|20)\d{2}\b/.test(n)) return true;

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
