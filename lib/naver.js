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
export async function searchShop(q, type = "liquor", { display = 20, fresh = false } = {}) {
  if (!hasNaverKeys()) return null;

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=${display}&sort=sim`,
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

// 최저가 (도매 묶음 상품 제외를 위해 하위 10% 이상치는 버림)
export function lowestPrice(items) {
  const prices = (items || []).map((it) => it.price).filter(Boolean).sort((a, b) => a - b);
  if (!prices.length) return null;
  const idx = prices.length >= 5 ? 1 : 0; // 최저가 1건은 미끼일 수 있어 두 번째부터
  return prices[idx];
}
