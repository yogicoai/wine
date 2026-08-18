// 라쿠텐 이치바 — 사케의 일본 현지 소매가.
//
// 왜 일본인가. 국내에는 사케 가격을 주는 창구가 없다. 네이버 쇼핑은 닫혔고,
// 다나와는 사케가 27% 밖에 안 잡히는 데다 그마저 세트가 섞인다. 반면 일본
// 쪽은 사케가 본토 상품이라 값이 촘촘하다.
//
// 다만 이 값은 한국 가격이 아니다. 관세·주세·운임이 붙기 전이라 국내가와
// 직접 견줄 수 없다. 그래서 "최저가"가 아니라 "일본 현지가 · 참고"로만 적는다 —
// 우리가 이미 해외 소매가를 그렇게 다루고 있고(lib/priceInfo.js), 같은 자리에 얹는다.
//
// 열쇠는 무료다. https://webservice.rakuten.co.jp 에서 앱을 등록하면 발급된다.
// 하루 호출 한도가 있으므로(초당 1회 권장) 한꺼번에 몰아 부르지 않는다.

import { env } from "./env";

// 2026년에 창구가 바뀌었다. 옛 주소(app.rakuten.co.jp/services/api)도 아직 살아
// 있지만 새 앱으로 받은 열쇠는 이쪽만 받는다.
const ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

// 일본술 장르. 이걸 지정하지 않으면 술잔·안주·굿즈가 함께 나온다.
//   100317 > … > 日本酒 (라쿠텐 장르 트리)
const GENRE_SAKE = "510915";

export function hasRakutenKey() {
  return !!(env("RAKUTEN_APP_ID") && env("RAKUTEN_ACCESS_KEY"));
}

/**
 * 새 창구는 브라우저에서 부르는 것을 전제로 만들어졌다. 그래서 Referer 와
 * Origin 을 함께 보내야 하고, 그 주소가 앱에 등록돼 있어야 한다.
 *
 * 서버에서 부를 때는 이 둘이 저절로 붙지 않으므로 직접 적어 준다.
 * 등록한 주소와 글자 하나까지 같아야 한다 — 다르면 HTTP_REFERRER_NOT_ALLOWED 다.
 * (아무것도 안 보내면 REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING)
 */
function siteHeaders() {
  const site = String(env("RAKUTEN_SITE") || "").replace(/\/+$/, "");
  if (!site) return {};
  return { Referer: `${site}/`, Origin: site };
}

// 사케가 아닌 것 — 이름이 겹쳐 딸려 오는 것들
const NOT_SAKE =
  /グラス|お猪口|おちょこ|徳利|升\b|枡\b|セット|ギフト|詰め合わせ|飲み比べ|あて|おつまみ|Tシャツ|タオル|本\b|書籍/;

// 병이라는 표시. 일본 상품명은 용량을 거의 반드시 적는다.
const BOTTLE = /\d{3,4}\s*ml|\d(\.\d)?\s*L\b|一升|四合|720|1800/i;

/**
 * 라쿠텐에서 이 사케를 찾는다.
 *
 * @param {string} query 일본어 이름이 가장 잘 맞는다 (獺祭, 十四代).
 *                       우리 카탈로그의 sakenowa.brand 가 바로 그 값이다.
 * @returns {Promise<null | Array<{title, price, link, shop}>>}
 */
export async function searchRakuten(query, { hits = 20 } = {}) {
  const id = env("RAKUTEN_APP_ID");
  const key = env("RAKUTEN_ACCESS_KEY");
  if (!id || !key || !query) return null;

  const p = new URLSearchParams({
    applicationId: id,
    accessKey: key,
    keyword: query,
    genreId: GENRE_SAKE,
    hits: String(hits),
    sort: "+itemPrice", // 싼 것부터
    format: "json",
  });

  try {
    const res = await fetch(`${ENDPOINT}?${p}`, {
      headers: siteHeaders(),
      // 값이 하루에도 바뀌지만 우리는 범위만 쓰므로 여섯 시간이면 넉넉하다
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // 새 창구는 Items 안에 Item 을 한 겹 더 싸서 주기도 한다. 둘 다 받는다.
    const items = Array.isArray(data.Items) ? data.Items : [];
    return items
      .map((row) => {
        const it = row.Item || row;
        return {
          title: String(it.itemName || ""),
          price: Number(it.itemPrice) || 0,
          link: it.itemUrl || "",
          shop: it.shopName || "",
        };
      })
      .filter((it) => it.title && it.price);
  } catch {
    return null;
  }
}

/**
 * 이 사케의 것만 남긴다.
 *
 * 일본 상품명은 길고 수식이 많다("【送料無料】獺祭 純米大吟醸 磨き三割九分 720ml 箱付").
 * 그래서 이름이 통째로 들어 있는지만 보고, 술이 아닌 것과 묶음을 걷어낸다.
 */
export function keepSake(query, items) {
  const q = String(query || "").trim();
  if (!q) return [];
  return (items || []).filter(
    (it) =>
      it.title.includes(q) &&
      !NOT_SAKE.test(it.title) &&
      BOTTLE.test(it.title) &&
      // 미니어처와 잘못 붙은 값을 자른다. 300엔짜리 사케는 없다.
      it.price >= 500 &&
      it.price <= 500000
  );
}

/**
 * 일본 현지가 범위. 한 병 값을 알기 어려우므로 아래쪽만 본다 —
 * 위쪽에는 일승병(1.8L)과 상자 포장이 섞여 값이 부풀려진다.
 *
 * @returns {null | {low, high, sampled, sample}}
 */
export function japanPrice(query, items) {
  const good = keepSake(query, items).sort((a, b) => a.price - b.price);
  if (!good.length) return null;
  // 아래쪽 절반만 본다. 위쪽 절반은 대개 큰 병이거나 선물 포장이다.
  const half = good.slice(0, Math.max(1, Math.ceil(good.length / 2)));
  return {
    low: half[0].price,
    high: half[half.length - 1].price,
    sampled: good.length,
    sample: good[0].title.slice(0, 60),
  };
}

/**
 * 일본에서 이 사케를 찾아보는 주소.
 *
 * 열쇠가 없어도 쓸 수 있다 — API 가 아니라 그냥 검색 주소다.
 * (서버에서 열어 보면 아카마이가 막지만, 사람이 브라우저로 열면 정상이다)
 *
 * 상품 하나를 콕 집지 않는 이유는 사케가 계절 상품이라 품절이 잦기 때문이다.
 * 검색으로 보내면 그때 살아 있는 것이 나온다.
 *
 * @param {string} japaneseName さけのわ 에서 받아 둔 원어 이름 (獺祭, 十四代)
 */
export function rakutenSearchUrl(japaneseName) {
  const q = String(japaneseName || "").trim();
  if (!q) return null;
  return `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(q)}/`;
}
