// 국가명 → 국가 코드.
//
// 와인에서 국가는 장식이 아니라 정보다. 같은 품종이라도 산지에 따라 스타일이 갈리고,
// 고르는 사람들은 구대륙/신대륙부터 본다. 목록에서 국기 하나면 그 판단이 빨라진다.
//
// 이모지 국기는 Windows 에서 렌더링되지 않아(글자 "KR"로 보인다) SVG 아이콘을 쓴다.
// 여기서는 코드만 정하고, 그리는 것은 components/Flag.js 가 한다.
const CODES = {
  프랑스: "fr",
  이탈리아: "it",
  이태리: "it",
  스페인: "es",
  포르투갈: "pt",
  독일: "de",
  오스트리아: "at",
  그리스: "gr",
  헝가리: "hu",
  조지아: "ge",
  스코틀랜드: "sct",
  영국: "gb",
  아일랜드: "ie",
  미국: "us",
  캐나다: "ca",
  칠레: "cl",
  아르헨티나: "ar",
  멕시코: "mx",
  쿠바: "cu",
  호주: "au",
  뉴질랜드: "nz",
  남아프리카: "za",
  남아공: "za",
  한국: "kr",
  대한민국: "kr",
  일본: "jp",
  중국: "cn",
  인도: "in",
};

/** "프랑스", "남아프리카공화국"처럼 표기가 조금 달라도 찾는다. 모르면 null. */
export function countryCode(country) {
  const text = String(country || "");
  if (!text) return null;
  for (const [name, code] of Object.entries(CODES)) {
    if (text.includes(name)) return code;
  }
  return null;
}
