// 온라인으로 살 수 있는 술과, 그 술을 파는 곳.
//
// 한국에서 주류 통신판매는 원칙적으로 금지다. 예외가 전통주 하나뿐이라,
// 여섯 앱 중 전통주 앱에서만 "지금 주문할 수 있다"고 말할 수 있다.
// 나머지는 아무리 링크를 잘 걸어도 그 페이지에서 결제가 되지 않는다.
//
// 근거 — 주세법 시행령 및 「주류의 통신판매에 관한 명령위임 고시」.
// 1998년 우체국 통신판매, 2017년 온라인 쇼핑몰 판매가 차례로 허용됐다.
// 모든 전통주가 되는 것은 아니고, 무형문화재 보유자·식품명인이 빚었거나
// 양조장 소재지의 농산물로 만들어 농림축산식품부 장관의 제조면허 추천을
// 받은 것에 한한다. 우리 카탈로그는 그 구분까지 갖고 있지 않으므로
// 화면에서도 "대개 가능하다"까지만 말하고 단정하지 않는다.
//
// 우리는 파는 사람이 아니라 링크만 거는 쪽이다. 국세청 고시 해석상
// 거래에 직접 개입하지 않고 통신판매 수단만 제공하는 자는
// 「통신판매 수단제공자」라 주류 중개업 면허가 필요하지 않다.

/** 온라인 주문이 되는 주종 */
export const ONLINE_SALE_OK = new Set(["traditional", "makgeolli", "soju"]);

/**
 * 파는 곳 — 검색 주소만 만든다. 제휴도 API도 아니라 비용이 들지 않는다.
 *
 * 상품 하나를 콕 집어 걸지 않는 이유는, 전통주는 같은 술이라도 양조장이
 * 직접 파는 곳과 편집숍이 갈려 있고 품절이 잦기 때문이다. 검색으로 보내면
 * 그때 살아 있는 판매처가 그대로 나온다.
 */
// 주소는 실제로 열리는지 확인하고 적었다. 200 이 아닌 것과 없는 도메인은 뺐다.
//   soolmarket.com     200  /product/search.html?keyword=
//   sooldamhwa.com     200  /search?keyword=
//   soolmall.com       연결 실패 — 뺐다
// 술담화와 술마켓은 검색 결과를 브라우저에서 그리므로 서버 응답만으로는
// 결과 건수를 확인할 수 없다. 그래서 확실한 네이버쇼핑을 맨 앞에 둔다.
export function onlineShops(name) {
  const q = encodeURIComponent(String(name || "").trim());
  if (!q) return [];
  return [
    {
      name: "네이버쇼핑",
      note: "가격 비교",
      url: `https://search.shopping.naver.com/search/all?query=${q}`,
    },
    {
      name: "술담화",
      note: "전통주 구독",
      url: `https://www.sooldamhwa.com/search?keyword=${q}`,
    },
    {
      name: "술마켓",
      note: "전통주 전문",
      url: `https://www.soolmarket.com/product/search.html?keyword=${q}`,
    },
  ];
}
