// 데일리샷 — 국내 주류 가격의 자체 색인.
//
// 왜 이걸 쓰는가.
// 네이버 쇼핑 API 가 2026-07-31 에 닫힌 뒤 값을 얻을 곳이 다나와뿐이었는데,
// 다나와는 위스키 말고는 못 쓴다 (lib/danawa.js 에 실측을 적어 두었다).
// 특히 와인이 0 이었고, "사고 싶은 술을 담아 두면 값이 떨어질 때 알려 준다"는
// 이 앱의 처음 목표 하나가 값 없이는 성립하지 않았다.
//
// 데일리샷은 전국 매장의 스마트오더 값을 모아 놓은 곳이고, 상품 하나에
// 대표가 · 전국 최저가 · 최고가 · 파는 곳 수까지 들어 있다. 여섯 주종을 모두
// 다룬다 — 무작위 표본에서 와인 13 · 위스키 7 · 사케 6 · 우리술 4 · 맥주 2.
//
// 값을 실시간으로 물어보지 않는다. scripts/dailyshot-index.mjs 가 미리 담아 둔
// 색인을 읽는다. 화면이 뜰 때마다 남의 서버를 두드리지 않기 위해서고, 그래야
// 값 이력이 쌓여 "지난달보다 얼마나 싼가"를 말할 수 있다.

import { getDb } from "./mongodb.js";
import { tokenize, isWeakToken, isDroppableToken, conflictsWith } from "./match.js";

/**
 * 우리 주종 → 데일리샷 주종.
 *
 * 데일리샷은 진·보드카·데킬라를 "기타"에 몰아 넣어 두었다. 그래서 스피리츠
 * 계열은 큰 분류만으로는 갈리지 않고 세부 분류까지 봐야 한다.
 */
const CATEGORY_MAP = {
  wine: { top: ["와인"] },
  sake: { top: ["사케"] },
  beer: { top: ["맥주"] },
  whisky: { top: ["위스키"] },
  traditional: { top: ["우리술"] },
  makgeolli: { top: ["우리술"] },
  soju: { top: ["우리술"] },
  brandy: { top: ["브랜디"] },
  rum: { top: ["럼"] },
  baijiu: { top: ["백주"] },
  liqueur: { top: ["리큐르"] },
  gin: { top: ["기타"], sub: ["진"] },
  vodka: { top: ["기타"], sub: ["보드카"] },
  tequila: { top: ["기타"], sub: ["데킬라", "메즈칼"] },
  highball: { top: ["기타"], sub: ["하이볼"] },
  spirits: { top: ["기타", "럼", "브랜디", "리큐르", "백주"] },
};

/**
 * 이름에 붙는 장사 표시 — 대조 전에 떼어 낸다.
 *
 * 데일리샷의 이름은 앞에 대괄호로 붙는 것이 많다. [2023] 은 빈티지라 뜻이
 * 있지만 [마감] · [마지막 특가] · [4개 11,000원] 은 값과 재고 사정일 뿐이라
 * 그대로 두면 대조가 어긋난다.
 */
const PROMO = /\[[^\]]*\]/g;
// 끝에 붙는 용량 — 우리 카탈로그 이름에는 없다
const VOLUME_TAIL = /\s*\d+(\.\d+)?\s*(ml|l|리터|L)\s*$/i;

/**
 * 병당 값이 아닌 것 — 세트 · 묶음 · 미니어처 · 시음권.
 *
 * "화요 17, 25, 41 375ml 3종 59,000원"을 화요 17 의 값으로 쓰면 세 배를
 * 부풀린다. 목표가 알림이 걸린 자리라 틀린 값 하나가 오알림이 된다.
 */
const BUNDLE = /(\d+\s*(종|캔|병|개|팩)\s*(세트|기획|묶음)?|[x×]\s*\d+\s*$|세트|기획전|홈파티|키트|미니어처|시음권|증정|패키지|바이알|샘플)/;

/**
 * 이름 하나에 술이 둘 — "투핸즈 날리 듀즈 쉬라즈 & 투핸즈 엔젤스 쉐어 쉬라즈".
 *
 * 세트라는 말이 없어 BUNDLE 로는 안 걸리는데, 값은 둘을 합친 값이다.
 * 실제로 이것 하나가 "30 마일 쉬라즈" · "K1 쉬라즈" · "Panchkula 호텔 쉬라즈"에
 * 전부 붙었다 — 이름이 길어 아무 쉬라즈나 걸리는 그물이 된다.
 */
const TWO_DRINKS = /\s[&+]\s|\s\+\d/;

/** 대조에 쓸 이름으로 다듬는다 */
export function cleanName(raw) {
  return String(raw || "")
    .replace(PROMO, " ")
    .replace(VOLUME_TAIL, " ")
    // 도수는 이름이 아니다. 두고 보면 "라프로익 10년 40%"의 40 이 낱말로 잡혀
    // 우리 이름에 없는 군더더기로 세어진다.
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "750ml" · "1.75L" → 밀리리터 숫자 */
export function mlOf(text) {
  const s = String(text || "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(ml|l|리터)(?![a-z가-힣])/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return /^(l|리터)$/i.test(m[2]) ? Math.round(n * 1000) : Math.round(n);
}

/**
 * 사케 등급 · 맥주 스타일 — 같은 집에서 나오는 다른 술을 가르는 말.
 *
 * 이 말들은 수백 종이 함께 쓰기 때문에 lib/match.js 에서 약한 낱말로 분류된다.
 * 이름을 맞히는 데는 그것이 옳지만 값에서는 반대다 — 사케의 등급은 병마다
 * 찍혀 나오는 가격표나 다름없어서, 준마이와 준마이 다이긴조는 값이 배로 갈린다.
 * 실제로 느슨하게 두었더니 아카부 준마이 다이긴조에 아카부 준마이 값이,
 * 월계관 준마이에 월계관 준마이 다이긴죠 값이 붙었다.
 */
const SAKE_GRADE = ["다이긴조", "긴조", "준마이", "혼조조", "도쿠베츠"];
const BEER_STYLE = ["ipa", "라거", "에일", "스타우트", "포터", "필스너", "바이젠", "바이스", "사워"];
// 우리 술은 이 말이 곧 술의 종류다 — 미미옥 막걸리(13,900)와 미미옥 약주(18,900)는
// 이름이 한 낱말만 다르고 값이 다르다. 긴 말부터 봐야 "생막걸리"가 "막걸리"로 샌다.
const KOREAN_KIND = ["막걸리", "탁주", "동동주", "약주", "청주", "증류", "소주"];
const KOREAN = new Set(["traditional", "makgeolli", "soju"]);

/** 도수 — "40%" · "11.5%" · "40도" */
function abvOf(text) {
  // 우리 술은 도수를 "도"로 적는 일이 많다 (안동소주 일품 40도).
  // 숫자가 바로 앞에 있어야 도수다 — 온도·정도의 "도"에 걸리지 않게 한다.
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:%|도(?![수가-힣]))/);
  return m ? Number(m[1]) : null;
}

/**
 * 믿을 수 있는 최저가.
 *
 * 데일리샷의 최저가는 그 상품을 파는 전국 매장을 모은 값인데, 거기에 30ml
 * 바이알과 시음권이 섞여 들어오는 경우가 있다. 그러면 병값 자리에 잔값이 앉는다.
 *   글렌피딕 그랑 크루 23년   대표 590,000  최저  30,000  (267곳)
 *   조니워커 킹 조지 5세      대표 950,000  최저     100  (143곳)
 *
 * 전체의 0.5% 뿐이지만 목표가 알림이 걸리는 자리라 그냥 둘 수 없다. 대표가의
 * 3할에도 못 미치는 최저가는 병값이 아니라고 보고 대표가를 쓴다. 값을 높게
 * 잡는 쪽이라 알림이 덜 울릴 뿐, 헛알림은 나지 않는다.
 */
function trustedLow(d) {
  if (!d.low || !d.price) return d.low || d.price || null;
  return d.low < d.price * 0.3 ? d.price : d.low;
}

// 긴죠·긴조처럼 같은 말이 두 표기로 온다. 한쪽으로 모아 놓고 본다.
function jp(text) {
  return String(text || "").replace(/죠/g, "조").replace(/쥬/g, "주");
}

function gradeSet(text, words) {
  const s = jp(text).toLowerCase();
  // 다이긴조가 있으면 긴조도 문자열에 들어 있다. 긴 것부터 보고 지워 가며 센다.
  const out = new Set();
  let rest = s;
  for (const w of words) {
    if (rest.includes(w)) {
      out.add(w);
      rest = rest.split(w).join(" ");
    }
  }
  return out;
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * 이름에 박힌 구분 숫자 — "배치 3" · "No.5" · "타입 23".
 *
 * 토큰으로는 잡히지 않는다. 한 자리 숫자는 토큰에서 떨어져 나가기 때문이다.
 * 그래서 맥캘란 에디션 No.5 에 No.1 값이, 라세이 배치 3 에 배치 2 값이 붙었다.
 * 연도 · 도수 · 용량은 구분 숫자가 아니므로 먼저 지운다.
 */
function marks(text) {
  const s = String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|리터)(?![a-z가-힣])/gi, " ");
  return new Set((s.match(/\d+/g) || []).map((n) => String(Number(n))));
}

// ── 색인 ────────────────────────────────────────────────

// 주종별로 한 번 읽어 두고 6시간 쓴다. 25,000건을 매번 읽으면 화면이 느려지고,
// 값은 하루 한 번 갱신되므로 그보다 자주 읽을 이유가 없다.
const TTL = 6 * 60 * 60 * 1000;
const cache = new Map(); // 주종 → { at, rows }

async function index(category) {
  const map = CATEGORY_MAP[category];
  if (!map) return [];

  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const db = await getDb();
  if (!db) return [];

  const q = { category: { $in: map.top }, low: { $gt: 0 } };
  if (map.sub) q.subcategory = { $in: map.sub };

  const docs = await db
    .collection("dailyshot")
    .find(q, {
      projection: {
        _id: 0, id: 1, name: 1, nameEn: 1, volume: 1, abv: 1,
        price: 1, low: 1, high: 1, sellers: 1, url: 1, image: 1, rating: 1, reviews: 1,
      },
    })
    .toArray();

  // 세트·묶음은 병당 값이 아니라 여기서 버린다. 값을 못 찾는 것보다 틀린 값이 나쁘다.
  const rows = docs
    .filter((d) => !BUNDLE.test(d.name) && !TWO_DRINKS.test(d.name))
    .map((d) => {
      const name = cleanName(d.name);
      return {
        ...d,
        name,
        raw: d.name,
        tokens: tokenize(name),
        // 용량은 정보표에 있는 것이 먼저다. 없으면 이름에서 찾는다 —
        // "[30ml] … 바이알"이나 "카스 라이트 페트 1.6L"이 그런 경우다.
        ml: mlOf(d.volume) || mlOf(d.name),
        marks: marks(d.name),
        pct: abvOf(d.abv) ?? abvOf(d.name),
        low: trustedLow(d),
      };
    });

  cache.set(category, { at: Date.now(), rows });
  return rows;
}

/** 색인을 다시 읽게 한다 — 수집기가 돌고 난 뒤 */
export function clearIndexCache() {
  cache.clear();
}

// ── 조회 ────────────────────────────────────────────────

/**
 * 이 술의 국내 최저가.
 *
 * @param {string} name  우리 카탈로그의 이름
 * @param {object} opts
 * @param {string} opts.category  우리 주종 (wine · sake · …)
 * @param {number|string} opts.volume  아는 경우의 용량. 750ml 와 375ml 는 값이 두 배 다르다.
 * @returns {null | {low, price, high, sellers, url, name, volume, abv, image, id}}
 */
export async function dailyshotFor(name, { category, volume } = {}) {
  if (!name || !category) return null;
  const rows = await index(category);
  if (!rows.length) return null;
  return matchIn(rows, name, { category, volume });
}

/**
 * 이름 대조 — 여기서는 느슨함이 아니라 엄격함이 필요하다.
 *
 * lib/match.js 의 findLooseMatch 를 그대로 쓰면 안 된다. 그것은 메뉴판 대조용이라
 * 조금 어긋나도 붙이는 쪽으로 기울어 있다. 메뉴판에서는 비슷한 술이라도 보여
 * 주는 편이 낫지만, 값에서는 반대다 — 붙일 곳을 못 찾으면 값이 안 보일 뿐이지만
 * 엉뚱한 데 붙으면 오지 않을 알림을 기다리게 된다.
 *
 * 실제로 느슨한 대조를 400종에 돌려 보니 절반이 틀렸다.
 *   그라함 20년 토니 포트  →  샌드맨 20년 토니 포트    (집이 다르다)
 *   75 소비뇽 블랑        →  테 파 소비뇽 블랑        ("75"가 통째로 사라졌다)
 *
 * 그래서 규칙 하나로 못 박는다 — 우리 이름에서 품종·등급 같은 흔한 말을 뺀
 * 나머지가 후보에 "전부" 들어 있어야 한다. 위 둘은 그라함 · 75 가 후보에 없어
 * 걸러진다. 반대로 후보가 우리보다 자세한 것은 통과시킨다.
 *   그라니테 힐 진판델  →  그라니테 힐 올드 바인 진판델   (통과)
 */
function matchIn(rows, name, { category, volume } = {}) {
  const clean = cleanName(name);
  const query = tokenize(clean);
  const strong = query.filter((t) => !isWeakToken(t));
  // 품종·등급뿐인 이름은 어느 술인지 특정할 수 없다 ("카베르네 소비뇽")
  if (!strong.length || query.length < 2) return null;

  // 반드시 후보에 있어야 하는 낱말 = 강한 낱말 + 품종 + 색.
  //
  // 품종과 색은 '이 술이 무엇인가'를 말해 주지 않아 약한 낱말로 분류되지만,
  // '다른 술이다'는 확실히 말해 준다. 이것을 빼고 보면
  //   7 컬러즈 메를로     →  7 컬러즈 브뤼 샤르마          (같은 집 다른 술)
  //   그랑 씨 리슬링 알자스 →  마르셀 다이스 알자스 컴플렌테이션  (알자스만 같다)
  // 처럼 집이나 산지만 같은 술에 붙는다. isDroppableToken 이 그 구분을 안다.
  // 같은 낱말이 두 번 나오는 이름이 있다 ("가비 디 가비"). 세는 자리에서
  // 둘로 치면 "특정할 낱말이 둘"로 보여 아래의 길이 방어가 풀린다.
  const required = [...new Set(query.filter((t) => !isDroppableToken(t)))];

  const allowed = VOLUMES[category] || null;
  const want = mlOf(volume);
  const seen = new Set(query);
  // 특정할 낱말이 하나뿐이면("가비", "기원") 그 낱말을 품은 아무 술에나 붙을 수
  // 있다. 그럴 때는 후보가 군더더기를 하나도 더 달지 않았을 때만 같은 술로 본다.
  const loose = required.length < 2;

  const grade = category === "sake" ? gradeSet(clean, SAKE_GRADE) : null;
  const style = category === "beer" ? gradeSet(clean, BEER_STYLE) : null;
  const kind = KOREAN.has(category) ? gradeSet(clean, KOREAN_KIND) : null;
  const ours = marks(clean);
  const pct = abvOf(name);
  const compact = clean.replace(/\s/g, "").length;

  const hits = [];
  for (const r of rows) {
    const has = new Set(r.tokens);
    if (!required.every((t) => has.has(t))) continue;
    // 품종·색·숫자가 서로 다르다고 못 박는 신호 (샤르도네 vs 리슬링, 12년 vs 17년)
    if (conflictsWith(clean, r.name)) continue;

    // 용량이 다르면 값이 통째로 다르다. 우리 쪽 용량을 모르므로 그 주종에서
    // 병 하나가 보통 몇 밀리리터인지로 거른다 — 1.5L 값을 750ml 값으로 쓰거나
    // 30ml 바이알 값을 병값으로 쓰면 목표가 알림이 영영 안 울린다.
    const ml = r.ml;
    if (ml) {
      if (want ? ml !== want : allowed ? !allowed.includes(ml) : ml < 200 || ml > 1000) continue;
    }

    // 사케 등급은 양쪽이 똑같아야 한다 — 준마이와 준마이 다이긴조는 다른 술이다.
    if (grade && !sameSet(grade, gradeSet(r.name, SAKE_GRADE))) continue;
    // 맥주 스타일은 우리가 적었을 때만 본다. 상품명이 스타일을 생략하는 일이 흔해
    // 양쪽을 맞추면 멀쩡한 것을 버린다 ("크래프트브로스 라이프" ↔ "…라이프 IPA").
    if (style?.size) {
      const theirs = gradeSet(r.name, BEER_STYLE);
      if (!sameSet(style, theirs)) continue;
    }
    // 우리 술은 종류를 가리는 말이 곧 다른 술이다 (미미옥 막걸리 ↔ 미미옥 약주)
    if (kind && !sameSet(kind, gradeSet(r.name, KOREAN_KIND))) continue;

    // 도수를 양쪽이 밝히면 같아야 한다.
    // "나루 생 막걸리 6%"에 "나루 생 막걸리 11.5%" 값이 붙었다 — 이름에서 도수를
    // 떼고 보니 두 술이 같아 보였다.
    if (pct != null && r.pct != null && pct !== r.pct) continue;

    // 이름에 박힌 구분 숫자가 우리 쪽에 있으면 후보에도 있어야 한다
    if (![...ours].every((n) => r.marks.has(n))) continue;

    // 후보가 우리 이름에 없는 낱말을 여럿 달고 있으면 다른 표현이다.
    //   글렌알라키 12년      →  글렌알라키 12년 모스카텔 우드 피니시   (다른 술, 값 1.5배)
    //   더 글렌리벳 15년     →  시그나토리 2006 더 글렌리벳 15년 CS  (독립병입, 값 3배)
    const extras = r.tokens.filter((t) => !seen.has(t) && !isWeakToken(t)).length;
    if (loose ? extras > 0 : extras >= 2) continue;
    // 특정할 낱말이 하나뿐일 때는 길이도 본다. 한 글자 낱말은 토큰에서 떨어져
    // 나가기 때문에 "술샘 쑥 막걸리"가 그냥 "술샘"으로 줄고, 그러면 술샘이 내는
    // 아무 술에나 붙는다.
    if (loose && r.name.replace(/\s/g, "").length < compact * 0.6) continue;

    hits.push({ r, extras });
  }
  if (!hits.length) return null;

  // 군더더기가 없는 것부터 고른다.
  //
  // 낱말 하나 차이가 특별판인 경우가 많다 — 글렌리벳 12년 vs 12년 "엑설런스",
  // 메이커스 마크 vs 마크 "CS", 닷사이 23 vs 23 "원심분리". 값이 1.3~3배 뛴다.
  // 그렇다고 낱말 하나 차이를 전부 막으면 "라프로익 셀렉트 → 라프로익 오크
  // 셀렉트"처럼 표기만 다른 같은 술까지 잃는다. 그래서 막지 않고 뒤로 미룬다 —
  // 기본 제품이 색인에 있으면 언제나 그쪽이 먼저 뽑힌다.
  hits.sort((a, b) => a.extras - b.extras || rank(a.r, want) - rank(b.r, want));
  return shape(hits[0].r);
}

/**
 * 병 하나로 통하는 용량 — 우리 카탈로그에는 용량이 없어서 이쪽으로 고른다.
 *
 * 같은 술이 750ml 와 1.5L 로 함께 올라와 있으면 값이 두 배 차이 난다.
 * 어느 쪽인지 말해 주는 정보가 우리에게 없으므로, 그 주종에서 병 하나가
 * 보통 몇 밀리리터인지로 거른다.
 *
 * 맥주와 우리술은 여기 두지 않는다 — 330 · 355 · 500 · 750 이 다 정상이라
 * 하나로 못 박으면 멀쩡한 것을 버린다. 그쪽은 용량을 그대로 실어 보내고
 * 화면이 밝히게 한다.
 */
const VOLUMES = {
  wine: [750],
  sake: [720, 750],
  // 스카치는 700, 아메리칸은 750 이 표준이다. 둘 다 병 하나다.
  whisky: [700, 750],
  brandy: [700, 750],
  rum: [700, 750],
  gin: [700, 750],
  vodka: [700, 750],
  tequila: [700, 750],
};

function rank(r, want) {
  // 군더더기 수는 부른 쪽에서 이미 봤다. 여기서는 그다음을 가른다.
  //
  // 용량은 우리가 아는 경우에만 벌점을 준다. 모를 때 표준 하나를 골라 벌점을
  // 주면 700 · 750 이 다 정상인 위스키에서 멀쩡한 750ml 를 뒤로 밀어 버린다.
  const volPenalty = want && r.ml && r.ml !== want ? 1000 : 0;
  // 파는 곳이 많을수록 그 값이 시세에 가깝다
  const trust = Math.min(r.sellers || 0, 999) / 1000;
  return volPenalty - trust;
}

function shape(d) {
  return {
    id: d.id,
    name: d.raw || d.name,
    low: d.low,
    price: d.price,
    high: d.high,
    // 파는 곳이 몇이냐가 값을 믿을 근거다. 한 곳뿐인 값은 그 가게 값일 뿐이고,
    // 백 곳이 파는 값은 시세다. 화면이 이 숫자로 표현을 가른다.
    sellers: d.sellers || 0,
    volume: d.volume || null,
    abv: d.abv || null,
    image: d.image || null,
    rating: d.rating || null,
    reviews: d.reviews || 0,
    url: d.url,
    source: "dailyshot",
  };
}

/**
 * 담아 둔 값 말고 지금 값 — 목표가 알림이 울리기 직전에 한 번 더 확인할 때.
 *
 * 색인은 하루 한 번 갱신된다. 알림을 보내기 전에 그 한 건만 다시 확인하면
 * "떨어졌다고 알림 받고 들어갔더니 이미 올랐다"를 막을 수 있다.
 */
export async function liveLow(id) {
  try {
    const home = await fetch("https://dailyshot.co/m/item/5395", {
      headers: { "user-agent": "ClaudeBot" },
      next: { revalidate: 86400 },
    });
    const bid = (await home.text()).match(/"buildId":"([^"]+)"/)?.[1];
    if (!bid) return null;

    const r = await fetch(`https://dailyshot.co/_next/data/${bid}/m/item/${id}.json`, {
      headers: { "user-agent": "ClaudeBot" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const qs = (await r.json())?.pageProps?.dehydratedState?.queries || [];
    const s = qs.find((q) => q.queryKey?.[1] === "getItemDetailsSnippet")?.state?.data;
    const low = Number(s?.offers?.lowPrice);
    return Number.isFinite(low) && low > 0 ? low : null;
  } catch {
    return null;
  }
}
