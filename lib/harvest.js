// 수확 — 네이버 인기 상품을 뼈대(stub)로 적재하는 공통 로직.
// 손으로 부르는 /api/catalog/harvest 와 정기 실행 크론이 같은 코드를 쓴다.
import { buildSeedList } from "./seedList";
import { saveCatalog, catalogKey, catalogNameIndex } from "./catalog";
import { isNotDrink } from "./notDrink";
import { findLooseMatch, isSpecificName } from "./match";
import { resolveWanted } from "./wanted";
import { guessCountry } from "./countryGuess";
import { guessTasteProfile } from "./varietal";

// 검색어 → 타입 짐작. 확실한 것만 적고 나머지는 비워 둔다.
const QUERY_TYPE = {
  레드와인: "레드 와인",
  화이트와인: "화이트 와인",
  로제와인: "로제 와인",
  샴페인: "스파클링 와인 · 샴페인",
  "스파클링 와인": "스파클링 와인",
  프로세코: "스파클링 와인 · 프로세코",
  "카바 와인": "스파클링 와인 · 카바",
  포트와인: "디저트 와인 · 포트",
  아이스와인: "디저트 와인 · 아이스와인",
  "디저트 와인": "디저트 와인",
  "보르도 와인": "레드 와인",
  "카베르네 소비뇽 와인": "레드 와인 · 카베르네 소비뇽",
  "피노누아 와인": "레드 와인 · 피노 누아",
  "메를로 와인": "레드 와인 · 메를로",
  "쉬라즈 와인": "레드 와인 · 쉬라즈",
  "말벡 와인": "레드 와인 · 말벡",
  "진판델 와인": "레드 와인 · 진판델",
  "샤르도네 와인": "화이트 와인 · 샤르도네",
  "소비뇽블랑 와인": "화이트 와인 · 소비뇽 블랑",
  "리슬링 와인": "화이트 와인 · 리슬링",
  "모스카토 와인": "화이트 와인 · 모스카토",
  "부르고뉴 와인": null, // 레드·화이트가 섞여 있어 단정할 수 없다
};

// 검색어 → 국가 짐작. 산지 검색어에서 온 것은 국가를 안다.
const QUERY_COUNTRY = {
  "보르도 와인": "프랑스",
  "부르고뉴 와인": "프랑스",
  샴페인: "프랑스",
  "토스카나 와인": "이탈리아",
  "키안티 와인": "이탈리아",
  "바롤로 와인": "이탈리아",
  프로세코: "이탈리아",
  "이탈리아 와인": "이탈리아",
  "리오하 와인": "스페인",
  "카바 와인": "스페인",
  "스페인 와인": "스페인",
  "나파밸리 와인": "미국",
  "칠레 와인": "칠레",
  "호주 와인": "호주",
  "뉴질랜드 와인": "뉴질랜드",
  "독일 와인": "독일",
  "아르헨티나 와인": "아르헨티나",
  "스카치 위스키": "스코틀랜드",
  "재패니즈 위스키": "일본",
  "아이리쉬 위스키": "아일랜드",
  "버번 위스키": "미국",
  사케: "일본",
  니혼슈: "일본",
  준마이슈: "일본",
  다이긴조: "일본",
  "준마이 다이긴조": "일본",
  "니고리 사케": "일본",
  전통주: "한국",
  막걸리: "한국",
  약주: "한국",
  "증류식 소주": "한국",
  복분자주: "한국",
  매실주: "한국",
  안동소주: "한국",
  소주: "한국",
  "프리미엄 소주": "한국",
  화요: "한국",
  일품진로: "한국",
  꼬냑: "프랑스",
  아르마냑: "프랑스",
  칼바도스: "프랑스",
  헤네시: "프랑스",
  레미마틴: "프랑스",
  까뮤: "프랑스",
  데킬라: "멕시코",
  "블랑코 데킬라": "멕시코",
  "아네호 데킬라": "멕시코",
  백주: "중국",
  고량주: "중국",
  마오타이: "중국",
  수정방: "중국",
  연태고량주: "중국",
};

// 판매가 → 가격대. 큐레이션과 같은 구간을 쓴다.
function bandFromPrice(price) {
  if (!price) return null;
  if (price < 20000) return 1;
  if (price < 50000) return 2;
  if (price < 100000) return 3;
  if (price < 300000) return 4;
  return 5;
}

/**
 * @returns dry-run 이면 {dryRun, collected, new, preview},
 *          confirm 이면 {collected, inserted, resolved, failed}
 */
/** 뼈대 하나를 만든다 — 이름·검색어에서 뽑아낼 수 있는 만큼 채운다 */
function toStub(item) {
  const type = QUERY_TYPE[item.query] ?? null;
  const country =
    QUERY_COUNTRY[item.query] ??
    guessCountry({ name: item.name, category: item.category, type });
  // 맛 축이 없으면 취향 추천 후보에서 아예 빠진다. 품종을 알면 큰 틀은 짐작할 수 있다.
  const tasteProfile = guessTasteProfile({ name: item.name, type, category: item.category });

  return {
    found: true,
    tier: "stub",
    name: item.name,
    category: item.category,
    type,
    country,
    tasteProfile: tasteProfile || undefined,
    tasteEstimated: tasteProfile ? true : undefined,
    priceBand: bandFromPrice(item.price),
    image: item.image || null,
  };
}

export async function harvestCatalog({ categories = ["wine"], perQuery = 20, pages = 1, confirm = false } = {}) {
  const collected = await buildSeedList({ categories, perQuery, pages });
  if (!collected) return { error: "네이버 API 키 필요" };

  // 이미 있는 것은 거른다 — 정확 키뿐 아니라 느슨한 매칭으로도.
  // "몬테스 알파 카베르네 소비뇽 기프트"를 이미 있는 몬테스 알파 옆에 또 넣으면 안 된다.
  const index = await catalogNameIndex();
  const existingKeys = new Set(index.map((d) => catalogKey(d.name, d.vintage)));

  const fresh = [];
  for (const item of collected) {
    // 산지·품종뿐인 이름("보르도", "부르고뉴 와인")은 어느 술인지 알 수 없다
    if (!isSpecificName(item.name)) continue;
    // 판매처는 "와인"에 잔·오프너·식초까지 함께 내준다. 술이 아닌 것은 받지 않는다
    if (isNotDrink(item.name)) continue;
    if (existingKeys.has(catalogKey(item.name, null))) continue;
    if (findLooseMatch(item.name, index)) continue;
    // 이번 수확 안에서의 중복도 같은 기준으로 거른다
    if (findLooseMatch(item.name, fresh)) continue;
    fresh.push({ ...item, tokens: undefined });
  }

  if (!confirm) {
    return {
      dryRun: true,
      collected: collected.length,
      new: fresh.length,
      preview: fresh.map((f) => ({ name: f.name, category: f.category, price: f.price || null })),
      note: "confirm:true 를 주면 위 목록이 stub 으로 적재됩니다.",
    };
  }

  let inserted = 0;
  const failed = [];
  for (const item of fresh) {
    const ok = await saveCatalog(toStub(item), { usedWeb: false, model: null, source: "harvest" });
    ok ? inserted++ : failed.push(item.name);
  }

  // 수확으로 채워진 이름은 "못 찾은 목록"에서 지운다
  const resolved = await resolveWanted(fresh.map((f) => f.name));

  return { collected: collected.length, inserted, resolved, failed };
}
