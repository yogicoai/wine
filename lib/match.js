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

// 매칭에 도움이 안 되는 말 — 품종·색만 같다고 같은 술이 아니다.
// 색(레드·화이트·로제)은 여기 두지 않는다. 같은 술임을 말해 주지는 않지만
// 다른 술임은 확실히 말해 주기 때문에, 지워 버리면 그 신호를 잃는다.
const STOPWORDS = new Set([
  "와인", "wine", "스파클링", "샴페인",
  "드라이", "스위트", "프리미엄", "오리지널",
]);

// 약한 토큰 — 품종·등급처럼 수많은 술이 공유하는 말.
// 점수에는 보태되, 이것"만" 겹쳐서는 같은 술이라고 보지 않는다.
// ("카베르네 소비뇽"이 1865 카베르네 소비뇽과 붙어 버리면 안 된다)
const WEAK = new Set([
  // 포도 품종·등급
  "카베르네", "소비뇽", "메를로", "피노", "누아", "누와", "샤르도네", "시라", "시라즈",
  "말벡", "리슬링", "블랑", "그리지오", "그리", "템프라니요", "산지오베제", "네비올로",
  "그르나슈", "진판델", "카르메네르", "모스카토", "세미용", "비오니에", "슈냉", "가메",
  "리제르바", "리세르바", "리저브", "클라시코", "그란", "그랑", "브뤼", "셰리",
  // 사케 — 등급·제법·쌀은 수백 종이 함께 쓴다. 와인의 "리제르바"와 같은 자리다.
  // 이것이 빠져 있으면 "쿄히메 준마이 다이긴조"와 "고히메 준마이 다이긴조"가
  // 준마이·다이긴조 두 낱말만으로 같은 술이 되어 버린다.
  "사케", "니혼슈", "준마이", "다이긴조", "긴조", "혼조조", "도쿠베츠", "특별",
  "나마자케", "나마겐슈", "겐슈", "니고리", "무로카", "야마하이", "키모토", "시보리타테",
  "야마다니시키", "고햑만고쿠", "오마치", "미야마니시키", "정미", "정미율",
  // 맥주
  "맥주", "라거", "에일", "스타우트", "포터", "필스너", "바이젠", "바이스", "페일",
  "세션", "흑맥주", "생맥주", "ipa", "apa",
  // 위스키·증류주
  "위스키", "싱글", "몰트", "싱글몰트", "스카치", "버번", "캐스크", "배럴", "피니시",
  "블렌디드", "소주", "증류", "증류식", "막걸리", "생막걸리", "탁주", "약주", "청주",
  // 이름의 뼈대를 이루는 말 — 이것이 강한 토큰으로 남아 있으면
  // "샤또 무통 로칠드"와 "샤또 라피트 로칠드"가 샤또·로칠드 둘만으로 같은 술이 된다.
  "샤또", "샤토", "도멘", "도맨", "카사", "보데가", "퀸타", "테누타", "테뉴타",
  "카스텔로", "빈야드", "에스테이트", "셀러", "셀라", "와이너리", "클로", "퀴베",
  "컬렉션", "셀렉션", "셀렉티드", "에디션", "빈티지", "주조", "양조장",
  // 색 — 같은 술임은 말해 주지 않지만 다른 술임은 말해 준다
  "레드", "화이트", "로제", "루즈", "로쏘", "비앙코", "로사토", "틴토", "블랑코",
]);

// 이름 속 숫자는 등급을 가른다. 닷사이 23과 39, 발렌타인 12년과 17년은 다른 술이다.
// 양쪽 다 숫자를 달고 있는데 그 숫자가 겹치지 않으면 같은 술로 보지 않는다.
// 용량(750ml)은 등급이 아니므로 순수한 숫자와 "12년" 꼴만 본다.
const GRADE_NUMBER = /^(\d{1,4})(년|년산)?$/;

function gradeNumbers(tokens) {
  const out = new Set();
  for (const t of tokens) {
    const m = t.match(GRADE_NUMBER);
    if (m) out.add(m[1]);
  }
  return out;
}

// 라벨에 색이나 품종이 적혀 있으면 그것은 다른 술과 구분하라고 적힌 것이다.
// 한쪽에만 적혀 있어도 다른 술로 본다 — "샤또 딸보"와 "샤또 딸보 블랑"은 다르다.
// "소비뇽"은 카베르네 소비뇽과 소비뇽 블랑 양쪽에 들어가 가르는 힘이 없어 뺀다.
const COLOR = new Set(["레드", "화이트", "로제", "루즈", "로쏘", "비앙코", "로사토", "틴토", "블랑코", "블랑"]);
const GRAPE = new Set([
  "카베르네", "메를로", "피노", "샤르도네", "샤도네이", "시라", "시라즈", "쉬라즈",
  "말벡", "리슬링", "진판델", "산지오베제", "네비올로", "템프라니요", "그르나슈",
  "카르메네르", "모스카토", "세미용", "비오니에", "슈냉", "가메", "그리지오",
]);

// 산지도 같은 자리를 다툰다. "루이 자도 본 로마네"와 "루이 자도 뫼르소"는
// 생산자가 같아도 다른 와인이다. 메뉴판이 산지를 생략하는 일은 흔하므로
// 품종과 마찬가지로 양쪽 다 적혀 있을 때만 본다.
const APPELLATION = new Set([
  "바롤로", "바르바레스코", "브루넬로", "몬탈치노", "키안티", "발폴리첼라", "아마로네",
  "소아베", "프로세코", "다스티", "가비", "몬테풀치아노", "람브루스코",
  "샤블리", "뫼르소", "몽라셰", "로마네", "뉘생조르주", "볼네", "포마르", "샹베르탱",
  "보졸레", "상세르", "에르미타주", "지공다스", "샤또네프", "알자스",
  "마르고", "뽀이약", "포이약", "뽀므롤", "포므롤", "생테밀리옹", "그라브", "소테른",
  "리오하", "리베라", "프리오라트", "두에로", "두오로", "헤레스",
  "모젤", "라인가우", "팔츠", "바로사", "말보로", "멘도사", "마이포",
]);

function pick(tokens, set) {
  const out = new Set();
  for (const t of tokens) if (set.has(t)) out.add(t);
  return out;
}

function disjoint(a, b) {
  for (const v of a) if (b.has(v)) return false;
  return true;
}

// 두 이름이 서로 다른 술이라고 못 박는 신호가 있는가
function conflicts(query, tokens) {
  // 숫자·품종은 양쪽 다 적혀 있을 때만 본다.
  // 메뉴판은 품종을 곧잘 생략한다 — "몬테스 알파"가 DB의 "몬테스 알파 카베르네
  // 소비뇽"을 못 찾으면 와인 리스트 기능이 통째로 무너진다.
  for (const [a, b] of [
    [gradeNumbers(query), gradeNumbers(tokens)],
    [pick(query, GRAPE), pick(tokens, GRAPE)],
    [pick(query, APPELLATION), pick(tokens, APPELLATION)],
  ]) {
    if (a.size && b.size && disjoint(a, b)) return true;
  }

  // 색은 한쪽에만 적혀 있어도 다른 술로 본다.
  // 색은 생략되는 말이 아니라 같은 이름의 다른 술을 가르려고 붙이는 말이다.
  // "무통 카데 루즈"와 "무통 카데 로제"는 다른 와인이다.
  const qc = pick(query, COLOR);
  const cc = pick(tokens, COLOR);
  if (qc.size !== cc.size || disjoint(qc, cc)) {
    if (qc.size || cc.size) return true;
  }
  return false;
}

// 일본 술 이름은 여기가 갈린다 — 다이긴죠/다이긴조, 쥰마이/준마이, 하쿠쯔루/하쿠츠루.
// 낱말이 갈리면 같은 술을 수확 때마다 새로 받는다.
// ㅛ→ㅗ 를 통째로 밀면 교토가 고토가 되므로 갈리는 음절만 짚는다.
const JP_VARIANTS = [
  [/죠/g, "조"], [/쥰/g, "준"], [/쯔/g, "츠"],
  [/쵸/g, "초"], [/챠/g, "차"], [/쨔/g, "자"],
];

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
  let text = String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // 괄호 병기 제거
    .replace(/\b(19|20)\d{2}\b/g, " "); // 연도 제거
  for (const [re, to] of JP_VARIANTS) text = text.replace(re, to);
  return unfortis(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// "쿠보타 3종", "사케 5종 세트" — 묶음 상품은 술이지만 술 '하나'를 가리키지 않는다.
// 사진을 찍어 맞힐 대상이 없고, 맛 축도 정할 수 없다.
const BUNDLE = /\d+\s*종(\s*세트)?\s*$|\d+\s*병\s*세트|선물\s*세트/;

/**
 * 제품을 특정할 수 있는 이름인가.
 * "보르도", "부르고뉴 와인", "카베르네 소비뇽"처럼 산지·품종뿐인 이름은
 * 어느 술인지 알 수 없으므로 카탈로그에 넣을 수 없다.
 */
export function isSpecificName(name) {
  if (BUNDLE.test(String(name || ""))) return false;
  const tokens = tokenize(name);
  return tokens.length >= 2 && tokens.some((t) => !WEAK.has(t));
}

/**
 * 후보 목록에서 가장 가까운 항목을 찾는다.
 *
 * 판정 기준 (둘 중 하나):
 *  - 질의 토큰의 60% 이상이 겹치고, 겹친 토큰이 2개 이상,
 *    그리고 **강한 토큰**도 60% 이상 겹칠 것
 *  - 후보의 토큰이 질의에 전부 들어 있음 (메뉴 표기가 더 긴 경우:
 *    "카사 산토스 리마 델 빈도" ⊇ "카사 산토스 리마")
 *
 * 강한 토큰 조건이 핵심이다. 이것이 없으면 "샤또 무통 로칠드"와
 * "샤또 라피트 로칠드"가 샤또·로칠드 두 낱말만으로 같은 술이 된다.
 * 수확 단계에서는 새 와인이 남의 중복으로 몰려 버려지고,
 * 촬영 단계에서는 엉뚱한 와인을 자신 있게 내놓는다.
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
    if (conflicts(query, tokens)) continue;

    let shared = 0;
    let strongShared = 0;
    for (const t of tokens) {
      if (!querySet.has(t)) continue;
      shared++;
      if (!WEAK.has(t)) strongShared++;
    }

    const queryCoverage = shared / query.length;
    const candidateCoverage = shared / tokens.length;
    const strongCoverage = strongShared / queryStrong.length;

    let hit =
      strongShared >= 1 &&
      ((shared >= 2 && queryCoverage >= 0.6 && strongCoverage >= 0.6) ||
        // 후보가 질의에 통째로 들어 있어도, 너무 짧으면 앞부분만 같은 다른 술이다.
        // "몬테스 알파"는 "몬테스 알파 카베르네 소비뇽"의 앞부분일 뿐이다.
        (candidateCoverage === 1 &&
          tokens.length >= 2 &&
          tokens.join("").length >= queryCompact.length * 0.6));

    // 띄어쓰기가 아예 다른 경우("루이자도" vs "루이 자도")는 토큰이 어긋난다.
    // 전부 붙인 문자열의 포함 관계로 한 번 더 본다.
    // 짧은 쪽이 긴 쪽의 절반도 안 되면 다른 술을 앞부분만 보고 붙이는 것이다.
    let score = shared * 2 + candidateCoverage;
    if (!hit && queryCompact.length >= 6) {
      const candidateCompact = tokens.join("");
      const short = Math.min(queryCompact.length, candidateCompact.length);
      const long = Math.max(queryCompact.length, candidateCompact.length);
      if (
        short / long >= 0.6 &&
        (candidateCompact.includes(queryCompact) || queryCompact.includes(candidateCompact))
      ) {
        hit = true;
        score = 1 + short / 40;
      }
    }
    if (!hit) continue;

    if (!best || score > best.score) best = { candidate, score, shared };
  }

  return best;
}
