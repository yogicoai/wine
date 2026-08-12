// 시세 조사가 잡아낸 사케 데이터 오류 교정.
//
// 값을 조사하러 보낸 에이전트들이 값이 아니라 대상의 잘못을 찾아왔다.
// 웹으로 하나하나 확인하고 손으로 판정한 결과를 여기 적는다.
//
// ① 雅乃智(미야비노토모) 나카도리 = 자쿠(作) 미야비노토모 나카도리 — 같은 술이다.
//    雅乃智 는 清水清三郎商店(미에현 스즈카시)의 「作」 시리즈 안에 있는 이름인데,
//    중복 문서 쪽은 생산자를 치요주조(나라)로 잘못 적어 두었다. 중복을 지운다.
//    확인: jizake.com·三重問屋 등 일본 판매처 다수, 이세시마 정상회의 건배주 시리즈.
//
// ② 간바레 오토짱 "준마이" — 그런 등급이 없다.
//    がんばれ父ちゃん 은 白龍酒造(니가타현 아가노시)의 普通酒 종이팩이 전부다.
//    원료 표시에 醸造アルコール·糖類 가 들어가 준마이가 될 수 없다.
//    '간바레 오또상 팩'과 같은 술이므로 병합한다.
//    덤으로 남는 쪽의 생산자도 틀려 있었다(소야마혼케/사이타마 → 白龍酒造/니가타).
//    확인: 라쿠텐·야후쇼핑·酒楽SHOP 상품 표기, 白龍酒造 소개(니가타 아가노시, 1839년 창업).
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const fix = process.argv.includes("--fix");

const KEEP_ZAKU = "자쿠미야비노토모나카도리준마이다이긴죠|";
const DROP_ZAKU = "雅乃智미야비노토모나카도리준마이다이긴죠|";
const KEEP_GANBARE = "간바레오또상팩|";
const DROP_GANBARE = "간바레오토짱준마이|";

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

async function drop(key, keepKey) {
  const d = await col.findOne({ key }, { projection: { name: 1, hits: 1 } });
  if (!d) return console.log(`이미 없음: ${key}`);
  // 조회 수는 남는 쪽으로 넘긴다 — 인기 순서가 병합 때문에 흔들리지 않게
  if (fix) {
    if (d.hits) await col.updateOne({ key: keepKey }, { $inc: { hits: d.hits } });
    await col.deleteOne({ key });
  }
  console.log(`${fix ? "병합" : "병합 예정"}: ${d.name} → (${keepKey})`);
}

await drop(DROP_ZAKU, KEEP_ZAKU);
await drop(DROP_GANBARE, KEEP_GANBARE);

// 남는 간바레 문서의 생산자·산지·도수를 바로잡는다
const g = await col.findOne({ key: KEEP_GANBARE });
if (!g) {
  console.log("간바레 문서를 찾지 못했습니다");
} else {
  const set = {
    producer: "하쿠류 주조 (白龍酒造)",
    "result.producer": "하쿠류 주조 (白龍酒造)",
    "result.region": "니가타현 아가노시",
    "result.alcohol": "14%",
    "result.winery":
      "하쿠류 주조는 1839년 니가타현 아가노시에서 문을 연 양조장입니다. 고급 브랜드보다 매일 마시는 술을 넓게 만들어 온 곳으로, '간바레 오또상'은 그중에서도 한국에서 유독 많이 팔린 종이팩 사케입니다.",
    "result.basis":
      "일본 판매처(라쿠텐·야후쇼핑·酒楽SHOP) 상품 표기와 白龍酒造 소개를 확인했습니다. 니가타산 쌀, 정미보합 70%, 도수 14%의 후츠슈입니다.",
    // 일본어 층의 잘못된 양조장 서술도 함께 고친다 (기후현 다카야마로 적혀 있었다)
    "i18n.ja.region": "新潟県阿賀野市",
    "i18n.ja.winery":
      "白龍酒造は1839年、新潟県阿賀野市に創業した酒蔵です。高級銘柄よりも日々の晩酌酒を幅広く手がけてきた蔵で、「がんばれ父ちゃん」はその中でも韓国でとりわけよく飲まれている紙パックの日本酒です。",
    "i18n.en.region": "Agano, Niigata",
    "i18n.en.winery":
      "Hakuryu Shuzo was founded in 1839 in Agano, Niigata. It has built its name on everyday drinking sake rather than prestige labels, and Ganbare Otosan is the carton sake from that lineup that took off in Korea.",
  };
  const specs = (g.result?.specs || []).map((s) =>
    /정미|精米/.test(s.label) ? { ...s, value: "70%" } : s
  );
  if (specs.length) set["result.specs"] = specs;

  if (fix) await col.updateOne({ _id: g._id }, { $set: set });
  console.log(`${fix ? "교정" : "교정 예정"}: 간바레 오또상 팩 — 생산자 소야마혼케(사이타마) → 하쿠류 주조(니가타), 도수 14%`);
}

if (!fix) console.log("\n(--fix 를 붙여야 실제로 반영됩니다)");
await client.close();
