// 11번가 오픈 API — 네이버 쇼핑 검색이 문을 닫은 뒤의 가격 출처.
//
// 네이버 쇼핑 검색 API는 2026-07-31 에 종료됐다(lib/naver.js 주석 참고).
// 종료된 것을 되살릴 방법은 없으므로 다른 문을 연다.
//
// 후보를 실제로 두드려 보고 고른 결과다.
//   11번가 오픈 API   200 응답, 키만 발급하면 상품·가격을 준다  ← 채택
//   다나와 오픈 API   컴퓨터·가전 중심, 주류 카테고리가 없다
//   쿠팡 파트너스     승인 조건에 판매 실적이 걸려 있다
//
// 키는 11번가 OPEN API CENTER 에서 무료로 발급한다(판매자 계정이 아니어도 된다).
//   https://openapi.11st.co.kr → 서비스 등록·확인 → 32자리 Key
//   .env.local 에 ELEVENST_KEY=... 한 줄이면 이 파일이 살아난다.
//
// 주의 — 한국은 주류 통신판매가 전통주를 빼면 금지라, 11번가에서도 일반 주류는
// 매장 픽업(스마트오더) 상품으로 올라온다. 그래서 여기서 얻는 값은
// "지금 이 가격에 배송된다"가 아니라 "이 술이 대략 얼마짜리인가"에 가깝다.
// 화면에서도 그렇게만 말한다.

import { env } from "./env";
import { isNotDrink } from "./notDrink";

const ENDPOINT = "http://openapi.11st.co.kr/openapi/OpenApiService.tmall";

export function hasElevenstKey() {
  return !!env("ELEVENST_KEY");
}

/** XML 한 덩어리에서 태그 값을 꺼낸다 (CDATA 포함) */
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1].trim() : "";
}

/**
 * 11번가는 EUC-KR XML 로 답한다. 그대로 UTF-8 로 읽으면 한글이 깨진다.
 * Node 24 는 full ICU 를 포함하므로 euc-kr 디코더를 쓸 수 있다.
 */
async function fetchXml(url) {
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  const buf = await res.arrayBuffer();
  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

// 병에만 붙는 표시 — 술을 파는 글은 용량이나 도수를 거의 반드시 적는다.
// (lib/naver.js 와 같은 판단 기준을 쓴다. 두 출처의 결과가 어긋나지 않게)
const BOTTLE_MARK = /\d+\s*(ml|mL|ML|리터)\b|\d+(\.\d+)?\s*L\b|\d+(\.\d+)?\s*도(?![시자])|\d+(\.\d+)?\s*%/;

// 값이 술 한 병 값으로 말이 되는 범위. 잔·안주·굿즈가 섞여 들어오면 평균이 무너진다.
const MIN_BOTTLE_PRICE = 4000;
const MAX_BOTTLE_PRICE = 30_000_000;

/**
 * 상품 검색.
 * @param {"liquor"|"food"|"goods"} type 술이면 술이 아닌 것을 걸러 낸다
 * @returns {Promise<object[]>} { title, link, image, price, mall, direct }
 */
export async function searchElevenst(query, type = "liquor") {
  if (!hasElevenstKey() || !query) return [];

  const url =
    `${ENDPOINT}?key=${encodeURIComponent(env("ELEVENST_KEY"))}` +
    `&apiCode=ProductSearch&keyword=${encodeURIComponent(query)}&pageSize=40&sortCd=CP`;

  const xml = await fetchXml(url);
  if (/<ErrorCode>/.test(xml)) {
    const code = tag(xml, "ErrorCode");
    const msg = tag(xml, "ErrorMessage");
    throw new Error(`11st ${code}: ${msg}`);
  }

  const blocks = xml.match(/<Product>[\s\S]*?<\/Product>/g) || [];
  const out = [];
  for (const b of blocks) {
    const title = tag(b, "ProductName").replace(/<[^>]+>/g, "").trim();
    if (!title) continue;
    // 11번가는 정가(ProductPrice)와 판매가(SalePrice)를 함께 준다 — 실제로 내는 값을 쓴다
    const price = Number(String(tag(b, "SalePrice") || tag(b, "ProductPrice")).replace(/[^\d]/g, ""));
    if (!price || price < MIN_BOTTLE_PRICE || price > MAX_BOTTLE_PRICE) continue;

    if (type === "liquor") {
      // 잔·오프너·안주·굿즈가 술 이름을 달고 올라온다 — 술만 남긴다
      if (isNotDrink(title)) continue;
      if (!BOTTLE_MARK.test(title)) continue;
    }

    out.push({
      title,
      link: tag(b, "ProductDetailUrl") || tag(b, "DetailPageUrl"),
      image: (tag(b, "ProductImage300") || tag(b, "ImageUrl") || "").replace(/^http:/, "https:"),
      price,
      mall: tag(b, "Seller") || "11번가",
      // 11번가는 로그인 없이 상품 페이지가 열린다
      direct: true,
      source: "11st",
    });
  }
  return out;
}
