// 카탈로그 오염 점검 — 술이 아닌 것과 이름이 깨진 것을 찾는다.
//
// 뼈대(stub)는 상품 목록에서 긁어 만들었기 때문에 잔·세트·굿즈가 섞여 들어온다.
// "1865 카카오 튜브 골프백"이 와인 카탈로그에 있으면 검색·추천이 그것을 술로 내놓는다.
// 사용: node scripts/_audit-pollution.mjs [--fix]
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const fix = process.argv.includes("--fix");

// 술이 아닌 물건 — 이 말이 이름에 있으면 술로 볼 수 없다
const NOT_DRINK = [
  /골프백|골프공|골프|캐디백/,
  /가방|파우치|쇼핑백|보냉백|캐리어/,
  /잔\b|글라스|글래스|디캔터|오프너|코르크 ?스크류|스토퍼|푸어러|아이스볼|얼음틀/,
  /셀러\b|와인렉|와인랙|거치대|받침대|진열대|냉장고/,
  /포스터|액자|스티커|소품|인테리어|조명|캔들|디퓨저|방향제/,
  /티셔츠|모자|앞치마|수건|타올|우산|볼펜|텀블러|머그/,
  /상품권|기프트 ?카드|교환권|쿠폰/,
  /안주\b|육포|치즈 ?세트|과자|견과|건조|말린/,
  /모형|미니어처 ?장식|장식품|피규어/,
  /책\b|도서|잡지|매거진/,
];

// 이름이 깨진 것 — 여는 괄호 없이 닫는 괄호로 시작하거나, 기호로 시작하는 것
const BROKEN_NAME = [
  /^[)\]}）】]/,
  /^[,.\-·/|]/,
  /^\s/,
  /^[a-z]{1,2}\d{3,}$/i, // 상품코드만 남은 것
];

// 규칙에 걸리지만 실존하는 술 — 웹으로 확인하고 손으로 풀어 준 목록.
// 규칙만 믿고 지우면 진짜 술을 잃는다. 실제로 이 둘이 그랬다.
//   내장산복분자주 골프1호 골드 — 11번가·SSG 판매 확인
//   빌라골프 이글 — 칠레 마울레 밸리, 와인21 등재 확인
const ALLOWLIST = new Set([
  "내장산 복분자주 골프1호 골드 16도",
  "빌라골프 이글 샤르도네",
]);

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const all = (await col.find({}, { projection: { name: 1, key: 1, tier: 1, category: 1 } }).toArray())
  .filter((d) => !ALLOWLIST.has(d.name));
console.log(`카탈로그 ${all.length}건 점검\n`);

const notDrink = [];
const broken = [];
for (const d of all) {
  const n = String(d.name || "");
  if (NOT_DRINK.some((re) => re.test(n))) notDrink.push(d);
  else if (BROKEN_NAME.some((re) => re.test(n))) broken.push(d);
}

const show = (arr, title) => {
  console.log(`${title}: ${arr.length}건`);
  const full = arr.filter((d) => d.tier === "full");
  if (full.length) console.log(`  ⚠ 그중 정식 분석 ${full.length}건: ${full.map((d) => d.name).join(" · ")}`);
  for (const d of arr.slice(0, 25)) console.log(`  ${d.tier === "full" ? "★" : "·"} [${d.category}] ${d.name}`);
  if (arr.length > 25) console.log(`  … 외 ${arr.length - 25}건`);
  console.log();
};

show(notDrink, "술이 아닌 것");
show(broken, "이름이 깨진 것");

if (fix) {
  // 정식 분석된 것은 지우지 않는다 — 사람이 확인해야 한다.
  // 뼈대만 지운다. 뼈대는 언제든 다시 만들 수 있고, 남겨 두면 검색을 더럽힌다.
  const ids = [...notDrink, ...broken].filter((d) => d.tier !== "full").map((d) => d._id);
  if (ids.length) {
    const r = await col.deleteMany({ _id: { $in: ids } });
    console.log(`뼈대 ${r.deletedCount}건 삭제 (정식 분석은 손대지 않음)`);
  } else {
    console.log("삭제할 뼈대가 없습니다.");
  }
} else {
  console.log("(--fix 를 붙이면 뼈대만 삭제합니다. 정식 분석은 손대지 않습니다)");
}
await client.close();
