// 상품 사진 채우기 — 11번가 오픈 API 판.
//
// 네이버 이미지 검색으로는 안 된다는 것을 시험으로 확인했다.
// 느슨하게 맞히면 엉뚱한 사진이 붙고(샤또 코스 데스투르넬에 안심스테이크 사진),
// 엄하게 거르면 25건에 0건이었다. 잘못된 사진은 없는 것만 못하므로 그 길은 닫았다.
//
// 11번가는 상품 검색이 살아 있어 사진과 값을 함께 준다 — 이쪽이 본래 자리다.
// .env.local 에 ELEVENST_KEY 를 넣으면 이 스크립트가 돈다.
//
// 사용: node scripts/_fill-images-11st.mjs <category|all> [limit] [--dry]
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.ELEVENST_KEY) {
  console.log("ELEVENST_KEY 가 없습니다. https://openapi.11st.co.kr 에서 발급한 뒤 .env.local 에 넣어 주세요.");
  process.exit(1);
}

const category = process.argv[2] || "all";
const limit = Number(process.argv[3] || 200);
const dry = process.argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const compact = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const BOTTLE_MARK =
  /\d+\s*(ml|mL|ML|리터)\b|\d+(\.\d+)?\s*L\b|\d+(\.\d+)?\s*도(?![시자])|\d+(\.\d+)?\s*%|\b(19|20)\d{2}\b/;
const NOT_A_BOTTLE =
  /잔|글라스|글래스|디캔터|오프너|코르크|스크류|받침|랙|셀러|냉장고|포스터|액자|스티커|소품|인테리어|굿즈|모형|장식|안주|스테이크|한우|육포|치즈|과자/;

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1].trim() : "";
}

async function search(q) {
  const url =
    `http://openapi.11st.co.kr/openapi/OpenApiService.tmall?key=${encodeURIComponent(env.ELEVENST_KEY)}` +
    `&apiCode=ProductSearch&keyword=${encodeURIComponent(q)}&pageSize=40&sortCd=CP`;
  const res = await fetch(url);
  const xml = new TextDecoder("euc-kr").decode(await res.arrayBuffer());
  if (/<ErrorCode>/.test(xml)) throw new Error(`11st ${tag(xml, "ErrorCode")}: ${tag(xml, "ErrorMessage")}`);
  return xml.match(/<Product>[\s\S]*?<\/Product>/g) || [];
}

/** 네이버 판과 같은 기준으로 거른다 — 화면끼리 다른 사진이 들어가면 안 된다 */
function pick(blocks, q) {
  const want = compact(q);
  const words = String(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  for (const b of blocks) {
    const title = tag(b, "ProductName").replace(/<[^>]+>/g, "").trim();
    const image = (tag(b, "ProductImage300") || tag(b, "ImageUrl") || "").replace(/^http:/, "https:");
    if (!title || !image) continue;
    if (NOT_A_BOTTLE.test(title)) continue;
    if (!BOTTLE_MARK.test(title)) continue;
    const t = compact(title);
    if (!(t.includes(want) || (words.length > 1 && words.every((w) => t.includes(compact(w)))))) continue;
    const price = Number(String(tag(b, "SalePrice") || tag(b, "ProductPrice")).replace(/[^\d]/g, ""));
    return { image, title, price: price || null };
  }
  return null;
}

function candidates(doc) {
  const base = (doc.searchKeyword || doc.name || "")
    .replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
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
  .find(filter, { projection: { name: 1, searchKeyword: 1 } })
  .limit(limit)
  .toArray();

console.log(`대상: ${targets.length}건 (${category})${dry ? " [시험]" : ""}`);
let filled = 0, missed = 0;

for (const doc of targets) {
  try {
    let hit = null;
    for (const q of candidates(doc)) {
      await sleep(200);
      hit = pick(await search(q), q);
      if (hit) break;
    }
    if (hit) {
      if (!dry) {
        await col.updateOne(
          { _id: doc._id },
          { $set: { image: hit.image, imageSource: "11st", imageCheckedAt: new Date() } }
        );
      }
      filled++;
      if (dry) console.log(`  ✓ ${doc.name} ← ${hit.title.slice(0, 50)}${hit.price ? ` (${hit.price.toLocaleString()}원)` : ""}`);
    } else {
      missed++;
      if (dry) console.log(`  ✗ ${doc.name}`);
    }
  } catch (e) {
    console.log(`중단: ${doc.name} — ${e.message}`);
    break;
  }
}

console.log(`\n연결 ${filled} · 못 찾음 ${missed}`);
await client.close();
