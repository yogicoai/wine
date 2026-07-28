// 네이버쇼핑 검색 공용 모듈 (구매 정보 / 안주 추천 / 가격 추적 / 빈티지 비교에서 재사용)

const FILTERS = {
  liquor: (cats) => /주류|와인|위스키|양주|사케|맥주|전통주|소주|브랜디|리큐르/.test(cats),
  // 안주용 식품: 식품 카테고리이되 주류는 제외
  food: (cats) =>
    /식품|축산|수산|농산|치즈|유제품|간편|과일|견과|delicatessen/i.test(cats) && !/주류/.test(cats),
};

import { env } from "./env";

export function hasNaverKeys() {
  return !!(env("NAVER_CLIENT_ID") && env("NAVER_CLIENT_SECRET"));
}

/**
 * @param {object} opts
 * @param {boolean} opts.fresh 캐시를 건너뛴다. 대량 적재처럼 결과를 신뢰해야 하는 경우 사용.
 *   (일시적 실패로 빈 응답이 캐시되면 1시간 동안 계속 빈 값이 나오는 문제를 피한다)
 */
// 외래어 표기법(카·타·파)과 실제 유통 표기(까·따·빠)가 갈리는 술이 많다.
// 네이버 검색은 이 둘을 다르게 취급해서, "카시예로 델 디아블로"는 0건이지만
// "까시예로 델 디아블로"는 결과가 나온다. 샤또/샤토, 딸보/탈보도 마찬가지다.
//
// 갈리는 것은 외래어의 파열음(ㅋ/ㄲ, ㅌ/ㄸ, ㅍ/ㅃ)뿐이다.
// ㅅ/ㅆ, ㅈ/ㅉ까지 바꾸면 "카시예로"가 "까씨예로"가 되어 오히려 못 찾는다.
const TO_FORTIS = { 15: 1, 16: 4, 17: 8 }; // ㅋ→ㄲ, ㅌ→ㄸ, ㅍ→ㅃ
const TO_PLAIN = { 1: 15, 4: 16, 8: 17 };

function swapInitials(text, table) {
  let changed = false;
  const out = [...text].map((ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return ch; // 한글 음절이 아니면 그대로
    const initial = Math.floor(code / 588);
    const next = table[initial];
    if (next === undefined) return ch;
    changed = true;
    return String.fromCharCode(0xac00 + next * 588 + (code % 588));
  });
  return changed ? out.join("") : null;
}

/** 같은 술을 가리키는 다른 표기 (최대 2개) */
export function spellingVariants(q) {
  return [swapInitials(q, TO_FORTIS), swapInitials(q, TO_PLAIN)].filter((v) => v && v !== q);
}

/**
 * 표기 변형까지 시도한다. 첫 검색이 비었을 때만 추가로 부르므로
 * 정상적으로 찾히는 술에는 호출이 늘지 않는다. (네이버 API는 무료)
 */
export async function searchShop(q, type = "liquor", opts = {}) {
  const first = await searchOnce(q, type, opts);
  if (first === null || first.length) return first;

  for (const variant of spellingVariants(q)) {
    const again = await searchOnce(variant, type, opts);
    if (again?.length) return again;
  }
  return first;
}

async function searchOnce(q, type = "liquor", { display = 20, fresh = false, start = 1 } = {}) {
  if (!hasNaverKeys()) return null;

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=${display}&start=${start}&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": env("NAVER_CLIENT_ID"),
        "X-Naver-Client-Secret": env("NAVER_CLIENT_SECRET"),
      },
      ...(fresh ? { cache: "no-store" } : { next: { revalidate: 3600 } }),
    }
  );
  if (!res.ok) throw new Error(`네이버 API ${res.status}`);
  const data = await res.json();
  const pass = FILTERS[type] || FILTERS.liquor;

  const mapped = (data.items || [])
    .filter((it) => pass([it.category1, it.category2, it.category3, it.category4].join(">")))
    .map((it) => {
      // 스마트스토어 링크(/main/products/)는 브라우저에서 로그인을 요구함 →
      // 자체 도메인 판매처를 "바로 구매 가능(direct)"으로 표시해 우선 노출
      let direct = false;
      try {
        direct = !/(^|\.)naver\.com$/.test(new URL(it.link).hostname);
      } catch {
        /* 링크 파싱 실패 시 direct=false */
      }
      return {
        title: it.title.replace(/<[^>]+>/g, ""),
        link: it.link,
        image: it.image,
        price: Number(it.lprice) || null,
        mall: it.mallName,
        category: [it.category2, it.category3].filter(Boolean).join(" · "),
        direct,
      };
    });

  return [...mapped.filter((it) => it.direct), ...mapped.filter((it) => !it.direct)];
}

// 도매/미끼 상품을 피해 대표 상품 하나 고르기
export function pickRepresentative(items) {
  if (!items?.length) return null;
  const priced = items.filter((it) => it.price);
  const pool = priced.filter((it) => it.direct).length ? priced.filter((it) => it.direct) : priced;
  return pool.length ? pool[Math.floor(pool.length / 4)] : items[0];
}

// 검색 결과에는 소용량·미니어처·다른 제품·미끼가 섞여 들어온다.
// "무조건 두 번째로 싼 값"은 이런 것을 걸러내지 못하고, 반대로 정상적인 최저가를
// 버리기도 한다. 중앙값에서 크게 벗어난 아래쪽 값을 걷어내는 편이 안정적이다.
function plausiblePrices(items) {
  const prices = (items || [])
    .map((it) => it.price)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (prices.length < 4) return prices; // 표본이 적으면 판단 근거가 없다

  const median = prices[Math.floor(prices.length / 2)];
  return prices.filter((p) => p >= median * 0.4);
}

/** 대표 최저가 — 셀러 가치·가격 이력·특가 판정·와인 리스트 배수가 모두 이 값을 쓴다 */
export function lowestPrice(items) {
  const prices = plausiblePrices(items);
  return prices.length ? prices[0] : null;
}

/**
 * 화면에 "이 술은 얼마"라고 단언해도 되는지 판단한다.
 * 값이 넓게 흩어져 있으면 검색어가 넓어 여러 제품이 섞인 것이다.
 * (예: "발렌타인" → 파이니스트 3만원과 30년 49만원이 한 결과에 들어온다)
 * 그런 경우엔 틀린 숫자를 보여 주느니 아무 숫자도 보여 주지 않는다.
 */
export function priceReference(items) {
  const prices = plausiblePrices(items);
  if (prices.length < 3) return null;

  const spread = prices[prices.length - 1] / prices[0];
  if (spread > 4) return null;

  return { low: prices[0], sampled: prices.length };
}
