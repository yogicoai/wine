// 선적재 시드 목록 — 네이버쇼핑에서 "실제로 팔리는 술"을 뽑아온다 (무료)
// 팔리는 술 = 사람들이 스캔할 술이므로, 이 목록을 미리 분석해두면 적중률이 높다.
import { searchShop, hasNaverKeys } from "./naver";

// 주종별 검색어 — 카테고리 필터(주류)와 결합해 인기 상품을 수집
export const SEED_QUERIES = {
  wine: ["레드와인", "화이트와인", "샴페인", "보르도 와인", "부르고뉴 와인", "스파클링 와인"],
  whisky: ["싱글몰트 위스키", "버번 위스키", "스카치 위스키", "블렌디드 위스키", "하이볼 위스키"],
  sake: ["사케", "준마이 다이긴조", "니혼슈"],
  traditional: ["전통주", "막걸리", "약주", "증류식 소주"],
  beer: ["수제맥주", "크래프트 비어", "수입맥주"],
  brandy: ["꼬냑", "브랜디"],
  tequila: ["데킬라"],
  rum: ["럼"],
  gin: ["진 술"],
  baijiu: ["백주", "고량주"],
  soju: ["소주"],
};

// 판매처가 상품명에 붙이는 홍보 문구·판매몰명 — 제품명이 아니므로 제거
const NOISE =
  /(무료배송|당일발송|당일출고|빠른배송|정품|사은품|선물포장|선물세트|와인추천|주류픽업|스마트오더|방문수령|택배불가|기획|한정|행사|할인|특가|전용잔|패키지|증정|모음|골라담기|와인픽스|와인앤모어|데일리샷|공식몰|본사직영|세트|본입|묶음)/g;

// 술이 아닌 상품 — 카테고리 필터를 통과해도 이름에 이런 말이 있으면 제외
// (와인색 스웨터·와인잔·시음 워크숍 등이 주류 카테고리로 등록되는 경우가 있다)
const NOT_A_BOTTLE =
  /(스웨터|스웨트|셔츠|티셔츠|맨투맨|후드|니트|자켓|재킷|코트|바지|양말|모자|볼캡|가방|파우치|케이스|지갑|의자|쿠션|와인색|워크숍|워크샵|클래스|시음|체험|강좌|쿠폰|상품권|기프트카드|글라스|잔\s?세트|오프너|디캔터|와인셀러|냉장고|랙|거치대|안주|치즈|스티커|포스터)/;

// 상품명에서 브랜드·제품명만 남기기
export function cleanProductName(title) {
  return String(title)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[[^\]]*\]/g, " ") // [무료배송] 등
    .replace(/\([^)]*\)/g, " ")
    .replace(/,\s*\d+\s*개?\s*$/g, " ") // 끝의 ", 1개"
    .replace(/\/?\s*도수\s*\d+(\.\d+)?\s*%?/g, " ") // "/도수6.5%"
    .replace(/\b\d+(\.\d+)?\s*도\b/g, " ") // "12도"
    .replace(/\d+(\.\d+)?\s?(ml|l|리터)\b/gi, " ")
    .replace(/\d+(\.\d+)?\s?(병|개입|개|입|팩|세트|박스|본)/g, " ") // 한글 단위는 \b가 통하지 않음
    .replace(/\d+년산/g, " ")
    .replace(NOISE, " ")
    .replace(/[+×x]\s*\d+/gi, " ")
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, " ") // 판매자 상품코드
    .replace(/\b\d{5,}\b/g, " ") // 긴 숫자 코드
    .replace(/[,\/·|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+[a-zA-Z]$/, "") // 끝에 남은 한 글자 (× 표기 잔여물 등)
    .trim();
}

// 제품명으로 쓸 수 있는지 — 코드·숫자 덩어리나 술이 아닌 상품을 걸러낸다
function usableName(name) {
  if (name.length < 3 || name.length > 50) return false;
  if (NOT_A_BOTTLE.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length > 9) return false; // 문장형 홍보 제목
  const letters = (name.match(/[\p{L}]/gu) || []).length;
  return letters >= 2 && letters / name.length > 0.5; // 절반 이상이 글자
}

// 같은 제품의 표기 흔들림을 합치기 위한 대조용 키
function dedupeKey(name) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 주종별 인기 상품에서 선적재 후보 목록을 만든다.
 * @param {object} opts
 * @param {string[]} opts.categories 대상 주종 (기본: 전체)
 * @param {number} opts.perQuery     검색어당 수집 개수
 * @returns {Promise<Array<{name, category, mall, price}>>}
 */
export async function buildSeedList({ categories, perQuery = 20 } = {}) {
  if (!hasNaverKeys()) return null;

  const targets = categories?.length ? categories : Object.keys(SEED_QUERIES);
  const seen = new Set();
  const out = [];

  for (const category of targets) {
    for (const q of SEED_QUERIES[category] || []) {
      let items = [];
      try {
        items = (await searchShop(q, "liquor", { display: Math.min(100, perQuery * 2) })) || [];
      } catch {
        continue; // 개별 검색어 실패는 건너뜀
      }

      let taken = 0;
      for (const it of items) {
        if (taken >= perQuery) break;
        const name = cleanProductName(it.title);
        if (!usableName(name)) continue;

        const key = dedupeKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        out.push({ name, category, mall: it.mall, price: it.price });
        taken++;
      }
    }
  }

  return out;
}
