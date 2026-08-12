// 주종에 맞는 가게를 찾기 위한 검색어와, 술과 무관한 결과를 거르는 기준.
//
// 지역검색은 가게 이름과 분류로만 찾는다. 가게가 무엇을 들여놨는지는 알 수 없다.
// 그래서 "이 술이 있는 곳"이라고 말할 수 없고 "이런 술을 다루는 곳"까지가 정직하다.
// 화면 문구도 그렇게 적혀 있다.

// ── 마실 곳 ──
// 주종마다 가게 종류가 다르다. 사케는 이자카야, 위스키는 바, 맥주는 브루펍이다.
// 이것이 앱마다 화면이 달라지는 지점이라, 목록 제목(label)도 여기서 함께 낸다.
// 앱이 아니라 주종을 보는 이유는, 사케 렌즈에서 맥주를 찍었을 때 "이자카야"라
// 적어 놓고 수제맥주집을 찾아 주면 말과 결과가 어긋나기 때문이다.
//
// term  실제로 네이버에 넣는 말. "전통주점"으로 부르면 엉뚱하게 바(BAR)가 나와
//       "전통주"로 적었고, 맥주에 "펍"을 붙이면 결과가 다섯에서 둘로 줄어 뺐다.
// label 화면에 적는 말. 검색어를 그대로 쓰면 "근처 전통주"처럼 어색해진다.
const DRINK_TERM = {
  wine: { term: "와인바", label: "근처 와인바" },
  sake: { term: "이자카야", label: "근처 이자카야" },
  beer: { term: "수제맥주", label: "근처 수제맥주집" },
  whisky: { term: "위스키 바", label: "근처 위스키 바" },
  traditional: { term: "전통주", label: "근처 전통주점" },
  makgeolli: { term: "막걸리집", label: "근처 막걸리집" },
  soju: { term: "전통주", label: "근처 전통주점" },
  spirits: { term: "칵테일 바", label: "근처 칵테일 바" },
  brandy: { term: "위스키 바", label: "근처 바" },
  baijiu: { term: "중식주점", label: "근처 중식주점" },
  tequila: { term: "칵테일 바", label: "근처 칵테일 바" },
  rum: { term: "칵테일 바", label: "근처 칵테일 바" },
  gin: { term: "칵테일 바", label: "근처 칵테일 바" },
  vodka: { term: "칵테일 바", label: "근처 칵테일 바" },
  liqueur: { term: "칵테일 바", label: "근처 칵테일 바" },
  highball: { term: "하이볼 바", label: "근처 하이볼 바" },
};
const DRINK_FALLBACK = { term: "술집", label: "근처 술집" };

// ── 살 곳 ──
// 주종을 넣으면 안 된다. "성수동 사케 판매점"은 이자카야 다섯 곳을 주고,
// "이태원 위스키 판매점"은 바 네 곳과 스테이크집을 준다. 가게 이름에 주종이
// 들어간 곳을 찾아 버리기 때문이다.
//
// 반면 "주류판매"는 전국 어디서 불러도 소매점만 나온다. 강남·성수동·홍대·종로·
// 부산 서면·제주시·대전 둔산동을 확인했고 모두 분류가 "쇼핑,유통>주류"였다.
// 어차피 국내 주류 소매점은 취급 주종이 넓어 주종별로 나눌 실익도 적다.
const BUY_TERM = "주류판매";

/** 주종에 맞는 검색어와 목록 제목 */
export function placeTerms(category) {
  const drink = DRINK_TERM[category] || DRINK_FALLBACK;
  return { drink: drink.term, drinkLabel: drink.label, buy: BUY_TERM };
}

// 지역 이름 없이 부르면 전국이 섞여 나오므로 반드시 앞에 붙인다.
export function placeQuery(area, term) {
  return `${String(area || "").trim()} ${term}`.trim();
}

// 마실 곳으로 받아들이는 분류. "술집>이자카야", "술집>와인" 처럼 온다.
// 지역명으로 검색하면 그 동네의 카페·식당이 함께 딸려 오므로 여기서 자른다.
const DRINK_CATEGORY = /^(술집|음식점>일식|음식점>주점)/;
// 살 곳은 소매점만 받는다. 여기를 느슨하게 두면 "위스키 바"가 판매점 자리에 앉는다.
const BUY_CATEGORY = /^쇼핑,유통>주류/;

// 수입사·본사·도매 지점은 소매점이 아니다. 주류 분류로 함께 나오지만
// 찾아가도 술을 살 수 없다 — "하이트진로 본사", "페르노리카 코리아",
// "하이트진로 특판광주지점".
const NOT_A_SHOP = /본사|본점사무소|주식회사|㈜|코리아$|인터내셔날|인터내셔널|특판/;

export function isDrinkPlace(place) {
  return DRINK_CATEGORY.test(String(place?.category || "")) && !NOT_A_SHOP.test(place?.name || "");
}

export function isBuyPlace(place) {
  return BUY_CATEGORY.test(String(place?.category || "")) && !NOT_A_SHOP.test(place?.name || "");
}

/** 분류 꼬리표만 뽑는다 — "술집>이자카야" → "이자카야" */
export function placeKind(place) {
  const parts = String(place?.category || "").split(">");
  return parts[parts.length - 1] || "";
}

/**
 * 지도 링크. 좌표가 있으면 그 자리를, 없으면 이름으로 찾게 한다.
 * 네이버 지도는 앱이 깔려 있으면 앱으로 열린다.
 */
export function mapLink(place) {
  const name = encodeURIComponent(place?.name || "");
  if (place?.lat && place?.lng) {
    return `https://map.naver.com/p/search/${name}?c=${place.lng},${place.lat},17,0,0,0,dh`;
  }
  return `https://map.naver.com/p/search/${name}`;
}

// 주소에서 구·동과 길 이름까지만 남긴다. 목록에서는 그 정도면 충분하고,
// 상세 주소까지 적으면 다섯 줄이 모두 길어져 읽기 어렵다.
export function shortAddress(address) {
  const parts = String(address || "").split(/\s+/);
  return parts.slice(1, 4).join(" ") || String(address || "");
}

// ── 메뉴로 가는 길 ──────────────────────────────────────────
// 메뉴 자체는 받을 수 없다. 지역검색에 그런 칸이 없고, 네이버 플레이스의 메뉴는
// 공개 API가 없다. 40곳을 확인해 보니 전화번호도 가게 설명도 한 곳도 오지 않았다.
//
// 다만 홈페이지 링크는 93%가 온다. 어디로 가느냐가 갈릴 뿐이다 —
//   인스타그램 46%   분위기 사진이지 메뉴가 아니다
//   캐치테이블 35%   메뉴가 있다
//   자체 홈페이지 19% 가게마다 다르다
// 그 링크를 이미 받아 두고도 화면에서는 쓰지 않고 있었다.

/** 링크가 어디로 가는지 미리 알려 준다 — 눌러 보고 알게 하지 않는다. */
export function linkLabel(url) {
  const h = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (/instagram\.com$/.test(h)) return "인스타그램";
  if (/catchtable\.co\.kr$/.test(h)) return "메뉴·예약";
  if (/blog\.naver\.com$/.test(h)) return "블로그";
  if (/(youtube\.com|youtu\.be)$/.test(h)) return "유튜브";
  return h ? "홈페이지" : "";
}

/**
 * 이 가게의 메뉴와 후기를 찾는 검색 주소.
 *
 * 결과를 우리가 골라 보여 주지는 않는다. 가게 이름이 흔하면 엉뚱한 것이 섞이기
 * 때문이다 — "지금이밤 성수 메뉴"를 찾으면 남영돈 고깃집과 인천 약국 목록이
 * 함께 나왔다. 링크만 걸고 고르는 일은 사람에게 맡긴다.
 */
export function menuSearchUrl(name, area = "") {
  const q = `${String(area || "").trim()} ${String(name || "").trim()} 메뉴`.trim();
  return `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(q)}`;
}
