// 카탈로그에 섞여 든 술 아닌 것을 찾는다.
//
// 뼈대(stub)는 쇼핑몰 목록에서 긁어 만들었다. 그래서 산지 이름으로 검색할 때
// 딸려 온 것들이 그대로 들어와 있다 — 그 고장의 숙소, 산지 이름을 색 이름으로
// 쓴 옷과 신발, 와인 이름을 단 잔과 가방.
//
//   Logrono 호스탈 리오하 콘데스타블레      (리오하의 호스텔)
//   Fairfield 퀄리티 인 페어필드 나파 밸리   (나파의 모텔)
//   내추럴라이저 여성 블룸 로퍼             (구두)
//   뉴발란스 칼리아 메를로 740 린넨         (운동화)
//   루카리스 도쿄 화이트와인 리슬링          (와인잔 브랜드)
//
// 이것들이 검색·추천·둘러보기에 그대로 나온다. 값이 붙고 안 붙고를 떠나
// 앱의 얼굴을 깎는다.
//
// 어떻게 가르는가.
// 낱말 목록만으로는 안 된다 — "Demigny 라 롱제르 드 부르고뉴"에는 걸릴 말이
// 하나도 없다. 그래서 두 가지를 함께 본다.
//   ① 술이 아닌 것을 가리키는 말이 있는가 (호스탈 · 포우사다 · 로퍼 · 와인잔)
//   ② 술이라는 신호가 하나도 없는데 라틴 낱말로 시작하는가
// ②만으로 자르면 "OZV 진판델" 같은 진짜 와인이 죽는다. 그래서 품종·도수·
// 주종 같은 술 신호가 하나라도 있으면 살린다.
//
//   node --env-file=.env.local scripts/_catalog-junk.mjs           눈으로만
//   node --env-file=.env.local scripts/_catalog-junk.mjs --apply   표시를 남긴다

import { MongoClient } from "mongodb";
import { notDrinkReason } from "../lib/notDrink.js";

const APPLY = process.argv.includes("--apply");

// 술이 아닌 것을 가리키는 말. lib/notDrink.js 가 이미 많이 잡지만,
// 산지 이름으로 검색해 딸려 온 숙소는 그쪽에 없던 표현이 많다.
const JUNK = [
  // 숙소 — 여러 나라 말이 섞여 들어온다
  /호스탈|호스텔|포우사다|오베르지|아그리투리스모|카바냐|카바나스|오스텔로|알베르고/,
  /아파르타멘토|아파트먼트|레지던스|리트리트|롯지|샬레|방갈로|카사\s*루랄/,
  /퀄리티\s*인|홀리데이\s*인|베스트\s*웨스턴|이비스|노보텔|메르큐어/,
  // "인"은 산지 이름 앞에 올 때만 숙소다 ("네스트 인 키안티", "카사 디 캄파냐
  // 인 토스카나"). 그냥 두면 위스키의 "바틀 인 본드"가 걸린다.
  /\s인\s(키안티|토스카나|나파|보르도|부르고뉴|리오하|프로방스|모젤|피에몬테|시칠리아|알자스|움브리아)/,
  /비앤비|비\s*앤\s*비/,
  // 옷·신발·가방.
  //
  // 산지 이름이 옷의 색 이름으로 쓰인다. 보르도·바롤로·부르고뉴·토스카나가
  // 그렇고, 품종 이름도 마찬가지다("메를로 740 린넨"). 그래서 이 층이 두껍다 —
  // 보테가 베네타 베네토 다크 바롤로(가방), 알리지 팬츠 바롤로 체크,
  // 스텔라맥카트니 플리츠 드레스 오렌지, 오렐리 비더만 아이스링.
  /로퍼|스니커|샌들|부츠|힐\s*\d|플랫슈즈|슬리퍼|목걸이|귀걸이|반지|팔찌/,
  // "숄더"는 가방을 가리킬 때만 본다 — 위스키 몽키 숄더가 걸렸다
  /레더|가죽|토트|크로스백|클러치|지갑|벨트\b|숄더백|원숄더|버킷\s*백|미니백|백팩/,
  // "코트"는 옷이기도 하고 프랑스 산지이기도 하다 — 코트 뒤 론, 코트 로티,
  // 코트 드 뉘, 코트 도르. 뒤에 붙는 말로 가른다.
  // "점퍼"는 뺐다 — 와인 브랜드 투썩 점퍼가 걸렸다
  /팬츠|드레스|스커트|블라우스|블레이저|자켓|재킷|가디건|맨투맨|후디|패딩/,
  /코트(?!\s*(뒤|로티|드\s|샬로네즈|도르|보))/,
  /니트웨어|니트\b|스웨터|원피스|조끼|셔츠(?!백)|반팔|긴팔|민소매|양말|스타킹/,
  // "린넨"은 뺐다 — 댄싱사이더 프렌치 린넨 사이더가 걸렸다
  /캐시미어|자카드|스웨이드|양털|플리츠|테일러드|드로스트링/,
  /\b(knitwear|blazer|dress|pants|skirt|sweater|cardigan|hoodie|trench)\b/i,
  // 옷 시즌 코드는 두 방향으로 쓴다 — "25FW" 와 "FW26"
  /\b(FW|SS|AW)\s?\d{2}\b|\b\d{2}\s?(FW|SS|AW)\b/,
  // 여행 상품
  /일주\s*\d+일|\d+박\s*\d+일|옵션포함|자유여행|패키지\s*여행|왕복\s*항공/,
  // "주니어"는 뺐다 — 로버트 바일 주니어 리슬링이 걸렸다. 사람 이름에도 쓴다.
  /오프화이트|여성\s|남성\s|아동\s/,
  // 잔·도구.
  //
  // "잔"만으로 거르면 안 된다 — 마이클 포잔 샤르도네, 마스 드 도마스 가삭
  // 로제 프리잔테가 죽는다. 잔을 파는 목록에만 붙는 말을 본다.
  /루카리스|와인컵|와인잔|쥬스잔|주스잔|스템잔|롱스템|디저트컵|사선컵|글라스\s*세트/,
  /홈카페|놋쇠|유기\s*잔|수공예\s*유기|테이블\s*파티|와인마실때/,
  // "유리"는 앞에 한글이 붙지 않은 낱말일 때만 본다. 그냥 두면 사케 이름이
  // 걸린다 — 하쿠츠루 사유리, 로리앙 시라유리. 유리병은 진짜 상품 표기라 뺀다.
  /(?<![가-힣])유리(?!병)/,
  // "잔"이 낱말로 홀로 선 것만 본다. 진짜 술의 "잔"은 낱말 안에 있다 —
  // 프리잔테 · 마이클 포잔. 띄어쓰기로 갈린다.
  /(^|\s)잔(\s|$)/,
  // 반려동물·문구·기타
  /강아지|반려견|고양이|사료|하네스|볼펜|노트북|필통|다이어리/,
];

// 술이라는 신호. 하나라도 있으면 살린다.
const DRINK = [
  /카베르네|까베르네|메를로|피노|샤르도네|샤도네|리슬링|말벡|시라|쉬라|진판델/,
  /소비뇽|산지오베제|네비올로|템프라니요|그르나슈|카르메네르|모스카토|가메|슈냉/,
  /와인|샴페인|스파클링|포트\b|셰리|버무스|막걸리|약주|청주|소주|사케|위스키|맥주/,
  /\d+\s*(도|%)/,
  /샤또|샤토|도멘|보데가|퀸타|테누타|카사\s|빈야드|와이너리|셀러|브뤼|리제르바|리저브/,
  /레드|화이트|로제|루즈|로쏘|비앙코/,
];

function junkReason(name) {
  const s = String(name || "");
  // isNotDrink 를 그대로 쓰면 안 된다. 거기에는 "한글이 없고 술 단어도 없으면
  // 술이 아니다"라는 규칙이 있는데, 그것은 쇼핑몰에서 긁어 올 때 입구에서
  // 거르려고 만든 것이다. 이미 담긴 카탈로그에 들이대면 로마자로 적힌 우리 술
  // (Ipsaeju · Baekgeolli)과 Springbank 10 Year Old 가 통째로 죽는다.
  // 확실한 규칙만 보는 notDrinkReason 을 쓴다.
  if (notDrinkReason(s)) return "notDrink";
  for (const re of JUNK) if (re.test(s)) return String(re).slice(0, 26);
  // 라틴 낱말로 시작하고 뒤가 한글인데 술 신호가 하나도 없으면 딸려 온 것이다
  if (/^[A-Za-z][A-Za-z'’-]{2,}\s+[가-힣]/.test(s) && !DRINK.some((re) => re.test(s))) {
    return "라틴+술신호없음";
  }
  return null;
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col.find({}, { projection: { name: 1, category: 1, tier: 1 } }).toArray();
const flagged = [];
for (const d of docs) {
  const why = junkReason(d.name);
  if (why) flagged.push({ ...d, why });
}

const byCat = {};
for (const f of flagged) byCat[f.category] = (byCat[f.category] || 0) + 1;
console.log(`전체 ${docs.length}종 중 술 아님 ${flagged.length}종\n`);
console.log(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("");
// 정식 항목이 걸리면 위험 신호다 — AI 가 읽어서 술이라고 판단한 것들이다
const full = flagged.filter((f) => f.tier === "full");
console.log(`그중 정식(AI가 읽은 것) ${full.length}종 ${full.length ? "— 아래를 꼭 확인할 것" : ""}`);
full.slice(0, 20).forEach((f) => console.log(`   ⚠ ${f.name.slice(0, 44).padEnd(46)} ${f.why}`));
console.log("");
flagged.filter((f) => f.tier !== "full").slice(0, 60).forEach((f) =>
  console.log(`   ${f.name.slice(0, 46).padEnd(48)} ${f.why}`)
);

if (!APPLY) {
  console.log("\n눈으로만 봤습니다. 표시를 남기려면 --apply");
} else {
  // 지우지 않고 표시만 남긴다. 지우면 되돌릴 수 없고, 잘못 잡은 것이 섞여
  // 있을 수 있다. 검색·둘러보기가 이 표시를 보고 걸러 내면 된다.
  const r = await col.bulkWrite(
    flagged.map((f) => ({
      updateOne: { filter: { _id: f._id }, update: { $set: { notDrink: true, notDrinkWhy: f.why } } },
    })),
    { ordered: false }
  );
  console.log(`\n표시했습니다 — ${r.modifiedCount}종 (지우지 않았습니다)`);
}

await client.close();
process.exit(0);
