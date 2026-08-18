// 다나와 — 네이버 쇼핑이 닫힌 뒤의 가격 출처.
//
// 왜 다나와인가.
// 네이버 쇼핑 검색 API 가 2026-07-31 에 종료됐다. 웹으로 우회할 수 있는지
// 다섯 조합을 다 시험했는데 전부 로그인 페이지로 튕겼다 — 기본, 프리미엄 프록시,
// 자바스크립트 렌더링, 그 조합, 모바일, 카탈로그 페이지까지. 네이버는 API 와
// 별개로 웹도 봇을 막고 있다. 주거용 IP 는 유료 플랜 전용인 데다 통해도 요청당
// 30~75 크레딧이라 값어치가 없다.
//
// 다나와는 통한다. 그것도 기본 요청 하나(1 크레딧)로 끝난다. 그리고 우리가
// 찾던 상품이 거기 있다 — "매장픽업", "와인25 (방문수령)" 같은 스마트오더
// 상품이 그대로 올라와 있다. 네이버가 모아 보여 주던 바로 그것들이다.
//
// 값이 맞는지는 우리에게만 있는 대조군으로 확인했다. 7월 31일까지 네이버에서
// 받아 둔 가격 이력과 맞대어 보니 1865 카베르네 소비뇽이 30,600 원으로 원
// 단위까지 같았다.
//
// 주종에 따라 잘 맞는 정도가 다르다 (2026-08 실측).
//   위스키 · 전통주가 가장 안정적이고, 사케는 경계선, 맥주와 와인은 쓸 수 없다.
// 와인이 약한 것은 다나와가 IT·가전이 본업이라 취급이 얕은 데다 이름이 다른
// 상품과 겹치기 때문이다 — "로버트 몬다비"는 자서전이, "까시예로 델 디아블로"는
// DELL 컴퓨터가 나온다. 그래서 믿을 만한 주종에서만 쓴다 (PRICE_READY).

import { env } from "./env";
import { isNotDrink } from "./notDrink";
import { unfortis } from "./match";

const ENDPOINT = "https://api.scraperapi.com";

export function hasPriceKey() {
  return !!env("SCRAPERAPI_KEY");
}

/**
 * 값을 믿고 쓸 수 있는 주종.
 *
 * 못 찾는 것은 조용히 지나가므로 해가 없지만, 절반도 못 찾는 주종에서
 * "목표가에 닿으면 알려 드립니다"라고 약속하면 오지 않는 알림을 기다리게 된다.
 * 실측 성공률이 낮은 와인은 넣지 않는다.
 */
// 2026-08 실측으로 정한 목록이다. 값이 맞게 나오는 것까지 확인한 주종만 넣는다.
//
//   위스키   5/8 · 발렌타인 17년 97,500 · 로얄 살루트 21년 185,000 — 값이 정확하다
//   전통주   6/8 · 화요 41 39,000 · 복순도가 손막걸리 11,160 — 값이 정확하다
//
//   사케     5/8 이지만 다른 제품을 잡는 일이 있다 (핫카이산 → 에치고데소로). 경계선이라 뺀다.
//   맥주     이름이 짧고 흔해 크게 어긋난다 —
//            "카스 프레시" → Fresh Water 라벤더 오일,  "하이네켄" → 비어 디스펜서 366,400원
//   와인     6/20 (30%). 다나와가 IT·가전이 본업이라 취급이 얕다.
//
// 못 찾는 것은 조용히 지나가므로 해가 없다. 문제는 엉뚱한 값을 가격이라고
// 내놓는 것이다 — 그것은 알림을 잘못 울린다.
export const PRICE_READY = new Set(["whisky", "traditional", "makgeolli", "soju"]);

export function priceReadyFor(category) {
  return PRICE_READY.has(category);
}

// 다나와가 주류에 붙이는 표식. 스마트오더 상품이 이렇게 올라온다.
const LIQUOR_MARK = /매장픽업|방문수령|와인25|주류|위스키\]|\[와인/;
// 병이라는 신호 — 용량·도수가 적혀 있다
const BOTTLE = /\d+\s*(ml|mL|ML)\b|\d+(\.\d+)?\s*L\b|\d+(\.\d+)?\s*도(?![시자])|\d+(\.\d+)?\s*%/;
// 술 이름과 겹치는 다른 물건. isNotDrink 로 거르고 남는 것들을 여기서 잡는다.
//
// 용량·도수가 적혀 있다고 술인 것이 아니다. 잔에도 "200ml"가 붙고 소스에도
// "260ml"가 붙는다. 실제로 이런 것들이 최저가로 뽑혔다 —
//   조니워커 블랙라벨 → 온더락잔 1개 200ml       7,500원
//   잭 다니엘        → 글루텐프리 허니 BBQ 소스 260ml  28,580원
//   산토리 가쿠빈     → 하이볼 컵 380ml           11,370원
//   화요 41         → 레이싱카 모의 훈련 장비      21,560원
// 값이 이상하게 싸면 대개 술이 아니라 곁다리다.
const NOT_A_DRINK =
  /소파|가구|책상|의자|컴퓨터|노트북|모니터|파워서플라이|SSD|그래픽카드|마사지|안마|중고|도서|출판|문학동네|한국경제신문|자서전|레이싱|훈련\s*장비|모의|온더락|록\s*글라스|로우볼|샷\s*글라스|위스키\s*컵|하이볼\s*컵|맥주\s*컵|유리컵|mL?\s*잔|잔\s*\d+\s*개|\d+\s*개\s*잔|전용\s*잔|잔\s*세트|텀블러|디캔터|디켄터|소스|시즈닝|드레싱|양념|분말|시럽|캔들|비누|샴푸/i;

// 한쪽에만 붙어 있으면 다른 술이다. 사진 고를 때 쓰던 것과 같은 생각이다 —
// "잭 다니엘 Old No.7" 자리에 "잭 다니엘 애플"이 붙은 적이 있다. 같은 집이지만 다른 술이다.
const EXPRESSION_MARKS = [
  /애플|허니|파이어|하니|시나몬|메이플/i,
  /무알콜|논알콜|알콜프리|제로\s/i,
  /하이볼|칵테일|리큐르/i,
  /미니어처|미니어쳐/i,
];

const compact = (s) => unfortis(String(s || "").toLowerCase()).replace(/[^\p{L}\p{N}]/gu, "");

/**
 * 이 상품이 정말 이 술인가.
 * 앞머리(대개 생산자나 상표)가 빠지면 다른 술이다 — 사진 고를 때와 같은 규칙이다.
 */
function nameMatches(query, title) {
  const t = compact(title);
  const words = String(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  if (!words.length || !t.includes(compact(words[0]))) return false;
  const found = words.filter((w) => t.includes(compact(w))).length;
  return found >= Math.min(2, words.length) && found / words.length >= 0.5;
}

/**
 * 다나와에서 이 이름으로 파는 것들.
 * 죽은 쇼핑 API 가 주던 것과 같은 모양으로 돌려준다 — 부르는 쪽을 고치지 않아도 된다.
 *
 * @returns {Promise<null | Array<{title, price, link, mall, image, direct}>>}
 *          null 은 "부를 수 없었다", 빈 배열은 "찾지 못했다"
 */
export async function searchDanawa(query, { timeout = 60000 } = {}) {
  const key = env("SCRAPERAPI_KEY");
  if (!key || !query) return null;

  const target = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(query)}`;
  const p = new URLSearchParams({ api_key: key, url: target, country_code: "kr" });

  let body;
  try {
    const res = await fetch(`${ENDPOINT}?${p}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    body = await res.text();
  } catch {
    return null;
  }

  const items = [];
  // 상품 이름과 값이 한 덩어리로 붙어 나온다. 모양이 바뀌면 여기만 고치면 된다.
  const ROW = /<p class="prod_name">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<strong>([\d,]+)<\/strong>/g;
  for (const m of body.matchAll(ROW)) {
    const title = String(m[2] || "").replace(/<[^>]+>/g, "").trim();
    const price = Number(String(m[3]).replace(/,/g, ""));
    if (!title || !price) continue;
    items.push({
      title,
      price,
      link: m[1] || target,
      mall: "다나와",
      image: null,
      // 매장픽업은 바로 살 수 있다는 뜻이다 (스마트오더)
      direct: LIQUOR_MARK.test(title),
    });
  }
  return items;
}

/**
 * 검색 결과에서 이 술이 아닌 것을 걷어낸다.
 * 거르고 나면 아무것도 안 남는 편이, 엉뚱한 값을 가격이라고 내놓는 것보다 낫다.
 */
export function keepRealDrinks(query, items) {
  return (items || []).filter(
    (it) =>
      !NOT_A_DRINK.test(it.title) &&
      !isNotDrink(it.title) &&
      !EXPRESSION_MARKS.some((re) => re.test(query) !== re.test(it.title)) &&
      (it.direct || BOTTLE.test(it.title)) &&
      nameMatches(query, it.title) &&
      // 미니어처와 곁다리를 자른다. 잔·소스가 술보다 싸게 붙는 일이 많다.
      it.price >= 8000 &&
      it.price <= 3000000
  );
}

/** 이 술의 값을 찾는다. 못 찾으면 null — 그때는 알림도 나가지 않는다. */
export async function priceOf(query, { category = null } = {}) {
  if (category && !priceReadyFor(category)) return null;
  const raw = await searchDanawa(query);
  if (!raw) return null;
  const good = keepRealDrinks(query, raw);
  if (!good.length) return null;
  return good.sort((a, b) => a.price - b.price);
}
