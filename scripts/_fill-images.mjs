// 카탈로그 상품 사진 채우기 — 이미지 검색으로 판매처 사진 "주소"만 저장한다.
// (내려받아 재배포하지 않고 주소만 연결한다 — 저작권 원칙)
//
// 예전 판은 쇼핑 검색 API를 썼는데 2026-07-31 에 종료됐다. 이미지 검색은 살아 있고,
// 그 결과 안에 네이버쇼핑이 서비스하는 상품 사진이 섞여 들어온다.
// lib/naver.js 의 searchGoodsImage 와 같은 판단 기준을 쓴다 — 화면과 다른 사진이 들어가면 안 된다.
//
// 사용: node scripts/_fill-images.mjs <category|all> [limit] [--dry]
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const category = process.argv[2] || "all";
const limit = Number(process.argv[3] || 200);
const dry = process.argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 네이버쇼핑이 서비스하는 상품 사진만 받는다.
// 이미지 검색은 커뮤니티·뉴스 사진까지 함께 주는데, 상업 앱에 그것을 붙일 수는 없다.
// 또 일부 CDN(dthumb-phinf)은 외부에서 부르면 403 이라 화면에서 깨진다.
const SHOP_IMAGE_HOST = /^shop(ping)?\d*[-.]phinf\.(naver|pstatic)\.net$/i;

function isShopImage(url) {
  try {
    return SHOP_IMAGE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function httpsImage(url) {
  return String(url || "").replace(/^http:/, "https:");
}

const compact = (s) =>
  String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function searchImage(q) {
  const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=40&sort=sim`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
    },
  });
  if (res.status === 429) { await sleep(3000); return searchImage(q); }
  if (!res.ok) throw new Error(`naver ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return (await res.json()).items || [];
}

// 병에만 붙는 표시 — 술을 파는 글은 용량이나 도수를 거의 반드시 적는다
const BOTTLE_MARK =
  /\d+\s*(ml|mL|ML|리터)\b|\d+(\.\d+)?\s*L\b|\d+(\.\d+)?\s*도(?![시자])|\d+(\.\d+)?\s*%|\b(19|20)\d{2}\b/;

// 술이 아닌 것들. 시험 결과 이것들이 술 이름을 달고 올라온다 —
// 샤또 코스 데스투르넬을 찾는데 "샤또브리앙 안심스테이크"가, 테라를 찾는데
// "술집 인테리어 포스터"가 왔다. 잘못된 사진은 없는 것만 못하다.
const NOT_A_BOTTLE =
  /잔|글라스|글래스|와인잔|디캔터|오프너|코르크|스크류|받침|랙|셀러|냉장고|포스터|액자|스티커|소품|인테리어|굿즈|가방|티셔츠|모형|장식|캔들|비누|향수|안주|스테이크|고기|한우|세트상품|박스|케이스|가방|파우치|쇼핑백|정육|육포|치즈|과자/;

/**
 * 찾는 술의 사진인지 본다. 이름이 겹치지 않는 사진을 붙이면
 * 다른 술 사진을 이 술이라고 보여 주는 셈이라, 없느니만 못하다.
 *
 * 그래서 느슨하게 맞히기보다 엄하게 거른다. 셋을 모두 넘겨야 채택한다.
 *   ① 이름의 낱말이 전부 들어 있을 것 (하나라도 빠지면 다른 물건일 수 있다)
 *   ② 병에 붙는 표시(용량·도수·빈티지)가 있을 것
 *   ③ 술이 아닌 물건의 말이 없을 것
 */
function pick(items, q) {
  const want = compact(q);
  const words = String(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  for (const it of items) {
    const image = httpsImage(it.link);
    if (!isShopImage(image)) continue;
    const title = String(it.title || "").replace(/<[^>]+>/g, "");
    const t = compact(title);

    if (NOT_A_BOTTLE.test(title)) continue;
    if (!BOTTLE_MARK.test(title)) continue;

    // 이름 전체가 통째로 들어 있거나, 낱말이 하나도 빠짐없이 들어 있어야 한다
    const hit = t.includes(want) || (words.length > 1 && words.every((w) => t.includes(compact(w))));
    if (!hit) continue;
    return { image, title };
  }
  return null;
}

function candidates(doc) {
  const base = (doc.searchKeyword || doc.name || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const words = base.split(" ");
  return [...new Set([base, words.slice(0, 3).join(" "), words.slice(0, 2).join(" ")])]
    .filter((q) => q.length >= 2);
}

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const filter = {
  tier: "full",
  $or: [{ image: null }, { image: { $exists: false } }, { image: "" }],
  ...(category === "all" ? {} : { category }),
};
const targets = await col
  .find(filter, { projection: { name: 1, searchKeyword: 1, category: 1 } })
  .limit(limit)
  .toArray();

console.log(`대상: ${targets.length}건 (${category})${dry ? " [시험]" : ""}`);
let filled = 0, missed = 0, calls = 0;

for (const doc of targets) {
  try {
    let hit = null;
    for (const q of candidates(doc)) {
      await sleep(180); // 몰아 부르면 빈 응답이 온다
      calls++;
      hit = pick(await searchImage(q), q);
      if (hit) break;
    }
    if (hit) {
      if (!dry) {
        await col.updateOne(
          { _id: doc._id },
          { $set: { image: hit.image, imageSource: "naver-image", imageCheckedAt: new Date() } }
        );
      }
      filled++;
      if (dry) console.log(`  ✓ ${doc.name} ← ${hit.title.slice(0, 50)}`);
      else if (filled % 20 === 0) console.log(`  …${filled}건 연결`);
    } else {
      // 다시 두드리지 않게 확인 시각만 남긴다
      if (!dry) await col.updateOne({ _id: doc._id }, { $set: { imageCheckedAt: new Date() } });
      missed++;
      if (dry) console.log(`  ✗ ${doc.name}`);
    }
  } catch (e) {
    console.log(`중단: ${doc.name} — ${e.message}`);
    break; // 키 문제면 전부 실패한다
  }
}

console.log(`\n연결 ${filled} · 못 찾음 ${missed} · 호출 ${calls}건`);
await client.close();
