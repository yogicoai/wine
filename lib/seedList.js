// 선적재 시드 목록 — 네이버쇼핑에서 "실제로 팔리는 술"을 뽑아온다 (무료)
// 팔리는 술 = 사람들이 스캔할 술이므로, 이 목록을 미리 분석해두면 적중률이 높다.
import { searchShop, hasNaverKeys } from "./naver";

// 주종별 검색어 — 카테고리 필터(주류)와 결합해 인기 상품을 수집.
// 넓은 말(레드와인)로 인기 순위를 훑고, 품종·산지·브랜드로 꼬리를 파고든다.
// 네이버 API는 무료(일 25,000회)라 검색어를 아끼지 않아도 된다.
export const SEED_QUERIES = {
  wine: [
    // 색·형태
    "레드와인", "화이트와인", "로제와인", "스파클링 와인", "샴페인", "디저트 와인",
    "내추럴 와인", "오렌지 와인", "포트와인", "아이스와인",
    // 품종
    "카베르네 소비뇽 와인", "피노누아 와인", "메를로 와인", "쉬라즈 와인", "말벡 와인",
    "샤르도네 와인", "소비뇽블랑 와인", "리슬링 와인", "모스카토 와인", "진판델 와인",
    // 산지
    "보르도 와인", "부르고뉴 와인", "토스카나 와인", "키안티 와인", "바롤로 와인",
    "리오하 와인", "나파밸리 와인", "칠레 와인", "호주 와인", "뉴질랜드 와인",
    "독일 와인", "아르헨티나 와인", "스페인 와인", "이탈리아 와인", "프로세코", "카바 와인",
    // 쓰임새 (사람들이 실제로 치는 말)
    "편의점 와인", "데일리 와인", "가성비 와인", "1만원대 와인", "선물용 와인",
  ],
  whisky: [
    "싱글몰트 위스키", "버번 위스키", "스카치 위스키", "블렌디드 위스키", "하이볼 위스키",
    "재패니즈 위스키", "아이리쉬 위스키", "라이 위스키",
    // 잘 팔리는 브랜드 — 라인업이 통째로 걸린다
    "맥캘란", "발베니", "글렌피딕", "글렌리벳", "라프로익", "아드벡", "산토리 위스키",
    "잭다니엘", "짐빔", "와일드터키", "메이커스마크", "조니워커", "시바스리갈",
  ],
  sake: ["사케", "준마이 다이긴조", "니혼슈", "준마이슈", "다이긴조", "니고리 사케"],
  traditional: ["전통주", "막걸리", "약주", "증류식 소주", "청주 술", "복분자주", "매실주", "안동소주"],
  beer: ["수제맥주", "크래프트 비어", "수입맥주", "IPA 맥주", "밀맥주", "흑맥주", "라거 맥주"],
  brandy: ["꼬냑", "브랜디", "아르마냑", "칼바도스", "헤네시", "레미마틴", "까뮤"],
  tequila: ["데킬라", "블랑코 데킬라", "아네호 데킬라"],
  rum: ["럼", "다크 럼", "스파이스드 럼"],
  gin: ["진 술", "런던 드라이 진", "탱커레이", "봄베이 사파이어", "몽키47"],
  baijiu: ["백주", "고량주", "마오타이", "수정방", "연태고량주"],
  soju: ["소주", "프리미엄 소주", "화요", "일품진로"],
};

// 판매처가 상품명에 붙이는 홍보 문구·판매몰명 — 제품명이 아니므로 제거
const NOISE =
  /(무료배송|당일발송|당일출고|빠른배송|정품|사은품|선물포장|선물세트|와인추천|주류픽업|스마트오더|방문수령|택배불가|기획|한정|행사|할인|특가|전용잔|패키지|증정|모음|골라담기|와인픽스|와인앤모어|데일리샷|공식몰|본사직영|세트|본입|묶음|선물|추천|국산|명절|설날|추석|최고의|최초의|아내를 위한|남편을 위한|부모님|고급)/g;

// 이름 끝에 남는 일반어 — 제품명이 아니라 검색용 꼬리표다
// ("체사리 소아베 클라시코 화이트와인 추천" → "체사리 소아베 클라시코")
const TRAILING_GENERIC =
  /\s+(와인|레드와인|화이트와인|스파클링와인|스파클링|레드|화이트|술|위스키|사케|맥주|x)$/i;

// 술이 아닌 상품 — 카테고리 필터를 통과해도 이름에 이런 말이 있으면 제외
// (와인색 스웨터·와인잔·시음 워크숍 등이 주류 카테고리로 등록되는 경우가 있다)
const NOT_A_BOTTLE =
  /(스웨터|스웨트|셔츠|티셔츠|맨투맨|후드|니트|자켓|재킷|코트|바지|양말|모자|볼캡|가방|파우치|케이스|지갑|의자|쿠션|와인색|워크숍|워크샵|클래스|시음|체험|강좌|쿠폰|상품권|기프트카드|글라스|잔\s?세트|오프너|디캔터|와인셀러|냉장고|랙|거치대|안주|치즈|스티커|포스터|질레|조끼|크록|슬리퍼|구두|운동화|숄더백|백팩|머플러|스카프)/;

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
    .replace(/\d+(\.\d+)?\s?(병|개입|개|입|팩|세트|박스|본|캔)/g, " ") // 한글 단위는 \b가 통하지 않음
    .replace(/\d+년산/g, " ")
    .replace(NOISE, " ")
    .replace(/[+×x]\s*\d+/gi, " ")
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, " ") // 판매자 상품코드 (대문자)
    .replace(/\b(?=[a-zA-Z0-9]*\d)(?=[a-zA-Z0-9]*[a-zA-Z])[a-zA-Z0-9]{6,}\b/g, " ") // 혼합 코드 (Aeroso1234 류)
    .replace(/\b\d{5,}\b/g, " ") // 긴 숫자 코드
    .replace(/[,\/·|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+[a-zA-Z]$/, "") // 끝에 남은 한 글자 (× 표기 잔여물 등)
    .trim()
    // 꼬리표는 겹쳐 붙는 경우가 많아 없어질 때까지 벗긴다
    .replace(TRAILING_GENERIC, "")
    .replace(TRAILING_GENERIC, "")
    .replace(TRAILING_GENERIC, "")
    .trim();
}

// 제품명으로 쓸 수 있는지 — 코드·숫자 덩어리나 술이 아닌 상품을 걸러낸다
function usableName(name) {
  if (name.length < 3 || name.length > 50) return false;
  if (NOT_A_BOTTLE.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length > 7) return false; // 문장형 홍보 제목 (실제 제품명은 대부분 6단어 이하)
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
export async function buildSeedList({ categories, perQuery = 20, pages = 1 } = {}) {
  if (!hasNaverKeys()) return null;

  const targets = categories?.length ? categories : Object.keys(SEED_QUERIES);
  const seen = new Set();
  const out = [];

  for (const category of targets) {
    for (const q of SEED_QUERIES[category] || []) {
      let taken = 0;

      // 첫 페이지는 인기 상품, 뒷 페이지로 갈수록 꼬리 상품이 나온다.
      // 꼬리까지 파야 식당 하우스 와인 같은 것들이 걸린다.
      for (let page = 0; page < pages && taken < perQuery; page++) {
        let items = [];
        try {
          items =
            (await searchShop(q, "liquor", {
              display: Math.min(100, perQuery * 2),
              start: 1 + page * 100,
              fresh: pages > 1, // 여러 페이지를 돌 때는 캐시가 페이지를 섞을 수 있다
            })) || [];
        } catch {
          break; // 이 검색어는 접고 다음으로
        }
        if (!items.length) break;

        for (const it of items) {
          if (taken >= perQuery) break;
          const name = cleanProductName(it.title);
          if (!usableName(name)) continue;

          const key = dedupeKey(name);
          if (!key || seen.has(key)) continue;
          seen.add(key);

          // query 는 나중에 타입을 짐작하는 단서("레드와인" 검색 → 레드 와인),
          // image 는 stub 에 바로 연결할 판매처 이미지 주소다.
          out.push({ name, category, mall: it.mall, price: it.price, image: it.image || null, query: q });
          taken++;
        }

        // 연속 호출 시 빈 응답을 피하려고 간격을 둔다
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }

  return out;
}
