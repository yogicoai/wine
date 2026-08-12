// 순희 항목 교정 — 추정으로 채워져 있던 것을 확인된 사실로 바꾼다.
//
// 원래 문서는 신뢰도 55에 "Unknown craft brewery (unidentified)" 였고,
// 본문이 한국어로 적혀 있었다(전통술 앱은 영어 앱이다). 라벨을 못 알아본 채
// "세라믹 병에 담긴 13% 약주"로 추측해 둔 상태였다.
//
// 확인한 사실 — 보해양조가 만드는 살균 탁주(막걸리)다.
//   750ml · 국내산 쌀 100% · 저온살균(파스퇴르) 공법
//   2026년 3월 리뉴얼: 아스파탐 제거, 도수 6% → 5%
//   대형마트 기준 1,700원대 · 350ml 캔도 있다
// (출처: 서울신문·식품외식경제·다음뉴스 2026-03-04 리뉴얼 보도)
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const KEY = "sunhui순희traditionalriceliquor|";

const result = {
  found: true,
  confidence: 88,
  knowledge: "rich",
  basis:
    "Bohae Brewery product information and Korean press coverage of the March 2026 relaunch, which removed aspartame and lowered the strength.",
  category: "traditional",
  name: "Sunhui (순희) Makgeolli",
  searchKeyword: "보해 순희 막걸리",
  producer: "Bohae Brewery",
  type: "Pasteurized makgeolli (rice beer)",
  vintage: null,
  region: "Jeollanam-do",
  country: "South Korea",
  alcohol: "5%",
  liquidColor: "#F3EFE6",
  tasteProfile: [
    { axis: "바디", value: 42 },
    { axis: "감칠맛", value: 45 },
    { axis: "산도", value: 45 },
    { axis: "당도", value: 38 },
  ],
  tastingNotes:
    "Milky and lightly tangy, with the soft cereal sweetness of rice rather than added sugar. Since the 2026 relaunch dropped the artificial sweetener, the finish is drier and cleaner than most supermarket makgeolli — closer to plain rice than to candy.",
  specs: [
    { label: "Main ingredient", value: "100% Korean rice" },
    { label: "Processing", value: "Pasteurized (not live/unpasteurized)" },
    { label: "Bottle", value: "750ml (a 350ml can is also sold)" },
    { label: "Sweetener", value: "None — aspartame removed in the 2026 relaunch" },
  ],
  ibu: null,
  srm: null,
  drinkFrom: null,
  drinkPeak: null,
  drinkUntil: null,
  history: [
    { year: "2026", event: "Relaunched without aspartame, with strength lowered from 6% to 5%" },
  ],
  story:
    "Sunhui is an old-fashioned Korean woman's name, and the bottle is styled to match — a deliberately nostalgic label for a very ordinary drink. What makes it worth knowing is what it leaves out. Most cheap Korean makgeolli is sweetened with aspartame; Bohae took it out and let the rice speak instead. It is also pasteurized, so unlike live makgeolli it keeps for months and will not fizz over when you open it.",
  winery:
    "Bohae Brewery is a long-standing drinks maker from Jeollanam-do in the southwest of Korea, best known nationally for its bokbunja (black raspberry) wine and soju.",
  foodPairing: [
    {
      emoji: "🥞",
      food: "Pajeon (savory scallion pancake)",
      why: "Makgeolli with pajeon on a rainy day is a national ritual — the tang cuts the fried batter",
      shopKeyword: "해물파전 밀키트",
    },
    {
      emoji: "🌶️",
      food: "Tteokbokki (spicy rice cakes)",
      why: "The cool, milky body puts out the chili heat",
      shopKeyword: "떡볶이 밀키트",
    },
    {
      emoji: "🍖",
      food: "Bossam (boiled pork with wraps)",
      why: "Light acidity keeps the fatty pork from feeling heavy",
      shopKeyword: "보쌈",
    },
  ],
  pairingTip:
    "Treat it like a light beer at the table — it goes with anything fried, spicy, or salty.",
  avoidPairing:
    "Delicate raw fish. The cloudy body flattens subtle flavors rather than lifting them.",
  ratings: [],
  similar: ["Jangsu Makgeolli (장수 막걸리)", "Kooksoondang Makgeolli (국순당 생막걸리)", "Jipyeong Makgeolli (지평 막걸리)"],
  trivia:
    "Because it is pasteurized rather than live, this is one of the few makgeolli you can carry home in a suitcase — live makgeolli keeps fermenting and can burst its bottle on a plane.",
  servingTemp: "5–10°C",
  servingNote:
    "Turn the bottle gently upside down a few times before pouring — the rice settles at the bottom. Korean custom is to fill other people's bowls before your own, and to receive with both hands from someone older.",
  aging: "Pasteurized, so it keeps unopened for months. Once opened, refrigerate and finish within a few days.",
  tips: [
    "Shaking makes it foam over — invert it slowly instead.",
    "Widely stocked at Homeplus; less commonly found at other chains.",
    "At around ₩2,000 a bottle, this is one of the cheapest ways to try real Korean rice brewing.",
  ],
};

const ja = {
  name: "スニ (순희) マッコリ",
  type: "殺菌マッコリ（米の醸造酒）",
  region: "全羅南道(チョルラナムド)",
  country: "韓国",
  basis: "ポヘ醸造の製品情報と、2026年3月のリニューアル（アスパルテーム不使用・度数引き下げ）を報じた韓国メディアの記事にもとづきます。",
  tastingNotes:
    "乳白色で、ほのかな酸味があります。加えた砂糖ではなく、米そのもののやわらかな甘みが感じられます。2026年のリニューアルで人工甘味料をやめたため、市販のマッコリのなかでは後味がすっきりとドライです。",
  specs: [
    { label: "主原料", value: "韓国産米100%" },
    { label: "製法", value: "殺菌（生マッコリではありません）" },
    { label: "容量", value: "750ml（350ml缶もあります）" },
    { label: "甘味料", value: "不使用 — 2026年のリニューアルでアスパルテームを除きました" },
  ],
  history: [
    { year: "2026年", event: "アスパルテームを使わず、度数を6%から5%に下げてリニューアル" },
  ],
  story:
    "「スニ（순희）」は韓国で昔ながらの女性の名前です。ラベルも、その名にふさわしい懐かしい雰囲気にまとめられています。この一本で知っておきたいのは、むしろ「入れていないもの」です。韓国の安価なマッコリの多くはアスパルテームで甘みをつけますが、ポヘはそれをやめ、米の味わいをそのまま生かしました。また殺菌済みなので、生マッコリと違って日持ちし、開けたときに吹きこぼれる心配もありません。",
  winery:
    "ポヘ醸造は韓国南西部・全羅南道の老舗の酒造メーカーで、韓国ではポップンジャ（覆盆子＝キイチゴ）酒や焼酎で広く知られています。",
  foodPairing: [
    { emoji: "🥞", food: "パジョン（ねぎのチヂミ）", why: "雨の日のマッコリとチヂミは韓国の定番。酸味が揚げ衣の油をすっきりさせます", shopKeyword: "해물파전 밀키트" },
    { emoji: "🌶️", food: "トッポッキ", why: "冷たく乳のようなコクが、唐辛子の辛さをやわらげます", shopKeyword: "떡볶이 밀키트" },
    { emoji: "🍖", food: "ポッサム（茹で豚の葉包み）", why: "軽い酸味が豚の脂を重く感じさせません", shopKeyword: "보쌈" },
  ],
  pairingTip: "食卓では軽いビールのような立ち位置です。揚げ物・辛いもの・塩気のあるものに広く合います。",
  avoidPairing: "繊細なお刺身。濁った質感が、かすかな味わいを覆ってしまいます。",
  trivia:
    "生マッコリと違って殺菌してあるため、スーツケースに入れて持ち帰れる数少ないマッコリです。生マッコリは瓶の中で発酵が続き、機内で破裂することがあります。",
  servingTemp: "5〜10℃",
  servingNote:
    "注ぐ前に瓶をそっと上下に返してください。米が底に沈んでいます。韓国では自分より先に相手の器を満たし、目上の方からは両手で受けるのが作法です。",
  aging: "殺菌済みなので未開栓なら数か月もちます。開栓後は冷蔵し、数日以内に飲み切ってください。",
  tips: [
    "振ると吹きこぼれます。ゆっくり上下に返してください。",
    "ホームプラスで広く扱われています。ほかのチェーンではあまり見かけません。",
    "1本2,000ウォンほど。韓国の米の醸造酒を試す、いちばん手軽な入口です。",
  ],
};

const priceInfo = {
  krwLow: 1700,
  krwHigh: 2500,
  volume: "750ml",
  basis: "대형마트·편의점 판매가",
  usdLow: null,
  usdHigh: null,
  asOf: "2026-08",
  confidence: 85,
};

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const before = await col.findOne({ key: KEY }, { projection: { name: 1 } });
if (!before) {
  console.log("문서를 찾지 못했습니다:", KEY);
} else {
  await col.updateOne(
    { key: KEY },
    {
      $set: {
        name: result.name,
        producer: result.producer,
        searchKeyword: result.searchKeyword,
        result,
        priceBand: 1,
        priceInfo,
        "i18n.ja": ja,
        updatedAt: new Date(),
      },
    }
  );
  console.log(`교정: ${before.name} → ${result.name}`);
  console.log("  본문 영어화 · 제조사 확정(보해양조) · 도수 5% · 살균 탁주 · 시세 부착");
}
await client.close();
