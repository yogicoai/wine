// 네이버쇼핑 검색 공용 모듈 (구매 정보 / 안주 추천 / 가격 추적 / 빈티지 비교에서 재사용)

const FILTERS = {
  liquor: (cats) => /주류|와인|위스키|양주|사케|맥주|전통주|소주|브랜디|리큐르/.test(cats),
  // 안주용 식품: 식품 카테고리이되 주류는 제외
  food: (cats) =>
    /식품|축산|수산|농산|치즈|유제품|간편|과일|견과|delicatessen/i.test(cats) && !/주류/.test(cats),
};

import { env } from "./env";
import { isNotDrink } from "./notDrink";
import { unfortis, isWeakToken } from "./match";

export function hasNaverKeys() {
  return !!(env("NAVER_CLIENT_ID") && env("NAVER_CLIENT_SECRET"));
}

// 쇼핑 검색 API는 2026년 7월 31일 종료됐다. 네이버 공식 답변이다.
//
//   "기존 네이버 개발자센터에서 제공하던 [검색] 내 쇼핑/책/전문자료 API는
//    26년 7월 31일 서비스 종료되었습니다. 이에 따라 본 네이버 클라우드
//    플랫폼의 NAVER API HUB에서도 해당 3개 API는 제공하지 않습니다."
//
// 실측도 정확히 일치한다. 같은 키·같은 시각에
//   shop · book · doc  → 404 SE05
//   블로그·이미지·뉴스·카페·지식iN·백과·웹문서·지역 → 200
// 종료된 셋만 죽어 있다.
//
// 그러므로 되살릴 방법은 없다. 새 발급처(NAVER API HUB)에도 없고,
// 요금표에도 항목이 없다. 키를 새로 받거나 파트너로 등록해도 달라지지 않는다.
//
// 우리 수확이 7월 30일까지 정상이었고 31일부터 0건인 것이 이 날짜와 맞는다.
//
// 남은 일 — 이미지 검색은 살아 있으나 개발자센터가 2027-06-30 에 지원을
// 끝내므로 그 전에 API HUB 로 옮겨야 한다. 주소와 헤더가 함께 바뀐다.
//   https://openapi.naver.com/v1/search/image
//     → https://naverapihub.apigw.ntruss.com/search/v1/image
//   X-Naver-Client-Id / -Secret
//     → X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
// 요금은 지금과 같다 (월 775,000건까지 무료, 일 25,000건 제한).
//
// 한 번 확인하면 다시 두드리지 않는다. 카탈로그 4,500건을 훑는 작업에서
// 없는 문을 4,500번 두드리면 시간만 버리고 결과는 같다.
let shopRetired = false;
export function isShopRetired() {
  return shopRetired;
}

// 값을 못 받아도 살 곳은 알려 줄 수 있다. 검색 결과 페이지는 API가 아니라
// 그냥 주소라서 키도, 허가도, 비용도 들지 않는다.
export function shopSearchUrl(q) {
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q || "")}`;
}

// 쇼핑 API는 내려갔지만 이미지 검색은 살아 있고, 그 결과 안에 네이버쇼핑이
// 서비스하는 상품 사진이 섞여 들어온다. 죽은 쇼핑 API가 주던 it.image 와
// 같은 호스트, 같은 사진이다 — 끊긴 것을 같은 성격으로 되돌리는 것이지
// 새로운 출처를 끌어오는 게 아니다.
//
// 호스트를 가리는 이유는 두 가지다.
//   ① 이미지 검색은 디시인사이드·핀터레스트·뉴스 사진까지 함께 준다.
//      상업 앱에 남의 커뮤니티 사진을 붙일 수는 없다.
//   ② 네이버 CDN 중 일부(dthumb-phinf)는 외부 도메인에서 부르면 403 이다.
//      쇼핑 상품 호스트는 참조를 가리지 않아 실제로 화면에 뜬다.
const SHOP_IMAGE_HOST = /^shop(ping)?\d*[-.]phinf\.(naver|pstatic)\.net$/i;

// 병에만 붙는 표시. 술을 파는 글은 용량이나 도수를 거의 반드시 적는다.
const BOTTLE_MARK = /\d+\s*(ml|mL|ML|리터)\b|\d+(\.\d+)?\s*L\b|\d+(\.\d+)?\s*도(?![시자])|\d+(\.\d+)?\s*%/;

function isShopImage(url) {
  try {
    return SHOP_IMAGE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// 상품 제목에서 사진과 무관한 꼬리를 떼어 낸다.
//   "쿠보타 준마이다이긴죠 15도 720ml"        → "쿠보타 준마이다이긴죠"
//   "[갤러리아] 소믈리에 블랙타이 : 갤러리아백화점" → "소믈리에 블랙타이"
function cleanShopTitle(title) {
  return String(title || "")
    .replace(/\s*:\s*[^:]*$/, " ") // 끝에 붙는 판매처 이름
    .replace(/\[[^\]]*\]/g, " ") // [갤러리아] 같은 머리표
    .replace(/\d+(\.\d+)?\s*(도|%|ml|mL|L|리터|kg|g|년산|개|병|입)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 판매처 표기는 된소리를 즐겨 쓴다 — 우리 이름이 "카베르네"면 상품 제목은
// "까베르네"다. 그대로 두면 맞는 사진이 이름 대조에서 떨어져 나간다.
const compact = (s) =>
  unfortis(String(s || "").toLowerCase().normalize("NFKC")).replace(/[^\p{L}\p{N}]/gu, "");

/**
 * 이 사진이 정말 이 술의 사진인가.
 *
 * 카탈로그끼리 대조하는 findLooseMatch 는 여기에 쓸 수 없다. 상품 제목은
 * "쿠보타 준마이다이긴죠 15도 720ml" 처럼 낱말이 붙어 있고 용량·도수가 섞여
 * 있어서, 토큰이 어긋나 맞는 사진까지 떨어져 나간다. 실제로 22건 중 4건만
 * 통과했고 코인트로·양하대곡이 그 때문에 탈락했다.
 *
 * 그래서 문자열 포함으로 본다. 다만 짧은 이름은 그것만으로 위험하다 —
 * "발사믹 … 모데나의 캄파리 식초"에도 '캄파리'가 들어 있다. 상품 제목은
 * 팔려는 물건을 앞에 세우므로, 짧은 이름은 앞머리에 나올 때만 받는다.
 */
export function imageTitleMatches(query, title) {
  const clean = cleanShopTitle(title);
  if (!clean) return false;
  const q = compact(query);
  const t = compact(clean);
  if (!q || !t) return false;

  const at = t.indexOf(q);
  if (at >= 0) return q.length >= 8 || at <= 6;

  // 이름이 통째로 들어 있지 않으면 낱말 단위로 본다.
  // 샤또·크뤼·도멘처럼 수천 종이 함께 쓰는 낱말은 증거가 되지 못한다 —
  // 이걸 세면 "샤또 도르비에 크뤼"가 "샤또 라기올 그랑크뤼"(칼 브랜드)에 붙는다.
  const words = String(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !isWeakToken(w));
  if (words.length < 2) return false;
  const found = words.filter((w) => t.includes(compact(w))).length;
  return found >= 2 && found / words.length >= 0.6;
}

/**
 * 제품 이름으로 네이버쇼핑 상품 사진 주소를 찾는다.
 * 이름이 어긋난 사진(다른 술)을 거르려고 제목을 대조한다.
 * @returns {Promise<null | {image: string, title: string}>}
 */
export async function searchProductImage(q, { display = 100, debug = false } = {}) {
  if (!hasNaverKeys() || !q) return null;
  const res = await fetch(
    `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=${display}&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": env("NAVER_CLIENT_ID"),
        "X-Naver-Client-Secret": env("NAVER_CLIENT_SECRET"),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`네이버 이미지 API ${res.status}`);
  const data = await res.json();
  const shop = (data.items || [])
    .map((it) => ({ image: it.link, title: String(it.title || "").replace(/<[^>]+>/g, "") }))
    .filter((it) => isShopImage(it.image));
  // 판매처는 잔·거치대·식초도 술 이름을 달고 판다. 수확에서 쓰는 거름망을 그대로 쓴다.
  //
  // 다만 거름망만으로는 모자란다. 죽은 쇼핑 API는 상품 카테고리(주류)를 함께
  // 줘서 술이 아닌 것을 잘라 냈는데, 이미지 검색에는 그 칸이 없다. 그래서
  // 병에만 붙는 표시 — 용량과 도수 — 를 요구한다. 술을 파는 글은 거의 예외
  // 없이 "750ml"나 "40도"를 적고, 마그넷·공병·벤치커버는 적지 않는다.
  const hit = shop.find(
    (it) =>
      BOTTLE_MARK.test(it.title) &&
      !isNotDrink(cleanShopTitle(it.title)) &&
      imageTitleMatches(q, it.title)
  );
  if (debug) return { hit: hit || null, candidates: shop.slice(0, 4).map((s) => s.title) };
  return hit || null;
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
  if (shopRetired) return null;

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
  // SE05 는 "그런 검색 api 가 없다"는 뜻이다. 키가 틀렸거나 한도를 넘은 것과는
  // 성격이 달라, 다시 불러도 영원히 같은 답이 온다. 여기서 문을 닫아 둔다.
  if (res.status === 404) {
    const body = await res.text();
    if (body.includes("SE05")) {
      if (!shopRetired) console.warn("[naver] 쇼핑 검색 API가 응답하지 않습니다 (SE05). 가격·구매 정보를 끕니다.");
      shopRetired = true;
      return null;
    }
  }
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
