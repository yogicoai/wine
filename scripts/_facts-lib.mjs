// 도수·국가를 견줄 때 쓰는 공용 함수 — 대조 스크립트와 적용 스크립트가 함께 쓴다.

// 나라 이름이 서로 다르게 적히는 것들 — 같은 것으로 본다. 앞의 것이 대표 이름이다.
const COUNTRY = [
  ["영국", "스코틀랜드", "잉글랜드", "웨일스", "uk", "britain"],
  ["미국", "usa", "us"],
  ["한국", "대한민국", "korea"],
  ["일본", "japan"],
  ["중국", "china"],
  ["대만", "타이완", "taiwan"],
  ["아일랜드", "아이랜드", "ireland"],
  ["프랑스", "france"],
  ["이탈리아", "italy"],
  ["스페인", "spain"],
  ["독일", "germany"],
  ["호주", "오스트레일리아", "australia"],
  ["뉴질랜드", "newzealand"],
  ["칠레", "chile"],
  ["아르헨티나", "argentina"],
  ["남아프리카공화국", "남아공", "southafrica"],
  ["캐나다", "canada"],
  ["멕시코", "mexico"],
  ["러시아", "russia"],
  ["벨기에", "belgium"],
  ["네덜란드", "netherlands"],
  ["체코", "czech"],
  ["오스트리아", "austria"],
  ["포르투갈", "portugal"],
  ["모리셔스", "mauritius"],
];

export function canonCountry(s) {
  const k = String(s || "").toLowerCase().replace(/[\s.]/g, "");
  if (!k) return "";
  for (const g of COUNTRY) if (g.some((x) => k.includes(x))) return g[0];
  return k;
}

/** "40%" · "15~16%" · "40.8도" → 처음 나오는 숫자 */
export function abvNum(s) {
  const m = String(s || "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
