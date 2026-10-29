// 데일리샷 — 국내 주류 가격의 자체 색인.
//
// 왜 이걸 쓰는가.
// 네이버 쇼핑 API 가 2026-07-31 에 닫힌 뒤 값을 얻을 곳이 다나와뿐이었는데,
// 다나와는 위스키 말고는 못 쓴다 (lib/danawa.js 에 실측을 적어 두었다).
// 특히 와인이 0 이었고, "사고 싶은 술을 담아 두면 값이 떨어질 때 알려 준다"는
// 이 앱의 처음 목표 하나가 값 없이는 성립하지 않았다.
//
// 데일리샷은 전국 매장의 스마트오더 값을 모아 놓은 곳이고, 상품 하나에
// 대표가 · 전국 최저가 · 최고가 · 파는 곳 수까지 들어 있다. 여섯 주종을 모두
// 다룬다 — 무작위 표본에서 와인 13 · 위스키 7 · 사케 6 · 우리술 4 · 맥주 2.
//
// 값을 실시간으로 물어보지 않는다. scripts/dailyshot-index.mjs 가 미리 담아 둔
// 색인을 읽는다. 화면이 뜰 때마다 남의 서버를 두드리지 않기 위해서고, 그래야
// 값 이력이 쌓여 "지난달보다 얼마나 싼가"를 말할 수 있다.

import { getDb } from "./mongodb.js";
import { tokenize, isWeakToken, isDroppableToken, conflictsWith, unfortis } from "./match.js";
import ALIAS_TABLE from "../data/dailyshot-alias.json" with { type: "json" };

/** 표를 찾을 때 쓰는 열쇠 — 띄어쓰기·괄호·대소문자 차이를 흡수한다 */
function aliasKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]/g, "");
}

const ALIAS = new Map(
  Object.entries(ALIAS_TABLE || {}).map(([k, v]) => [aliasKey(k), v])
);

/**
 * 값을 붙이지 않기로 못 박은 술 — 표에 null 로 적는다.
 *
 * 붙은 쌍을 눈으로 훑다 찾은 것들이다. 데일리샷에 그 병이 없는데 이름이 닮은
 * 다른 병이 대신 붙는 경우로, 규칙으로 막을 수 없는 한 건짜리다.
 *   1983 올드 그랜드 대드 → 올드 그랜드 대드 114   (현행 114 프루프 값)
 *   윈저 12년 → 윈저 W 시그니처 12년               (그쪽은 500ml 만 판다)
 * 틀린 값이 뜨느니 값이 안 뜨는 편이 낫다 — 알림이 걸린 자리라서다.
 */
export function isBlocked(name) {
  return ALIAS.get(aliasKey(name)) === null;
}

/**
 * 숙성 통 종류 — 셰리 · 버번 · 럼 · 포트 · 마데이라 · 코냑.
 *
 * 이 말들은 약한 낱말로 분류되어 후보에 없어도, 달라도 통과했다. 그런데 같은 술이
 * 통만 바꿔 따로 나오는 일이 흔하고 값도 다르다.
 *   시바스 리갈 엑스트라 13년 올로로소 셰리 캐스크 → … 13년 버번 캐스크
 *   웨스트콕 블렌디드 버번 캐스크 → 웨스트콕 셰리 캐스크 피니시 (그쪽에 정확한 것이 있는데도)
 *   오마르 싱글몰트 셰리 타입 → 오마르 싱글몰트 버번 타입
 * 양쪽이 모두 통을 말하는데 겹치는 것이 하나도 없으면 다른 술이다. 한쪽만 말하는
 * 경우는 그냥 둔다 — 상품명이 통을 생략하는 일은 흔하다 (품종 대조와 같은 규칙).
 */
const CASK_KINDS = [
  ["셰리", /셰리|쉐리|올로로[소쏘]|페드로\s*히메네스|\bPX\b/i],
  ["버번", /버번|버본|bourbon/i],
  ["럼", /(?<![가-힣])럼(?![가-힣])/],
  ["포트", /포트\s*(캐스크|피니시|우드)|루비\s*포트/],
  ["마데이라", /마데이라/],
  ["코냑", /코냑|꼬냑/],
];
function caskSet(text) {
  const s = String(text || "");
  return new Set(CASK_KINDS.filter(([, re]) => re.test(s)).map(([k]) => k));
}

/**
 * 한 글자 낱말이 병을 가르는 경우 — 계절(춘·하·추·동)과 색(백·홍·청·황·흑).
 *
 * 토크나이저는 한 글자 낱말을 버린다. 그래서 두 병이 같은 이름으로 보인다.
 *   풍정사계 춘 → 풍정사계 동     데일리샷에 "풍정사계 춘" 39,000 원이 있는데도
 *   추사 40     → 추사 백 40      정상 상품 "추사 40% 500ml" 66,900 원의 절반 값
 * 계절은 양쪽이 모두 말하는데 겹치지 않을 때, 색은 그쪽에만 있고 우리 이름에
 * (붙여 쓴 것까지 포함해) 없을 때 다른 병이다. "추사백"처럼 붙여 쓴 우리 이름은
 * 색이 이름 안에 들어 있으므로 통과한다.
 */
const SEASON_WORD = /(?<![가-힣])[춘하추동](?![가-힣])/g;
const COLOR_WORD = /(?<![가-힣])[백홍청황흑](?![가-힣])/g;
function syllableConflict(ours, theirs) {
  const o = new Set(String(ours).match(SEASON_WORD) || []);
  const t = new Set(String(theirs).match(SEASON_WORD) || []);
  if (o.size && t.size && ![...o].some((s) => t.has(s))) return true;
  const flatOurs = String(ours).replace(/[^가-힣]/g, "");
  for (const w of new Set(String(theirs).match(COLOR_WORD) || [])) {
    if (!flatOurs.includes(w)) return true;
  }
  return false;
}

/**
 * 우리 주종 → 데일리샷 주종.
 *
 * 데일리샷은 진·보드카·데킬라를 "기타"에 몰아 넣어 두었다. 그래서 스피리츠
 * 계열은 큰 분류만으로는 갈리지 않고 세부 분류까지 봐야 한다.
 */
const CATEGORY_MAP = {
  // also — 여기서 못 찾았을 때 한 번 더 볼 곳.
  //
  // 우리 분류와 데일리샷의 분류가 늘 같지 않다. 국산 과실주가 그렇다 —
  // "264 청포도 와인"을 우리는 와인으로 두었는데 그쪽은 우리술에 넣어 두었다.
  // 이름 대조가 엄격하므로 볼 곳을 늘려도 엉뚱한 것이 붙지는 않는다.
  wine: { top: ["와인"], also: ["우리술", "리큐르", "기타"] },
  sake: { top: ["사케"], also: ["우리술", "기타"] },
  // 맥주가 "기타"에 들어가 있는 경우가 잦다 — 필굿·칭따오가 그렇다.
  beer: { top: ["맥주"], also: ["기타"] },
  whisky: { top: ["위스키"], also: ["기타"] },
  traditional: { top: ["우리술"], also: ["와인", "리큐르", "기타"] },
  makgeolli: { top: ["우리술"] },
  soju: { top: ["우리술"], also: ["기타"] },
  brandy: { top: ["브랜디"], also: ["기타"] },
  rum: { top: ["럼"], also: ["기타"] },
  baijiu: { top: ["백주"], also: ["기타"] },
  liqueur: { top: ["리큐르"], also: ["기타", "우리술"] },
  gin: { top: ["기타"], sub: ["진"] },
  vodka: { top: ["기타"], sub: ["보드카"] },
  tequila: { top: ["기타"], sub: ["데킬라", "메즈칼"] },
  highball: { top: ["기타"], sub: ["하이볼"] },
  spirits: { top: ["기타", "럼", "브랜디", "리큐르", "백주"] },
};

/**
 * 이름에 붙는 장사 표시 — 대조 전에 떼어 낸다.
 *
 * 데일리샷의 이름은 앞에 대괄호로 붙는 것이 많다. [2023] 은 빈티지라 뜻이
 * 있지만 [마감] · [마지막 특가] · [4개 11,000원] 은 값과 재고 사정일 뿐이라
 * 그대로 두면 대조가 어긋난다.
 */
const PROMO = /\[[^\]]*\]/g;
// 끝에 붙는 용량 — 우리 카탈로그 이름에는 없다
const VOLUME_TAIL = /\s*\d+(\.\d+)?\s*(ml|l|리터|L)\s*$/i;

/**
 * 병당 값이 아닌 것 — 세트 · 묶음 · 미니어처 · 시음권.
 *
 * "화요 17, 25, 41 375ml 3종 59,000원"을 화요 17 의 값으로 쓰면 세 배를
 * 부풀린다. 목표가 알림이 걸린 자리라 틀린 값 하나가 오알림이 된다.
 */
const BUNDLE = /(\d+\s*(종|캔|병|개|팩)\s*(세트|기획|묶음)?|[x×]\s*\d+\s*$|세트|기획전|홈파티|키트|미니어처|시음권|증정|패키지|바이알|샘플)/;

/**
 * 이름 하나에 술이 둘 — "투핸즈 날리 듀즈 쉬라즈 & 투핸즈 엔젤스 쉐어 쉬라즈".
 *
 * 세트라는 말이 없어 BUNDLE 로는 안 걸리는데, 값은 둘을 합친 값이다.
 * 실제로 이것 하나가 "30 마일 쉬라즈" · "K1 쉬라즈" · "Panchkula 호텔 쉬라즈"에
 * 전부 붙었다 — 이름이 길어 아무 쉬라즈나 걸리는 그물이 된다.
 */
// 한글 사이의 + 도 센다. "셀렉트+포 로지스 싱글배럴+포 로지스"는 공백 없이 이어 붙은
// 세 병 세트인데, 위 두 모양에 안 걸려 잭 다니엘스 낱병 값 82,000 원이 붙어 있었다.
// 공백이 앞에만 있는 모양도 센다 — "복순도가 손막걸리 +빨간쌀 막걸리"는 두 병 세트인데
// 앞 규칙들에 안 걸려 손막걸리 낱병 값 13,400 원이 붙어 있었다.
const TWO_DRINKS = /\s[&+]\s|\s\+\d|[가-힣]\+[가-힣]|\s\+[가-힣A-Za-z]/;

/**
 * 대괄호 안에 여러 병을 적어 둔 것 — "[오크46/마한48도.24도포함] 마한 오크 46%".
 *
 * 딱지를 떼고 나면 "마한 오크 46%" 한 병처럼 보이는데 값은 세 병을 합친
 * 100,000 원이다. 마한은 낱병이 17,000~30,000 원이다. "포함"만으로 거르면
 * "박스 포함" 같은 멀쩡한 것까지 잃으므로, 빗금이나 더하기로 여러 개를
 * 나열한 딱지만 본다.
 */
const BRACKET_SET = /\[[^\]]*[/+][^\]]*(포함|세트|구성)[^\]]*\]|\[[^\]]*(포함|세트|구성)[^\]]*[/+][^\]]*\]/;

/** 대조에 쓸 이름으로 다듬는다 */
export function cleanName(raw) {
  return String(raw || "")
    .replace(PROMO, " ")
    .replace(VOLUME_TAIL, " ")
    // 도수는 이름이 아니다. 두고 보면 "라프로익 10년 40%"의 40 이 낱말로 잡혀
    // 우리 이름에 없는 군더더기로 세어진다.
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 우리 이름과 파는 쪽 이름이 어긋나는 자리를 맞춰 준다.
 *
 * 셋 다 실제로 값을 못 찾게 만들던 것들이다.
 *
 *   짐빔 화이트 40도      끝의 도수가 검색어를 망친다. 이 말로 찾으면
 *                        세트 두 개만 나오고 낱병은 안 나온다
 *   산토리 야마자키 12년   데일리샷에는 "야마자키 12년" 40만 원이 첫 줄에
 *                        있는데 우리가 붙인 "산토리"가 없다고 버려진다
 *   놉 크릭 9년           그쪽 표기는 "납 크릭"이다. 한 글자가 달라 못 만난다
 *
 * 도수를 떼는 것은 우리 술에는 하면 안 된다. 마한 24 와 마한 48 은 도수가
 * 곧 이름이라 떼면 두 술이 한 술이 된다. 그래서 주종을 보고 정한다.
 */
const DEGREE_TAIL = /\s\d+(\.\d+)?\s*도(?=\s|$)/g;

/** 파는 쪽이 만드는 집 이름을 안 붙이는 술들 — 붙은 채로 찾으면 못 만난다 */
const MAKER_PREFIX =
  /^(산토리|니카|디아지오|페르노리카|발렌타인즈)\s+(?=야마자키|하쿠슈|치타|토키|가쿠빈|카쿠빈|요이치|미야기쿄|타케츠루|코페이|프롬)/;

/**
 * 표기가 굳어 버린 자리 — 어느 쪽이 맞고 틀리고가 아니라 그냥 다르다.
 *
 * 전부 데일리샷에서 그 이름으로 파는 것을 확인하고 적었다. 짐작으로 넣으면
 * 없는 술에 값이 붙는다. scripts/_probe-miss.mjs 가 그 확인을 한다.
 *
 * 띄어쓰기가 다른 것이 특히 많다. matchIn 은 띄어쓰기를 지운 이름 안에서
 * 한 번 더 찾아 주지만 세 글자부터만 본다 — "로얄"·"몽키" 같은 두 글자는
 * 그 그물에 안 걸려서 여기서 맞춰 줘야 한다.
 */
const SPELLING = [
  [/놉\s*크릭/g, "납 크릭"],
  [/미크터스\s*US\s*1/gi, "믹터스 US*1"],
  [/미크터스/g, "믹터스"],
  [/엘라이자\s*크레이그/g, "일라이저 크레이그"],
  [/러셀스\s*리저브/g, "러셀 리저브"],
  [/우가[다달]일?/g, "우거다일"],
  [/코리브레칸/g, "코리브라칸"],
  // 닛카는 우리가 "니카 요이치"로 적고 그쪽은 "닛카 싱글몰트 요이치"로 적는다.
  // 낱말 차례까지 다르므로 통째로 바꿔 준다.
  [/(니카|닛카)?\s*요이치\s*싱글\s*몰트|요이치\s*싱글\s*몰트/g, "닛카 싱글몰트 요이치"],
  [/(니카|닛카)?\s*미야기쿄\s*싱글\s*몰트|미야기쿄\s*싱글\s*몰트/g, "닛카 싱글몰트 미야기쿄"],
  [/니카/g, "닛카"],
  [/와일드터키/g, "와일드 터키"],
  [/와일드\s*터키\s*101\s*NAS/gi, "와일드 터키 101"],
  [/스토크\s*라이\s*몰트/g, "스토크 클럽 라이 몰트"],
  [/틸링\s*싱글몰트(?!\s*(30년|아이리시))/g, "틸링 싱글몰트 아이리시"],
  // 사케 등급말은 그쪽 표기가 우리와 다르고, 되풀이되므로 규칙으로 둔다.
  // 판정에서 하나씩 올라온 것들인데(마스이즈미·하쿠라쿠세이·심백·산젠…)
  // 표로 넣으면 같은 고침을 수십 번 적게 된다. 조/죠 · 키/기 · 도/토가 갈린다.
  [/준마이\s*다이긴[조죠]/g, "준마이 다이긴죠"],
  [/준마이\s*긴[조죠]/g, "준마이 긴죠"],
  [/(?<!준마이\s)다이긴조/g, "다이긴죠"],
  [/(?<!준마이\s)(?<!다이)긴조/g, "긴죠"],
  [/혼[조죠][조죠]/g, "혼죠조"],
  [/키모토/g, "기모토"],
  [/도쿠베츠/g, "토쿠베츠"],
  [/특별\s*준마이/g, "토쿠베츠 준마이"],
  [/키자쿠라/g, "기자쿠라"],
  [/후쿠주/g, "후쿠쥬"],
  // 조니워커 블랙은 12년짜리인데 그쪽 이름에는 연수를 안 적는다.
  // 라벨을 떼는 규칙보다 먼저 오므로 "블랙라벨"도 함께 본다.
  [/조니워커\s*블랙(라벨)?\s*12년/g, "조니워커 블랙"],
  // 잭다니엘의 기본 병 이름이다. 그쪽은 그냥 "잭 다니엘스"로 판다.
  [/\s*Old\s*No\.?\s*7/gi, ""],
  [/쿼터캐스트/g, "쿼터 캐스크"],
  [/커티삭/g, "커티 삭"],
  [/(레드|블랙|블루|그린|골드|블론드)\s*라벨/g, "$1"],
  // 띄어쓰기만 다른 것들
  [/몽키\s+숄더/g, "몽키숄더"],
  [/로얄\s+살루트/g, "로얄살루트"],
  [/레드브레스트/g, "레드 브레스트"],
  [/비비앤알/g, "BB&R"],
  [/맥캘란\s*클래식컷/g, "맥캘란 클래식 컷"],
  [/이글\s+레어/g, "이글레어"],
  [/폴\s+존/g, "폴존"],
  [/화이트헤더/g, "화이트 헤더"],
  [/킬호만\s*마키어베이/g, "킬호만 마키어 베이"],
  // 낱말이 다른 것들
  [/화이트호스/g, "화이트 홀스"],
  [/클라이넬리시/g, "크라이넬리쉬"],
  [/[엘일]라이자\s*크레이그/g, "일라이저 크레이그"],
  // 잭다니엘은 그쪽이 "잭 다니엘스"로 적는다. 테네시라는 갈래말은 그쪽
  // 이름에 없어서 우리 쪽에만 있는 군더더기가 된다 — 붙여 두면 못 찾는다.
  [/잭\s*다니엘(스)?\s*테네시/g, "잭 다니엘스"],
  [/^젠틀맨\s*잭/g, "잭 다니엘스 젠틀맨 잭"],
  [/잭\s*다니엘(?!스)/g, "잭 다니엘스"],
  [/카리비안/g, "캐리비안"],
  [/레어\s*매리지/g, "레어 메리지"],
  [/리뎀션\s*버번위스키/g, "리뎀션 버번"],
  [/로즈빌\s*마스터\s*크래프티드/g, "로즈빌 유니온 마스터 크래프트"],
  [/그린\s*레이블/g, "조니워커 그린"],
];

/**
 * 영문으로 들어온 이름 — 우리 카탈로그에 몇 개 섞여 있다.
 *
 * 데일리샷은 전부 한글로 판다. "Springbank 10 Year Old"로 찾으면 아무것도
 * 안 나오지만 "스프링뱅크 10년"에는 380,000원짜리가 있다.
 */
const EN_BRAND = [
  [/glenfiddich/gi, "글렌피딕"],
  [/johnnie\s*walker/gi, "조니워커"],
  [/royal\s*salute/gi, "로얄살루트"],
  [/springbank/gi, "스프링뱅크"],
  [/macallan/gi, "맥캘란"],
  [/balvenie/gi, "발베니"],
  [/glenlivet/gi, "글렌리벳"],
  [/laphroaig/gi, "라프로익"],
  [/ardbeg/gi, "아드벡"],
  [/chivas\s*regal/gi, "시바스 리갈"],
];

/** 값을 찾을 때 쓸 이름 — 대조에도 이 이름을 쓴다 */
export function searchName(name, category) {
  // 손으로 확인해 둔 이름이 있으면 그것이 먼저다.
  //
  // 규칙(SPELLING)은 되풀이되는 어긋남을 잡는다 — 잭 다니엘 → 잭 다니엘스처럼
  // 한 줄이 여러 병을 고치는 자리다. 그런데 어긋남의 대부분은 되풀이되지 않는다.
  // "복순도가 손막걸리"를 그쪽이 "복순도가 손 막걸리"로 적는 식이고, 이런 것은
  // 수천 건이라 정규식으로 넣을 수 없다. 그래서 표로 따로 둔다.
  //
  // 표에 넣는 것은 데일리샷에서 그 이름으로 파는 것을 확인한 것만이다.
  // 짐작으로 넣으면 없는 술에 값이 붙는다 — 로얄 살루트가 그렇게 11만 원 비싼
  // 다른 병에 붙어 있었다.
  const fixed = ALIAS.get(aliasKey(name));
  if (fixed) return fixed;

  let s = String(name || "");
  // 영문 이름이면 상표를 한글로 바꾸고 "10 Year Old"를 "10년"으로 적는다.
  // 남는 Whisky · Blended 같은 갈래말은 떼야 한다 — 그쪽 이름에는 없어서
  // 우리 쪽에만 있는 군더더기가 되고, 그러면 못 찾는다.
  if (/[A-Za-z]{3}/.test(s)) {
    for (const [re, to] of EN_BRAND) s = s.replace(re, to);
    s = s
      .replace(/(\d+)[\s-]*Year[\s-]*Old/gi, "$1년")
      .replace(/\b(whisky|whiskey|blended|single\s*malt|scotch)\b/gi, " ");
  }
  for (const [re, to] of SPELLING) s = s.replace(re, to);
  s = s.replace(MAKER_PREFIX, "");
  if (!KOREAN.has(category)) s = s.replace(DEGREE_TAIL, " ");
  return s.replace(/\s+/g, " ").trim() || String(name || "");
}

/** "750ml" · "1.75L" → 밀리리터 숫자 */
export function mlOf(text) {
  const s = String(text || "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(ml|l|리터)(?![a-z가-힣])/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return /^(l|리터)$/i.test(m[2]) ? Math.round(n * 1000) : Math.round(n);
}

/**
 * 사케 등급 · 맥주 스타일 — 같은 집에서 나오는 다른 술을 가르는 말.
 *
 * 이 말들은 수백 종이 함께 쓰기 때문에 lib/match.js 에서 약한 낱말로 분류된다.
 * 이름을 맞히는 데는 그것이 옳지만 값에서는 반대다 — 사케의 등급은 병마다
 * 찍혀 나오는 가격표나 다름없어서, 준마이와 준마이 다이긴조는 값이 배로 갈린다.
 * 실제로 느슨하게 두었더니 아카부 준마이 다이긴조에 아카부 준마이 값이,
 * 월계관 준마이에 월계관 준마이 다이긴죠 값이 붙었다.
 */
const SAKE_GRADE = ["다이긴조", "긴조", "준마이", "혼조조", "도쿠베츠"];
const BEER_STYLE = ["ipa", "라거", "에일", "스타우트", "포터", "필스너", "바이젠", "바이스", "사워"];
// 우리 술은 이 말이 곧 술의 종류다 — 미미옥 막걸리(13,900)와 미미옥 약주(18,900)는
// 이름이 한 낱말만 다르고 값이 다르다. 긴 말부터 봐야 "생막걸리"가 "막걸리"로 샌다.
const KOREAN_KIND = ["막걸리", "탁주", "동동주", "약주", "청주", "증류", "소주"];
const KOREAN = new Set(["traditional", "makgeolli", "soju"]);

/**
 * 품종·색 — 붙여 쓴 이름까지 잡아 낸다.
 *
 * lib/match.js 의 대조는 낱말 단위라 "소비뇽블랑"처럼 붙여 쓴 것을 하나의
 * 낯선 낱말로 본다. 그래서 "티키 싱글빈야드 소비뇽블랑"에 "티키 싱글 빈야드
 * 리슬링"이 붙었다. 품종이 다르면 다른 술인데 그 신호를 놓친 것이다.
 *
 * 낱말이 아니라 글자열에서 찾는다. 같은 품종의 다른 표기는 한 줄에 묶는다 —
 * 쉬라와 시라는 같은 포도다.
 */
const VARIETY = [
  ["시라", "시라즈", "쉬라", "쉬라즈"],
  ["카베르네"], ["소비뇽"], ["메를로", "메를롯"], ["피노"], ["누아", "누와"],
  ["샤르도네", "샤도네", "샤르도내"], ["리슬링"], ["말벡"], ["진판델"],
  ["산지오베제"], ["네비올로"], ["템프라니요"], ["그르나슈", "그르나쉬"],
  ["카르메네르"], ["모스카토"], ["세미용"], ["비오니에"], ["슈냉"], ["가메"],
  ["그리지오", "그리조"], ["비앙코"], ["로쏘"], ["블랑"],
];

/** 이 이름이 말하는 품종·색의 묶음 */
function varieties(text) {
  // 까베르네 → 카베르네. 된소리 표기를 한쪽으로 모아 놓고 본다.
  const flat = unfortis(String(text || "").toLowerCase()).replace(/\s/g, "");
  const out = new Set();
  VARIETY.forEach((group, i) => {
    if (group.some((w) => flat.includes(w))) out.add(i);
  });
  return out;
}

/** 도수 — "40%" · "11.5%" · "40도" */
function abvOf(text) {
  // 우리 술은 도수를 "도"로 적는 일이 많다 (안동소주 일품 40도).
  // 숫자가 바로 앞에 있어야 도수다 — 온도·정도의 "도"에 걸리지 않게 한다.
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:%|도(?![수가-힣]))/);
  return m ? Number(m[1]) : null;
}

/**
 * 믿을 수 있는 최저가.
 *
 * 데일리샷의 최저가는 그 상품을 파는 전국 매장을 모은 값인데, 거기에 30ml
 * 바이알과 시음권이 섞여 들어오는 경우가 있다. 그러면 병값 자리에 잔값이 앉는다.
 *   글렌피딕 그랑 크루 23년   대표 590,000  최저  30,000  (267곳)
 *   조니워커 킹 조지 5세      대표 950,000  최저     100  (143곳)
 *
 * 전체의 0.5% 뿐이지만 목표가 알림이 걸리는 자리라 그냥 둘 수 없다. 대표가의
 * 3할에도 못 미치는 최저가는 병값이 아니라고 보고 대표가를 쓴다. 값을 높게
 * 잡는 쪽이라 알림이 덜 울릴 뿐, 헛알림은 나지 않는다.
 */
function trustedLow(d) {
  // 판매처 API 로 직접 받은 값(lowAt 이 찍혀 있다)은 매장 픽업만 골라 낸 것이라
  // 섞일 것이 없다. 방어막은 옛 방식으로 받아 둔 값에만 건다.
  if (d.lowAt) return d.low || d.price || null;
  if (!d.low || !d.price) return d.low || d.price || null;
  return d.low < d.price * 0.3 ? d.price : d.low;
}

// 긴죠·긴조처럼 같은 말이 두 표기로 온다. 한쪽으로 모아 놓고 본다.
function jp(text) {
  return String(text || "").replace(/죠/g, "조").replace(/쥬/g, "주");
}

function gradeSet(text, words) {
  const s = jp(text).toLowerCase();
  // 다이긴조가 있으면 긴조도 문자열에 들어 있다. 긴 것부터 보고 지워 가며 센다.
  const out = new Set();
  let rest = s;
  for (const w of words) {
    if (rest.includes(w)) {
      out.add(w);
      rest = rest.split(w).join(" ");
    }
  }
  return out;
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * 이름에 박힌 구분 숫자 — "배치 3" · "No.5" · "타입 23".
 *
 * 토큰으로는 잡히지 않는다. 한 자리 숫자는 토큰에서 떨어져 나가기 때문이다.
 * 그래서 맥캘란 에디션 No.5 에 No.1 값이, 라세이 배치 3 에 배치 2 값이 붙었다.
 * 연도 · 도수 · 용량은 구분 숫자가 아니므로 먼저 지운다.
 */
function marks(text, { keepYears = false } = {}) {
  let s = String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|리터)(?![a-z가-힣])/gi, " ");
  // 네 자리 숫자는 대개 빈티지라 지우는 것이 맞지만, 이름의 일부일 때도 있다 —
  // 한라산 1950 · 진로 1924 가 그렇다. 특정할 낱말이 하나뿐인 자리에서는
  // 그 숫자가 유일한 구분 표시이므로 남긴다.
  if (!keepYears) s = s.replace(/\b(19|20)\d{2}\b/g, " ");
  return new Set((s.match(/\d+/g) || []).map((n) => String(Number(n))));
}

/**
 * 이름에 든 모든 숫자 — 도수 표기 안에 든 것까지 포함한다.
 *
 * "마한 48%"의 48 은 도수이자 이름이라 어느 쪽으로도 찾을 수 있어야 한다.
 * 용량만 뺀다. 750 이 이름의 일부인 술은 없다.
 *
 * 색인과 검색 결과가 이것을 함께 써야 한다. 검색 쪽에만 없었더니
 * matchIn 이 r.nums 를 읽다 터졌고, searchAndMatch 의 try/catch 가 그것을
 * 삼켜 "못 찾음"으로 보였다 — 숫자가 든 이름은 검색으로 영영 안 붙었다.
 */
function numsOf(name) {
  const s = String(name || "").replace(/\d+(\.\d+)?\s*(ml|l|리터)(?![a-z가-힣])/gi, " ");
  return new Set((s.match(/\d+/g) || []).map((n) => String(Number(n))));
}

/**
 * 이름에 든 출시 연도 · 빈티지 — 1980~2039 만 본다.
 *
 * 750 이나 12 는 연도가 아니고, 1978 이나 2023 은 연도다. 이 숫자가 다르면
 * 같은 줄의 다른 해이고 값도 다르다.
 */
function yearsOf(name) {
  const m = String(name || "").match(/\b(19[89]\d|20[0-3]\d)\b/g) || [];
  return new Set(m);
}

// ── 색인 ────────────────────────────────────────────────

// 주종별로 한 번 읽어 두고 6시간 쓴다. 25,000건을 매번 읽으면 화면이 느려지고,
// 값은 하루 한 번 갱신되므로 그보다 자주 읽을 이유가 없다.
const TTL = 6 * 60 * 60 * 1000;
const cache = new Map(); // 주종 → { at, rows }

async function index(category, { wide = false } = {}) {
  const map = CATEGORY_MAP[category];
  if (!map) return [];

  const key = wide ? `${category}+` : category;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const db = await getDb();
  if (!db) return [];

  const tops = wide && map.also ? [...map.top, ...map.also] : map.top;
  // 최저가가 아직 없는 것도 담는다. 목록 API 는 대표가만 주고, 최저가는 사람이
  // 그 술을 열어 볼 때 판매처에 물어 채운다. 여기서 걸러 버리면 아직 아무도
  // 안 열어 본 술은 영영 이름조차 맞춰 볼 수 없다.
  const q = { category: { $in: tops }, $or: [{ low: { $gt: 0 } }, { price: { $gt: 0 } }] };
  if (map.sub && !wide) q.subcategory = { $in: map.sub };

  const docs = await db
    .collection("dailyshot")
    .find(q, {
      projection: {
        _id: 0, id: 1, itemId: 1, name: 1, nameEn: 1, volume: 1, abv: 1,
        price: 1, low: 1, lowAt: 1, high: 1, sellers: 1, url: 1, image: 1, rating: 1, reviews: 1,
        history: 1,
        // 최저가를 파는 매장 — 없으면 반나절 캐시로 답할 때 그 자리가 빈다
        lowSeller: 1, lowRegion: 1,
        // 보통 가격(가운데 값) · 몰린 만원대 · 뺀 튀는 값 수(2026-10-29)
        mid: 1, midBand: 1, midBandCount: 1, lowOutliers: 1,
      },
    })
    .toArray();

  // 세트·묶음은 병당 값이 아니라 여기서 버린다. 값을 못 찾는 것보다 틀린 값이 나쁘다.
  const rows = docs
    .filter((d) => !BUNDLE.test(d.name) && !TWO_DRINKS.test(d.name) && !BRACKET_SET.test(d.name))
    .map((d) => {
      const name = cleanName(d.name);
      return {
        ...d,
        name,
        raw: d.name,
        tokens: tokenize(name),
        // 용량은 정보표에 있는 것이 먼저다. 없으면 이름에서 찾는다 —
        // "[30ml] … 바이알"이나 "카스 라이트 페트 1.6L"이 그런 경우다.
        ml: mlOf(d.volume) || mlOf(d.name),
        marks: marks(d.name),
        nums: numsOf(d.name),
        pct: abvOf(d.abv) ?? abvOf(d.name),
        low: trustedLow(d),
        // 구형·신형 표시가 붙은 것은 같은 술이라도 뒤로 민다. 값 차이는 크지
        // 않지만 화면에 "더 글렌드로낙 12년(구형)"이라고 뜨면 우리가 옛 물건을
        // 보여 주는 것처럼 읽힌다.
        aged: /구형|신형|리뉴얼|이전\s*버전/.test(d.name),
      };
    });

  cache.set(key, { at: Date.now(), rows });
  return rows;
}

/** 색인을 다시 읽게 한다 — 수집기가 돌고 난 뒤 */
export function clearIndexCache() {
  cache.clear();
}

// ── 조회 ────────────────────────────────────────────────

/**
 * 이 술의 국내 최저가.
 *
 * @param {string} name  우리 카탈로그의 이름
 * @param {object} opts
 * @param {string} opts.category  우리 주종 (wine · sake · …)
 * @param {number|string} opts.volume  아는 경우의 용량. 750ml 와 375ml 는 값이 두 배 다르다.
 * @returns {null | {low, price, high, sellers, url, name, volume, abv, image, id}}
 */
export async function dailyshotFor(name, { category, volume } = {}) {
  if (!name || !category) return null;
  if (isBlocked(name)) return null;
  const q = searchName(name, category);
  const rows = await index(category);
  const hit = rows.length ? matchIn(rows, q, { category, volume }) : null;
  if (hit) {
    // 우리 이름은 통을 말하는데(셰리) 붙은 것은 통을 안 적은 일반 상품일 수 있다.
    // 통까지 적힌 상품이 색인에는 없고 검색에만 있는 경우가 있어서다 — 색인은
    // 목록 API 를 훑은 것이라 노출이 빠진 상품이 있다. 발베니 15년 싱글배럴이
    // 그랬다. 셰리(452,000원)·버번(780,000원)·무표기(500,000원)가 따로 있는데
    // 우리 셰리가 무표기에 붙어 있었다. 이때만 검색으로 한 번 더 물어 본다.
    const want = caskSet(q);
    if (want.size && !caskSet(hit.name).size) {
      const exact = await searchAndMatch(name, { category, volume });
      if (exact && [...want].some((k) => caskSet(exact.name).has(k))) return exact;
    }
    return hit;
  }

  // 제 자리에서 못 찾으면 이웃한 분류까지 넓혀 한 번 더 본다.
  // 국산 과실주처럼 우리와 그쪽의 분류가 어긋나는 것들이 여기서 잡힌다.
  const wide = await index(category, { wide: true });
  if (wide.length > rows.length) return matchIn(wide, q, { category, volume });
  return null;
}

/**
 * 이름 대조 — 여기서는 느슨함이 아니라 엄격함이 필요하다.
 *
 * lib/match.js 의 findLooseMatch 를 그대로 쓰면 안 된다. 그것은 메뉴판 대조용이라
 * 조금 어긋나도 붙이는 쪽으로 기울어 있다. 메뉴판에서는 비슷한 술이라도 보여
 * 주는 편이 낫지만, 값에서는 반대다 — 붙일 곳을 못 찾으면 값이 안 보일 뿐이지만
 * 엉뚱한 데 붙으면 오지 않을 알림을 기다리게 된다.
 *
 * 실제로 느슨한 대조를 400종에 돌려 보니 절반이 틀렸다.
 *   그라함 20년 토니 포트  →  샌드맨 20년 토니 포트    (집이 다르다)
 *   75 소비뇽 블랑        →  테 파 소비뇽 블랑        ("75"가 통째로 사라졌다)
 *
 * 그래서 규칙 하나로 못 박는다 — 우리 이름에서 품종·등급 같은 흔한 말을 뺀
 * 나머지가 후보에 "전부" 들어 있어야 한다. 위 둘은 그라함 · 75 가 후보에 없어
 * 걸러진다. 반대로 후보가 우리보다 자세한 것은 통과시킨다.
 *   그라니테 힐 진판델  →  그라니테 힐 올드 바인 진판델   (통과)
 */
function matchIn(rows, name, { category, volume } = {}) {
  // 우리 쪽이 30ml 바이알인데 파는 쪽 바이알은 BUNDLE 이 걸러 낸다. 그래서
  // 남는 것은 낱병뿐이고, 그대로 두면 30ml 에 병값이 붙는다 — 실제로
  // "보머거스 … 바이알"에 369,000원이 붙어 있었다. 값을 못 찾는 것보다
  // 나쁘다. 낱병 값을 빌려 오느니 값을 안 보이는 편이 맞다.
  if (BUNDLE.test(name) || TWO_DRINKS.test(name)) return null;
  const clean = cleanName(name);
  const query = tokenize(clean);
  const strong = query.filter((t) => !isWeakToken(t));
  // 품종·등급뿐인 이름은 어느 술인지 특정할 수 없다 ("카베르네 소비뇽")
  if (!strong.length) return null;
  // 낱말이 하나뿐이어도, 그것이 흔한 말이 아니고 세 글자 이상이면 특정이 된다.
  // 우리 술은 상표 하나가 곧 이름인 경우가 많다 — 처음처럼 · 좋은데이 · 청하 ·
  // 설화. 두 낱말을 요구하면 이런 술이 통째로 막힌다.
  if (query.length < 2 && !(strong.length === 1 && strong[0].length >= 2)) return null;

  // 반드시 후보에 있어야 하는 낱말 = 강한 낱말 + 품종 + 색.
  //
  // 품종과 색은 '이 술이 무엇인가'를 말해 주지 않아 약한 낱말로 분류되지만,
  // '다른 술이다'는 확실히 말해 준다. 이것을 빼고 보면
  //   7 컬러즈 메를로     →  7 컬러즈 브뤼 샤르마          (같은 집 다른 술)
  //   그랑 씨 리슬링 알자스 →  마르셀 다이스 알자스 컴플렌테이션  (알자스만 같다)
  // 처럼 집이나 산지만 같은 술에 붙는다. isDroppableToken 이 그 구분을 안다.
  // 같은 낱말이 두 번 나오는 이름이 있다 ("가비 디 가비"). 세는 자리에서
  // 둘로 치면 "특정할 낱말이 둘"로 보여 아래의 길이 방어가 풀린다.
  const required = [...new Set(query.filter((t) => !isDroppableToken(t)))];

  const allowed = VOLUMES[category] || null;
  const want = mlOf(volume);
  const seen = new Set(query);
  // 특정할 낱말이 하나뿐이면("가비", "기원") 그 낱말을 품은 아무 술에나 붙을 수
  // 있다. 그럴 때는 후보가 군더더기를 하나도 더 달지 않았을 때만 같은 술로 본다.
  const loose = required.length < 2;

  const grade = category === "sake" ? gradeSet(clean, SAKE_GRADE) : null;
  const style = category === "beer" ? gradeSet(clean, BEER_STYLE) : null;
  const kind = KOREAN.has(category) ? gradeSet(clean, KOREAN_KIND) : null;
  const ours = marks(clean);
  const ourYears = yearsOf(name);
  const ourCask = caskSet(name);
  const ourGrapes = varieties(clean);
  const pct = abvOf(name);
  const compact = clean.replace(/\s/g, "").length;

  const hits = [];
  for (const r of rows) {
    const has = new Set(r.tokens);
    // 띄어쓰기가 다르면 낱말이 어긋난다 — 우리는 "7컬러즈", 그쪽은 "7 컬러즈".
    // 낱말로 못 찾으면 띄어쓰기를 지운 이름 안에 그 말이 있는지 한 번 더 본다.
    // 짧은 말은 우연히 걸리므로 세 글자부터만 이렇게 본다.
    const flat = r.raw.replace(/\s/g, "");
    const missing = required.filter(
      (t) =>
        !has.has(t) &&
        !(t.length >= 3 && flat.includes(t)) &&
        // 숫자가 도수 표기 뒤에 숨는 경우 — "마한 48"을 그쪽은 "마한 48%"로 적는다.
        // 이름을 다듬으며 도수를 떼는 바람에 48 이 낱말에서 사라진다. 그러나
        // 마한 48 은 48 이 곧 이름이다(마한 24 · 마한 48 이 다른 술이다).
        // 그래서 순수한 숫자는 상대의 숫자 표시에서도 찾아 본다.
        !(/^\d+$/.test(t) && r.nums.has(t))
    );

    // 우리 이름이 상대보다 자세할 때가 있다.
    //   펜폴즈 빈 28 칼림나 쉬라즈  →  펜폴즈 빈 28 쉬라즈   ("칼림나"를 뗀 표기)
    // 그렇다고 아무 낱말이나 빠뜨리게 두면 그라함 토니 포트에 샌드맨이 붙는다.
    // 그래서 딱 하나만, 그것도 상대가 군더더기를 하나도 안 달았을 때만 봐준다.
    // 군더더기가 없다는 것은 다른 술을 가리키는 표시가 없다는 뜻이다.
    // 다만 맨 앞 낱말은 못 뺀다. 그 자리가 만드는 집이기 때문이다 —
    // "카시예로 델 디아블로 까베르네"에서 카시예로를 빼면 콘차이토로의 다른 줄인
    // "디아블로 까베르네"가 붙는다. 값도 이름도 다른 술이다.
    const slack = missing.length === 1 && required.length >= 3 && missing[0] !== required[0];
    if (missing.length > (slack ? 1 : 0)) continue;
    // 품종·색·숫자가 서로 다르다고 못 박는 신호 (샤르도네 vs 리슬링, 12년 vs 17년)
    if (conflictsWith(clean, r.name)) continue;
    // 숙성 통이 서로 다르다고 못 박는 경우 (셰리 vs 버번) — 위 CASK_KINDS 참고.
    // 우리 쪽은 이 함수에 들어온 이름, 곧 별칭을 적용한 뒤의 이름이다.
    if (ourCask.size) {
      const theirs = caskSet(r.raw);
      if (theirs.size && ![...ourCask].some((k) => theirs.has(k))) continue;
    }
    // 계절·색 한 글자가 다른 병 (풍정사계 춘 vs 동, 추사 vs 추사 백) — syllableConflict 참고
    if (syllableConflict(name, r.raw)) continue;
    // 출시 연도가 서로 다르면 다른 술이다. marks 가 네 자리 숫자를 빈티지로
    // 보고 지우기 때문에 그 뒤로는 2017 과 2023 을 가릴 길이 없어진다 —
    // 실제로 "맥캘란 클래식컷 2017릴리즈"에 2023 값 360,000원이 붙었다.
    // 한쪽만 연도를 적은 경우는 그냥 둔다. 상품명이 연도를 생략하는 일은 흔하다.
    if (ourYears.size) {
      const theirs = yearsOf(r.raw);
      if (theirs.size && ![...ourYears].some((y) => theirs.has(y))) continue;
    }
    // 양쪽 다 품종을 말하는데 겹치는 것이 하나도 없으면 다른 술이다.
    // 한쪽만 말하는 경우는 그냥 둔다 — 상품명이 품종을 생략하는 일은 흔하다.
    if (ourGrapes.size) {
      const theirs = varieties(r.name);
      if (theirs.size && ![...ourGrapes].some((g) => theirs.has(g))) continue;
    }

    // 용량이 다르면 값이 통째로 다르다. 우리 쪽 용량을 모르므로 그 주종에서
    // 병 하나가 보통 몇 밀리리터인지로 거른다 — 1.5L 값을 750ml 값으로 쓰거나
    // 30ml 바이알 값을 병값으로 쓰면 목표가 알림이 영영 안 울린다.
    const ml = r.ml;
    if (ml) {
      if (want ? ml !== want : allowed ? !allowed.includes(ml) : ml < 200 || ml > 1000) continue;
    }

    // 사케 등급은 양쪽이 똑같아야 한다 — 준마이와 준마이 다이긴조는 다른 술이다.
    if (grade && !sameSet(grade, gradeSet(r.name, SAKE_GRADE))) continue;
    // 맥주 스타일은 우리가 적었을 때만 본다. 상품명이 스타일을 생략하는 일이 흔해
    // 양쪽을 맞추면 멀쩡한 것을 버린다 ("크래프트브로스 라이프" ↔ "…라이프 IPA").
    if (style?.size) {
      const theirs = gradeSet(r.name, BEER_STYLE);
      if (!sameSet(style, theirs)) continue;
    }
    // 우리 술은 종류를 가리는 말이 곧 다른 술이다 (미미옥 막걸리 ↔ 미미옥 약주).
    // 다만 양쪽이 다 말할 때만 본다 — 상품명이 종류를 생략하는 일이 흔하고,
    // 그때까지 막으면 "한라산 소주"가 "한라산 병 360ml"을 못 만난다.
    if (kind?.size) {
      const theirs = gradeSet(r.name, KOREAN_KIND);
      if (theirs.size && !sameSet(kind, theirs)) continue;
    }

    // 도수를 양쪽이 밝히면 같아야 한다.
    // "나루 생 막걸리 6%"에 "나루 생 막걸리 11.5%" 값이 붙었다 — 이름에서 도수를
    // 떼고 보니 두 술이 같아 보였다.
    if (pct != null && r.pct != null && pct !== r.pct) continue;

    // 이름에 박힌 구분 숫자가 우리 쪽에 있으면 후보에도 있어야 한다
    if (![...ours].every((n) => r.marks.has(n))) continue;
    // 특정할 낱말이 하나뿐이면 반대쪽도 본다 — 후보가 우리에게 없는 숫자를
    // 달고 있으면 다른 술이다. "한라산 소주"에 "한라산 1950"(15,000원)이 붙던
    // 자리다. 낱말이 하나뿐이라 숫자 말고는 둘을 가를 것이 없다.
    if (loose) {
      const mine = marks(clean, { keepYears: true });
      if (![...marks(r.raw, { keepYears: true })].every((n) => mine.has(n))) continue;
    }

    // 후보가 우리 이름에 없는 낱말을 여럿 달고 있으면 다른 표현이다.
    //   글렌알라키 12년      →  글렌알라키 12년 모스카텔 우드 피니시   (다른 술, 값 1.5배)
    //   더 글렌리벳 15년     →  시그나토리 2006 더 글렌리벳 15년 CS  (독립병입, 값 3배)
    const extras = r.tokens.filter((t) => !seen.has(t) && !isWeakToken(t)).length;
    if (loose ? extras > 0 : extras >= 2) continue;
    // 낱말 하나를 봐주는 것은 상대가 아무것도 더 달지 않았을 때뿐이다
    if (slack && extras > 0) continue;
    // 특정할 낱말이 하나뿐일 때는 길이도 본다. 한 글자 낱말은 토큰에서 떨어져
    // 나가기 때문에 "술샘 쑥 막걸리"가 그냥 "술샘"으로 줄고, 그러면 술샘이 내는
    // 아무 술에나 붙는다.
    if (loose && r.name.replace(/\s/g, "").length < compact * 0.6) continue;

    // 낱말이 다 맞은 것을 먼저 세운다 — 하나 봐준 것보다 앞이다
    hits.push({ r, extras: extras + (slack ? 0.5 : 0) });
  }
  if (!hits.length) return null;

  // 군더더기가 없는 것부터 고른다.
  //
  // 낱말 하나 차이가 특별판인 경우가 많다 — 글렌리벳 12년 vs 12년 "엑설런스",
  // 메이커스 마크 vs 마크 "CS", 닷사이 23 vs 23 "원심분리". 값이 1.3~3배 뛴다.
  // 그렇다고 낱말 하나 차이를 전부 막으면 "라프로익 셀렉트 → 라프로익 오크
  // 셀렉트"처럼 표기만 다른 같은 술까지 잃는다. 그래서 막지 않고 뒤로 미룬다 —
  // 기본 제품이 색인에 있으면 언제나 그쪽이 먼저 뽑힌다.
  // 군더더기 → 이름 길이 → 파는 곳 수 순으로 고른다.
  //
  // 이름 길이가 가운데 들어가는 이유. "라가불린 16년"과 "라가불린 16년 750ml"은
  // 끝의 용량을 떼고 나면 낱말이 똑같아 군더더기로는 안 갈린다. 그때 파는 곳
  // 수만 보면 판매처 정보가 아직 안 채워진 쪽이 밀린다 — 실제로 91,506 원짜리
  // 기본 제품이 144,000 원짜리 750ml 에 밀렸다. 이름이 짧은 쪽이 기본 제품이다.
  //
  // 길이를 두 번 보는 이유. 한 번에 원래 이름 길이로만 재면 용량이 붙은 기본
  // 제품이 낱말 하나 더 달린 다른 술에 진다 — "로얄살루트 21년 700ml"(171,617원)이
  // "로얄살루트 21년 몰트"(287,900원)보다 길어서 밀렸다. 둘은 다른 병이다.
  // 그래서 용량을 뗀 이름으로 먼저 재고(딴 낱말이 붙은 쪽이 짐), 거기서
  // 비기면 원래 이름으로 다시 잰다(용량이 붙은 쪽이 짐).
  hits.sort(
    (a, b) =>
      a.extras - b.extras ||
      // 우리 이름이 통을 말하면 통까지 적힌 후보를 앞에 둔다 (통을 안 적은 일반
      // 상품이 이름이 짧다고 이기지 않게). 위 dailyshotFor 의 보강과 한 쌍이다.
      (ourCask.size && !caskSet(a.r.raw).size ? 1 : 0) -
        (ourCask.size && !caskSet(b.r.raw).size ? 1 : 0) ||
      // 구형·신형 표시가 붙은 것은 이름이 짧더라도 뒤로 민다. 길이보다 먼저
      // 봐야 한다 — "발렌타인 17년(구형)"이 "발렌타인 17년 700ml"보다 짧다.
      (a.r.aged ? 1 : 0) - (b.r.aged ? 1 : 0) ||
      a.r.name.length - b.r.name.length ||
      a.r.raw.length - b.r.raw.length ||
      rank(a.r, want) - rank(b.r, want)
  );
  return shape(hits[0].r);
}

/**
 * 병 하나로 통하는 용량 — 우리 카탈로그에는 용량이 없어서 이쪽으로 고른다.
 *
 * 같은 술이 750ml 와 1.5L 로 함께 올라와 있으면 값이 두 배 차이 난다.
 * 어느 쪽인지 말해 주는 정보가 우리에게 없으므로, 그 주종에서 병 하나가
 * 보통 몇 밀리리터인지로 거른다.
 *
 * 맥주와 우리술은 여기 두지 않는다 — 330 · 355 · 500 · 750 이 다 정상이라
 * 하나로 못 박으면 멀쩡한 것을 버린다. 그쪽은 용량을 그대로 실어 보내고
 * 화면이 밝히게 한다.
 */
const VOLUMES = {
  wine: [750],
  sake: [720, 750],
  // 스카치는 700, 아메리칸은 750 이 표준이다. 둘 다 병 하나다.
  whisky: [700, 750],
  brandy: [700, 750],
  rum: [700, 750],
  gin: [700, 750],
  vodka: [700, 750],
  tequila: [700, 750],
  // 리큐르도 700·750 이 병 하나다. 이 줄이 없어 1L 가 통과했고,
  // "미도리 멜론"에 미도리 1L 값이 붙었다 — 용량이 다르면 값이 다르다.
  liqueur: [700, 750],
};
// 우리 술과 백주는 병 크기가 제각각이다. 소주 360, 화요 375·750, 백주 500,
// 막걸리 750·940 … 목록으로 못 박으면 멀쩡한 것을 더 많이 잃는다.
// 그쪽은 200~1000ml 라는 느슨한 기본 규칙으로 거른다.

function rank(r, want) {
  // 군더더기 수는 부른 쪽에서 이미 봤다. 여기서는 그다음을 가른다.
  //
  // 용량은 우리가 아는 경우에만 벌점을 준다. 모를 때 표준 하나를 골라 벌점을
  // 주면 700 · 750 이 다 정상인 위스키에서 멀쩡한 750ml 를 뒤로 밀어 버린다.
  const volPenalty = want && r.ml && r.ml !== want ? 1000 : 0;
  // 파는 곳이 많을수록 그 값이 시세에 가깝다
  const trust = Math.min(r.sellers || 0, 999) / 1000;
  return volPenalty - trust;
}

function shape(d) {
  return {
    id: d.id,
    // 판매처를 물을 때 쓰는 번호. 이것이 있어야 지금 값을 확인할 수 있다.
    itemId: d.itemId || null,
    // 최저가를 판매처 API 로 받아 둔 시각. 없으면 아직 대표가만 아는 상태다.
    lowAt: d.lowAt || null,
    name: d.raw || d.name,
    low: d.low,
    price: d.price,
    high: d.high,
    // 파는 곳이 몇이냐가 값을 믿을 근거다. 한 곳뿐인 값은 그 가게 값일 뿐이고,
    // 백 곳이 파는 값은 시세다. 화면이 이 숫자로 표현을 가른다.
    sellers: d.sellers || 0,
    // 그 최저가를 파는 매장. 상품 페이지에 뜨는 값과 우리 값이 다를 때
    // 어디를 봐야 하는지 알려 준다 — 그쪽은 대표가나 가까운 매장 값을 띄운다.
    lowSeller: d.lowSeller || null,
    lowRegion: d.lowRegion || null,
    // 보통 가격 — 매장 값의 가운데. 가장 싼 한 곳은 잘못 올린 값일 수 있어 화면은 이것을 크게 쓴다
    mid: d.mid ?? null,
    midBand: d.midBand ?? null,
    midBandCount: d.midBandCount ?? null,
    lowOutliers: d.lowOutliers ?? 0,
    // 판매처에 직접 물어 확인한 값인가.
    //
    // 아닌 경우에는 목록 API 가 주는 대표가다. 그것은 정가에 가까워 실제로 사는
    // 값과 다르다 — 라가불린 16년이 대표 182,000 원인데 매장 픽업 최저가는
    // 130,000 원이었다. 확인하지 않은 값을 "최저가"라고 부르면 거짓말이 된다.
    verified: !!d.lowAt,
    volume: d.volume || null,
    abv: d.abv || null,
    image: d.image || null,
    rating: d.rating || null,
    reviews: d.reviews || 0,
    url: d.url,
    // 값이 어떻게 움직였나. 화면이 작은 선 그래프로 그린다.
    history: dayPoints(d.history),
    source: "dailyshot",
  };
}

/**
 * 이력을 하루 한 점으로 추린다 — 그래프가 읽히려면 축이 고르게 벌어져야 한다.
 *
 * 사람이 열어 볼 때마다 점이 찍히므로 인기 있는 술은 하루에 여러 점이 생긴다.
 * 그것을 그대로 그리면 조회가 잦았던 날만 촘촘해져, 값이 그날 요동친 것처럼
 * 보인다. 같은 날은 그날의 최저가 하나로 모은다.
 */
function dayPoints(history) {
  const byDay = new Map();
  for (const h of Array.isArray(history) ? history : []) {
    const low = Number(h?.low);
    if (!Number.isFinite(low) || low <= 0) continue;
    const d = new Date(h.at).toISOString().slice(0, 10);
    byDay.set(d, Math.min(byDay.get(d) ?? Infinity, low));
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, p]) => ({ d, p }));
}

/**
 * 담아 둔 값 말고 지금 값 — 목표가 알림이 울리기 직전에 한 번 더 확인할 때.
 *
 * 색인은 하루 한 번 갱신된다. 알림을 보내기 전에 그 한 건만 다시 확인하면
 * "떨어졌다고 알림 받고 들어갔더니 이미 올랐다"를 막을 수 있다.
 */
/**
 * 지금 살 수 있는 최저가 — 매장 픽업 기준.
 *
 * 2026-08-24 이전에는 데일리샷이 페이지에 실어 주던 lowPrice 를 그대로 썼다.
 * 그 값에는 면세점과 30ml 시음 잔값이 섞여 있어서, 조니워커 킹 조지 5세가
 * 950,000 원짜리인데 최저가 100 원으로 나왔다. 대표가의 3할 밑을 걸러 내는
 * 방어막을 쳐야 했다.
 *
 * 이제는 판매처를 종류별로 갈라 물을 수 있다. service_type 1 이 스마트오더
 * 매장 픽업 — 국내에서 술을 합법적으로 사는 바로 그 방식이다. 값싼 순으로
 * 한 건만 받으면 그것이 오늘의 최저가고, 같은 응답의 count 가 파는 곳 수다.
 * 섞인 것을 걸러 내는 게 아니라 애초에 섞이지 않는다.
 *
 * 2026-10-29 — 가장 싼 한 곳은 믿을 수 없었다. 에셈베 모젤 크리스마스 로제를 157곳이 파는데 135곳이 3만~4만원,
 * 가운데 값 35,000원인데 한 곳(고래맥주창고 안암점)이 15,000원에 올려 두어 그 값이 "최저가"로 나갔다 — 잘못 올렸거나
 * 떨이다. 그래서 이제는 매장 값 전체를 보고 (1) 가운데 값(보통 가격) (2) 가장 많이 몰린 만원대 (3) 가운데 값의 60% 밑과
 * 품절을 뺀 최저가를 낸다. 화면은 (1)을 크게, (3)을 작게 쓰고, 술창고 · 특가 알림은 (3)을 쓴다(low 이름 그대로).
 * 매장이 300곳까지는 전부 받고(50곳씩 최대 6번), 그보다 많으면 첫 쪽과 가운데 값이 든 쪽만 받아 가운데 값을 정확히 짚는다.
 *
 * @param {number} itemId 데일리샷 item 번호 (top_product_id 가 아니다)
 * @returns {Promise<null | {low:number, mid:number, sellers:number, band:number|null, bandCount:number|null, outliers:number}>}
 */
export async function livePrice(itemId) {
  if (!itemId) return null;
  const page = async (n) => {
    const r = await fetch(
      `${API}/item-sellers/?item_id=${itemId}&service_type=${PICKUP}&ordering=price&page=${n}&page_size=${SELLER_PAGE}`,
      { headers: HEAD, signal: AbortSignal.timeout(15000) }
    );
    return r.ok ? r.json() : null;
  };
  const priceOf = (x) => Number(x?.item?.price);
  try {
    const first = await page(1);
    if (!first) return null;
    const count = Number(first.count) || 0;
    let rows = first.results || [];
    let mid = null;
    let all = true;
    if (count <= SELLER_PAGE * FULL_PAGES) {
      // 전부 받는다
      for (let n = 2; first.next && rows.length < count && n <= FULL_PAGES; n++) {
        const j = await page(n);
        if (!j) break;
        rows = rows.concat(j.results || []);
        if (!j.next) break;
      }
    } else {
      // 가운데 값이 든 쪽만 더 받는다 — 값싼 순서라 그 자리의 값이 곧 가운데 값이다
      all = false;
      const at = Math.floor((count - 1) / 2);
      const j = await page(Math.floor(at / SELLER_PAGE) + 1);
      const v = priceOf(j?.results?.[at % SELLER_PAGE]);
      if (v > 0) mid = v;
    }
    const priced = rows.filter((x) => priceOf(x) > 0);
    if (!priced.length) return null;
    const prices = priced.map(priceOf).sort((a, b) => a - b);
    if (mid == null) mid = prices[Math.floor((prices.length - 1) / 2)];

    // 살 수 있는 곳 중, 지나치게 싼 값(가운데 값의 60% 밑 — 잘못 올린 값 · 떨이)을 뺀 가장 싼 곳
    const floor = mid * OUTLIER_RATIO;
    const open = priced.filter((x) => !SOLD_OUT.test(x?.seller?.expected_arrival_date || ""));
    const fair = (open.length ? open : priced).filter((x) => priceOf(x) >= floor);
    const pick = fair[0] || open[0] || priced[0]; // 값싼 순서로 와 있다
    const low = priceOf(pick);
    if (!Number.isFinite(low) || low <= 0) return null;

    // 가장 많이 몰린 만원대 — 전부 받았을 때만 셀 수 있다("157곳 중 135곳이 3만원대")
    let band = null, bandCount = null;
    if (all) {
      const bands = new Map();
      for (const p of prices) bands.set(Math.floor(p / 10000), (bands.get(Math.floor(p / 10000)) || 0) + 1);
      [band, bandCount] = [...bands.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    }

    return {
      low,
      mid,
      band,
      bandCount,
      // 최저가에서 뺀 지나치게 싼 값의 수(받아 본 것 중에서)
      outliers: prices.filter((p) => p < floor).length,
      sellers: count || priced.length,
      // 어느 매장 값인지 — 화면에서 상품 페이지 값과 다른 이유가 여기 있다
      seller: pick.seller?.name || null,
      region: pick.seller?.region || null,
      // 받아 본 곳이 모두 품절이면 살 수 없는 값이다. 화면이 그렇게 밝혀야 한다.
      soldOut: !open.length,
    };
  } catch {
    return null;
  }
}

/**
 * 색인에 없는 것을 데일리샷 검색으로 한 번 더 찾는다.
 *
 * 우리 색인은 목록 API 를 훑어 만든 것이라 품절·비노출 상품이 빠져 있다.
 * 그런 것도 검색에는 걸린다 — "7 컬러즈, 소비뇽 블랑"이 그랬다.
 *
 * 다만 데일리샷 검색은 매우 느슨하다. "카시예로 델 디아블로 카베르네 소비뇽"에
 * 2,956 건을 주고 첫 줄이 "러시안 잭 소비뇽 블랑"이다. 그러니 검색 결과를
 * 그대로 믿으면 안 되고, 후보로만 받아 우리 잣대로 다시 걸러야 한다.
 * 검색은 후보를 데려오는 일까지만 하고, 판단은 matchIn 이 한다.
 *
 * 찾은 것은 색인에 담아 둔다. 다음 사람은 검색까지 가지 않는다.
 */
export async function searchAndMatch(name, { category, volume } = {}) {
  if (!name || !category) return null;
  if (isBlocked(name)) return null;
  const q = searchName(name, category);
  try {
    const r = await fetch(
      `${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=20`,
      { headers: HEAD, signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) return null;
    const results = (await r.json())?.results || [];
    if (!results.length) return null;

    const rows = results
      .filter((x) => x?.top_product_id && x?.id && !BUNDLE.test(x.name) && !TWO_DRINKS.test(x.name))
      .map((x) => {
        const clean = cleanName(x.name);
        return {
          id: Number(x.top_product_id),
          itemId: Number(x.id),
          name: clean,
          raw: x.name,
          category: x.category || null,
          subcategory: x.subcategory || null,
          price: Number(x.price) || null,
          low: Number(x.price) || null,
          sellers: 0,
          image: x.thumbnail_image || null,
          rating: Number(x.review_rate) || null,
          reviews: Number(x.review_count) || 0,
          url: `https://dailyshot.co/m/item/${x.top_product_id}`,
          tokens: tokenize(clean),
          ml: mlOf(x.name),
          marks: marks(x.name),
          nums: numsOf(x.name),
          pct: abvOf(x.name),
          aged: /구형|신형|리뉴얼|이전\s*버전/.test(x.name),
        };
      });
    if (!rows.length) return null;

    const best = matchIn(rows, q, { category, volume });
    if (!best) return null;

    // 찾은 것은 색인에 담아 둔다 — 다음부터는 검색까지 가지 않는다
    const row = rows.find((x) => x.id === best.id);
    if (row) {
      try {
        const db = await getDb();
        await db?.collection("dailyshot").updateOne(
          { id: row.id },
          {
            $set: {
              id: row.id, itemId: row.itemId, name: row.raw,
              category: row.category, subcategory: row.subcategory,
              price: row.price, image: row.image,
              rating: row.rating, reviews: row.reviews, url: row.url,
              seenAt: new Date(), fromSearch: true,
            },
          },
          { upsert: true }
        );
      } catch {
        /* 담아 두지 못해도 이번 답은 줄 수 있다 */
      }
    }
    return best;
  } catch {
    return null;
  }
}

/** 면세점 값 — 여행자만 살 수 있으므로 최저가와 같은 자리에 두지 않는다 */
export async function dutyFreePrice(itemId) {
  if (!itemId) return null;
  try {
    const r = await fetch(
      `${API}/item-sellers/?item_id=${itemId}&service_type=${DUTY_FREE}&ordering=price&page=1&page_size=1`,
      { headers: HEAD, signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) return null;
    const low = Number((await r.json())?.results?.[0]?.item?.price);
    return Number.isFinite(low) && low > 0 ? low : null;
  } catch {
    return null;
  }
}

// ── 데일리샷 API ─────────────────────────────────────────

const API = "https://api.dailyshot.co";
// 브라우저가 붙여 보내는 것과 같은 표시. 없으면 응답이 달라진다.
const HEAD = {
  "user-agent": "ClaudeBot",
  "dailyshot-web": "1",
  "encrypted-web": "1",
  accept: "application/json",
};
// 판매처 종류. 1 = 스마트오더 매장 픽업, 5 = 면세점.
// 국내에서 술을 온라인으로 사는 합법적인 길이 1 뿐이라, 그것이 우리가 말할 값이다.
const PICKUP = 1;
const DUTY_FREE = 5;

/**
 * 값이 싼 순서로 이만큼 받아 살 수 있는 첫 곳을 고른다.
 *
 * 한 곳만 받으면 그 한 곳이 품절일 때 살 수 없는 값을 최저가라고 내놓게 된다.
 * 탈리스커 10년이 그랬다 — 싼 순서로 열둘 중 일곱이 품절이었고, 우리는 맨 앞
 * 63,800원을 보여 주는데 상품 페이지에는 69,000원이 떠서 값이 다르게 보였다.
 * 진짜로 살 수 있는 최저가는 65,000원이다.
 */
const SELLER_PAGE = 50; // 한 번에 받는 매장 수(데일리샷이 주는 최대치 근처)
// 매장을 전부 받는 한도(쪽 수) — 50 × 6 = 300곳. 그보다 많으면 첫 쪽 + 가운데 값이 든 쪽만 받는다
const FULL_PAGES = 6;
// 가운데 값의 이만큼 밑은 잘못 올린 값 · 떨이로 보고 최저가에서 뺀다(2026-10-29 에셈베 로제 15,000원 ↔ 가운데 35,000원)
const OUTLIER_RATIO = 0.6;

/** 매장이 밝히는 입고 예정 자리에 이 말이 있으면 지금은 못 산다 */
const SOLD_OUT = /품절|일시\s*품절|재고\s*없/;

/**
 * 담아 둔 값을 지금 값으로 갈아 끼운다 — 매일 새벽 크론이 부른다.
 *
 * 전량을 매일 돌릴 이유는 없다. 알림이 걸린 술만 새로 받으면 되고, 나머지는
 * 화면에 값을 보여 주는 용도라 사람이 열어 볼 때 채워 넣는 것으로 족하다.
 *
 * 값이 바뀌었든 아니든 이력에 한 점을 남긴다. 그래야 "지난달보다 얼마나
 * 싼가"를 말할 수 있고, 그 말은 점이 쌓여야만 할 수 있다.
 *
 * @param {Array<{id:number, itemId:number}>} rows 다시 받을 상품
 */
export async function refreshItems(rows, { concurrency = 5, gap = 400 } = {}) {
  const db = await getDb();
  const list = (rows || []).filter((r) => r?.itemId);
  if (!db || !list.length) return { updated: 0, failed: 0 };

  const col = db.collection("dailyshot");
  const now = new Date();
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < list.length; i += concurrency) {
    const slice = list.slice(i, i + concurrency);
    const got = await Promise.all(
      slice.map(async (r) => ({ row: r, live: await livePrice(r.itemId) }))
    );
    const ok = got.filter((g) => g.live);
    failed += got.length - ok.length;

    if (ok.length) {
      await col.bulkWrite(
        ok.map(({ row, live }) => ({
          updateOne: {
            filter: { itemId: row.itemId },
            update: {
              $set: {
                low: live.low, sellers: live.sellers, lowAt: now,
                lowSeller: live.seller || null, lowRegion: live.region || null,
                lowSoldOut: !!live.soldOut,
                // 보통 가격(가운데 값) · 가장 많이 몰린 만원대 — 화면이 크게 쓰는 값(2026-10-29)
                mid: live.mid ?? null, midBand: live.band ?? null, midBandCount: live.bandCount ?? null, lowOutliers: live.outliers ?? 0,
              },
              $push: { history: { $each: [{ at: now, low: live.low }], $slice: -60 } },
            },
          },
        })),
        { ordered: false }
      );
      updated += ok.length;
    }
    if (i + concurrency < list.length) await new Promise((z) => setTimeout(z, gap));
  }

  // 값이 바뀌었으니 화면이 들고 있는 색인도 버린다
  if (updated) cache.clear();
  return { updated, failed };
}

// ── 잔과 도구 ────────────────────────────────────────────

/**
 * 같은 물건의 다른 이름.
 *
 * 우리는 "부르고뉴 와인잔"이라 부르고 상품은 "버건디 와인잔"이라 적는다.
 * 술 이름과 달리 여기서는 이런 어긋남이 흔하다 — 잔 이름에 표준이 없다.
 */
const GOODS_ALIAS = {
  부르고뉴: ["부르고뉴", "버건디"],
  잔: ["잔", "글라스"],
  와인잔: ["와인잔", "와인 글라스", "와인글라스"],
  몰드: ["몰드", "제빙기", "트레이"],
  디캔터: ["디캔터", "데칸터"],
  도쿠리: ["도쿠리", "토쿠리", "とっくり"],
  오초코: ["오초코", "초코", "쵸코"],
  스니프터: ["스니프터", "스니터"],
  테이스팅잔: ["테이스팅", "테이스팅잔", "글렌캐런"],
  오프너: ["오프너", "병따개"],
};

/**
 * 이 잔·도구를 실제로 파는 상품 하나.
 *
 * 술과 달리 잔은 온라인 판매에 아무 제한이 없어 링크가 곧 구매로 이어진다.
 * 지금은 쿠팡 검색 주소만 걸어 두었는데, 그것은 "찾아보세요"이지 "이것을
 * 사세요"가 아니다. 값과 사진이 붙은 상품 하나를 보여 줄 수 있으면 다르다.
 *
 * 다만 용품은 105 건뿐이라 대부분은 못 찾는다. 그때는 null 을 주고 화면이
 * 하던 대로 검색 주소를 걸게 둔다 — 억지로 비슷한 것을 붙이면 부르고뉴 잔을
 * 찾는 사람에게 샴페인 잔이 간다.
 *
 * @param {string} keyword lib/glassware.js · lib/gear.js 의 shopKeyword
 */
export async function goodsFor(keyword) {
  if (!keyword) return null;
  const db = await getDb();
  if (!db) return null;

  const words = String(keyword)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!words.length) return null;

  const hit = goodsCache.get(keyword);
  if (hit && Date.now() - hit.at < TTL) return hit.row;

  const docs = await db
    .collection("dailyshot")
    .find(
      { category: "주류 용품", low: { $gt: 0 } },
      { projection: { _id: 0, id: 1, name: 1, low: 1, sellers: 1, url: 1, image: 1 } }
    )
    .toArray();

  const found =
    docs
      .filter((d) => {
        const n = String(d.name).toLowerCase().replace(/\s+/g, "");
        // 우리가 적은 낱말이 전부 들어 있어야 한다. 하나라도 빠지면 다른 물건이다 —
        // "보르도 와인잔"에서 보르도가 빠지면 샴페인 잔이 걸린다.
        return words.every((w) =>
          (GOODS_ALIAS[w] || [w]).some((alt) => n.includes(alt.toLowerCase().replace(/\s+/g, "")))
        );
      })
      // 파는 곳이 많고 값이 싼 것부터. 잔은 술과 달리 "그 집 것"이 중요하지 않다.
      .sort((a, b) => (b.sellers || 0) - (a.sellers || 0) || a.low - b.low)[0] || null;

  const row = found
    ? { name: found.name, price: found.low, url: found.url, image: found.image, sellers: found.sellers || 0 }
    : null;
  goodsCache.set(keyword, { at: Date.now(), row });
  return row;
}

const goodsCache = new Map();
