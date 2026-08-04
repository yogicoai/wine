// 주종에 맞는 가게를 찾기 위한 검색어와, 술과 무관한 결과를 거르는 기준.
//
// 지역검색은 가게 이름과 분류로만 찾는다. 가게가 무엇을 들여놨는지는 알 수 없다.
// 그래서 "이 술이 있는 곳"이라고 말할 수 없고 "이런 술을 다루는 곳"까지가 정직하다.
// 화면 문구도 그렇게 적혀 있다.

// ── 마실 곳 ──
// 주종마다 가게 종류가 다르다. 사케는 이자카야, 위스키는 바, 맥주는 펍이다.
// "전통주점"으로 부르면 엉뚱하게 바(BAR)가 나와서 "전통주"로 적는다.
const DRINK_TERM = {
  wine: "와인바",
  sake: "이자카야",
  beer: "수제맥주", // "펍"까지 붙이면 결과가 5건에서 2건으로 준다
  whisky: "위스키 바",
  traditional: "전통주",
  makgeolli: "막걸리집",
  soju: "전통주",
  spirits: "칵테일 바",
  brandy: "위스키 바",
  baijiu: "중식주점",
  tequila: "칵테일 바",
  rum: "칵테일 바",
  gin: "칵테일 바",
  vodka: "칵테일 바",
  liqueur: "칵테일 바",
  highball: "하이볼 바",
};

// ── 살 곳 ──
// 주종을 넣으면 안 된다. "성수동 사케 판매점"은 이자카야 다섯 곳을 주고,
// "이태원 위스키 판매점"은 바 네 곳과 스테이크집을 준다. 가게 이름에 주종이
// 들어간 곳을 찾아 버리기 때문이다.
//
// 반면 "주류판매"는 전국 어디서 불러도 소매점만 나온다. 강남·성수동·홍대·종로·
// 부산 서면·제주시·대전 둔산동을 확인했고 모두 분류가 "쇼핑,유통>주류"였다.
// 어차피 국내 주류 소매점은 취급 주종이 넓어 주종별로 나눌 실익도 적다.
const BUY_TERM = "주류판매";

/** 주종에 맞는 검색어 두 개 (마실 곳 · 살 곳) */
export function placeTerms(category) {
  return { drink: DRINK_TERM[category] || "술집", buy: BUY_TERM };
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
