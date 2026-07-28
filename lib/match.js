// 느슨한 이름 매칭 — 촬영·바코드·와인 리스트가 DB와 만나는 지점.
//
// 지금까지는 이름이 정확히 같아야 찾았다. 그러면
//   "카사 산토스 리마 델 빈도"  vs  DB의 "카사 산토스 리마"      → 못 찾음
//   "샤토 탈보 2018"          vs  DB의 "샤또 딸보"             → 못 찾음
// 처럼 표기가 조금만 달라도 놓친다. 메뉴판·판매처 표기는 늘 조금씩 다르므로
// 정확 일치만으로는 DB가 아무리 커져도 적중률이 오르지 않는다.
//
// 토큰 단위로 겹침을 재서 가장 가까운 항목을 고른다. DB가 수천 건 수준이라
// 메모리에서 전부 비교해도 충분히 빠르다.

// 매칭에 도움이 안 되는 말 — 품종·색만 같다고 같은 술이 아니다
const STOPWORDS = new Set([
  "와인", "wine", "레드", "화이트", "로제", "스파클링", "샴페인",
  "드라이", "스위트", "프리미엄", "오리지널",
]);

// 약한 토큰 — 품종·등급처럼 수많은 술이 공유하는 말.
// 점수에는 보태되, 이것"만" 겹쳐서는 같은 술이라고 보지 않는다.
// ("카베르네 소비뇽"이 1865 카베르네 소비뇽과 붙어 버리면 안 된다)
const WEAK = new Set([
  "카베르네", "소비뇽", "메를로", "피노", "누아", "누와", "샤르도네", "시라", "시라즈",
  "말벡", "리슬링", "블랑", "그리지오", "그리", "템프라니요", "산지오베제", "네비올로",
  "그르나슈", "진판델", "카르메네르", "모스카토", "세미용", "비오니에", "슈냉", "가메",
  "리제르바", "리세르바", "리저브", "클라시코", "그란", "그랑", "브뤼",
]);

// 외래어 표기에서 흔들리는 된소리를 거센소리로 통일한다 (딸보→탈보, 샤또→샤토)
const FORTIS_TO_ASPIRATED = { 1: 15, 4: 16, 8: 17 }; // ㄲ→ㅋ, ㄸ→ㅌ, ㅃ→ㅍ

function unfortis(text) {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      out += ch;
      continue;
    }
    const initial = Math.floor(code / 588);
    const mapped = FORTIS_TO_ASPIRATED[initial];
    out += mapped === undefined ? ch : String.fromCharCode(0xac00 + mapped * 588 + (code % 588));
  }
  return out;
}

/** 이름 → 대조용 토큰 배열 */
export function tokenize(name) {
  return unfortis(
    String(name || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ") // 괄호 병기 제거
      .replace(/\b(19|20)\d{2}\b/g, " ") // 연도 제거
  )
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * 제품을 특정할 수 있는 이름인가.
 * "보르도", "부르고뉴 와인", "카베르네 소비뇽"처럼 산지·품종뿐인 이름은
 * 어느 술인지 알 수 없으므로 카탈로그에 넣을 수 없다.
 */
export function isSpecificName(name) {
  const tokens = tokenize(name);
  return tokens.length >= 2 && tokens.some((t) => !WEAK.has(t));
}

/**
 * 후보 목록에서 가장 가까운 항목을 찾는다.
 *
 * 판정 기준 (둘 중 하나):
 *  - 질의 토큰의 60% 이상이 겹치고, 겹친 토큰이 2개 이상
 *  - 후보의 토큰이 질의에 전부 들어 있음 (메뉴 표기가 더 긴 경우:
 *    "카사 산토스 리마 델 빈도" ⊇ "카사 산토스 리마")
 *
 * @param {string} name 찾을 이름 (메뉴 표기 등)
 * @param {Array<{name: string, tokens?: string[]}>} candidates
 * @returns {null | {candidate, score, shared}}
 */
export function findLooseMatch(name, candidates) {
  const query = tokenize(name);
  if (query.length < 2) return null; // 한 단어로는 다른 술과 구분할 수 없다

  const querySet = new Set(query);
  const queryStrong = query.filter((t) => !WEAK.has(t));
  if (!queryStrong.length) return null; // 품종·등급뿐인 질의는 특정할 수 없다
  const queryCompact = query.join("");

  let best = null;

  for (const candidate of candidates) {
    const tokens = candidate.tokens || (candidate.tokens = tokenize(candidate.name));
    if (!tokens.length) continue;

    let shared = 0;
    let strongShared = 0;
    for (const t of tokens) {
      if (!querySet.has(t)) continue;
      shared++;
      if (!WEAK.has(t)) strongShared++;
    }

    const queryCoverage = shared / query.length;
    const candidateCoverage = shared / tokens.length;

    let hit =
      strongShared >= 1 &&
      ((shared >= 2 && queryCoverage >= 0.6) ||
        (candidateCoverage === 1 && tokens.length >= 2));

    // 띄어쓰기가 아예 다른 경우("루이자도" vs "루이 자도")는 토큰이 어긋난다.
    // 전부 붙인 문자열의 포함 관계로 한 번 더 본다.
    let score = shared * 2 + candidateCoverage;
    if (!hit && queryCompact.length >= 6) {
      const candidateCompact = tokens.join("");
      if (candidateCompact.includes(queryCompact) || queryCompact.includes(candidateCompact)) {
        hit = true;
        score = 1 + Math.min(queryCompact.length, candidateCompact.length) / 40;
      }
    }
    if (!hit) continue;

    if (!best || score > best.score) best = { candidate, score, shared };
  }

  return best;
}
