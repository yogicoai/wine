// ScraperAPI — 네이버 쇼핑 가격을 다시 받아오기 위한 창구.
//
// 왜 필요한가.
// 네이버 쇼핑 검색 API가 2026-07-31 에 종료됐다. 닫힌 것은 API 이고 상품
// 페이지는 그대로 살아 있다 — 우리 DB에 7월 31일까지의 가격 이력이 남아 있고
// 그 마지막 날이 종료일과 정확히 겹친다. 그러니 페이지를 읽어 오면 값을
// 되살릴 수 있다. 다만 네이버는 서버에서 오는 요청을 418 로 막으므로
// 중간에서 대신 받아 주는 곳이 필요하다.
//
// 비용 구조 (2026-08 기준). 요청 하나가 몇 "크레딧"인지가 요금을 정한다.
//   기본                 1
//   + JS 렌더링          10
//   + 프리미엄 프록시     10
//   프리미엄 + 렌더링     25
//
// 네이버에 어느 조합이 필요한지에 따라 월 요금이 스물다섯 배까지 갈린다.
// 그래서 무료 구간으로 먼저 재고 나서 계약한다 (scripts/_test-scraperapi.mjs).

import { env } from "./env";

const BASE = "https://api.scraperapi.com";

export function hasScraperKey() {
  return !!env("SCRAPERAPI_KEY");
}

/**
 * 네이버 쇼핑에서 이 이름으로 검색했을 때의 결과 주소.
 *
 * 두 가지를 쓴다.
 *   json  네이버가 화면을 그릴 때 제 서버에 묻는 자리. 열리면 렌더링이 필요 없어
 *         1 크레딧으로 끝난다. 다만 공식 창구가 아니라 언제든 모양이 바뀔 수 있다.
 *   html  사람이 보는 화면. 확실하지만 자바스크립트로 그려지므로 렌더링이 필요할
 *         수 있고, 그러면 열 배가 된다.
 */
export function naverShopUrl(query, kind = "json") {
  const q = encodeURIComponent(String(query || "").trim());
  if (kind === "json") {
    return `https://search.shopping.naver.com/api/search/all?sort=rel&pagingIndex=1&pagingSize=20&productSet=total&query=${q}`;
  }
  return `https://search.shopping.naver.com/search/all?query=${q}`;
}

/**
 * ScraperAPI 를 거쳐 한 장 받아온다.
 *
 * @param {string} target 받아올 주소
 * @param {object} opts   render 자바스크립트를 그린다 · premium 프리미엄 프록시
 * @returns {Promise<{ok, status, body, credits}>}
 */
export async function fetchVia(target, { render = false, premium = false, timeout = 70000 } = {}) {
  const key = env("SCRAPERAPI_KEY");
  if (!key) return { ok: false, status: 0, body: "", credits: 0, error: "키 없음" };

  const p = new URLSearchParams({ api_key: key, url: target, country_code: "kr" });
  if (render) p.set("render", "true");
  if (premium) p.set("premium", "true");

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}?${p}`, { signal: ctl.signal });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body,
      // 실제 차감량은 응답 헤더에 오지 않는다. 요금표대로 계산해 둔다.
      credits: 1 + (render ? 10 : 0) + (premium ? 10 : 0),
    };
  } catch (err) {
    return { ok: false, status: 0, body: "", credits: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** 남은 크레딧 — 시험 전후로 실제 차감량을 확인할 때 쓴다. */
export async function accountInfo() {
  const key = env("SCRAPERAPI_KEY");
  if (!key) return null;
  const res = await fetch(`${BASE}/account?api_key=${key}`);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** 이 주소를 받는 데 몇 크레딧이 드는지 미리 묻는다 (차감 없음). */
export async function urlCost(target, { render = false, premium = false } = {}) {
  const key = env("SCRAPERAPI_KEY");
  if (!key) return null;
  const p = new URLSearchParams({ api_key: key, url: target });
  if (render) p.set("render", "true");
  if (premium) p.set("premium", "true");
  const res = await fetch(`${BASE}/account/urlcost?${p}`);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// ── 값 뽑아내기 ─────────────────────────────────────────────
// 네이버가 주는 모양이 바뀔 수 있으므로 한 곳에 모아 둔다.

/** 내부 JSON 응답에서 상품 목록을 꺼낸다. 모양이 다르면 빈 배열. */
export function itemsFromJson(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  const list = data?.shoppingResult?.products || data?.products || [];
  return list
    .map((it) => ({
      title: String(it.productTitle || it.productName || "").replace(/<[^>]+>/g, ""),
      price: Number(it.price || it.lowPrice || it.purchasePrice || 0) || null,
      mall: it.mallName || it.mallProductUrl || "",
      link: it.crUrl || it.mallProductUrl || it.adcrUrl || "",
      image: it.imageUrl || it.imageUrl1 || null,
    }))
    .filter((it) => it.title && it.price);
}

/**
 * 사람이 보는 화면에서 값을 줍는다.
 *
 * 네이버는 화면을 그릴 자료를 __NEXT_DATA__ 나 비슷한 덩어리에 함께 실어 보낸다.
 * 그것이 있으면 자바스크립트를 그리지 않고도 값을 얻는다 — 열 배를 아낀다.
 */
export function itemsFromHtml(body) {
  const m =
    body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/) ||
    body.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
  if (m) {
    const found = itemsFromJson(m[1]);
    if (found.length) return found;
    // 덩어리 안 어딘가에 상품 배열이 있을 수 있다 — 값이 붙은 것만 훑는다
    try {
      const deep = JSON.stringify(JSON.parse(m[1]));
      const hits = [...deep.matchAll(/"productTitle":"(.*?)".*?"price":"?(\d{3,})"?/g)];
      if (hits.length) {
        return hits.map((h) => ({
          title: h[1].replace(/<[^>]+>/g, ""),
          price: Number(h[2]),
          mall: "",
          link: "",
          image: null,
        }));
      }
    } catch {
      /* 모양이 바뀐 것이다 */
    }
  }
  return [];
}
