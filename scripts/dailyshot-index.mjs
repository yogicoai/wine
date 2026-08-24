// 데일리샷 색인 — 국내 주류 가격의 자체 색인.
//
// 왜 이걸 만드는가.
// 네이버 쇼핑 API 가 2026-07-31 에 닫힌 뒤 값을 얻을 곳이 다나와뿐이었는데,
// 다나와는 위스키 말고는 못 쓴다 (lib/danawa.js 에 실측을 적어 두었다).
// 특히 와인이 0 이었다. 그런데 이 앱의 처음 목표 하나가 "사고 싶은 술을 담아
// 두면 값이 떨어질 때 알려 준다" 였고, 그 목표는 값 없이는 성립하지 않는다.
//
// 어떻게 받는가 — 두 번 바뀌었다.
//
// 처음에는 사이트맵에서 상품 번호 25,395 개를 얻어 상세 페이지를 한 장씩 읽었다.
// 페이지가 서버에서 그려져 데이터가 HTML 안에 실려 있었기 때문이다. 24,776 건에
// 158 분이 걸렸다.
//
// 2026-08-24 에 데일리샷이 배포를 하면서 최저가·판매처 수가 서버 응답에서 빠졌다.
// 그 값이 어디로 갔는지 찾다가 진짜 API 를 발견했다 (api.dailyshot.co). 목록을
// 99 건씩 주므로 같은 일이 몇 분이면 끝나고, 상품 번호도 두 가지를 다 준다 —
// 페이지 주소에 쓰이는 top_product_id 와, 판매처 조회에 필요한 item id.
//
// 값의 성격도 이쪽이 낫다. 예전 최저가는 면세점과 30ml 시음 잔값이 섞여 있어
// 조니워커 킹 조지 5세가 100 원으로 나왔다. 이제는 판매처를 종류별로 갈라
// 볼 수 있어 "매장 픽업으로 지금 살 수 있는 값"만 골라낼 수 있다.
//
// 쓰는 법
//   node scripts/dailyshot-index.mjs             전체 주종
//   node scripts/dailyshot-index.mjs 43 22       와인·위스키만 (분류 번호)
//   node scripts/dailyshot-index.mjs --pages 3   주종별 3쪽만 (시험용)

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 윈도 경로에는 공백이 들어간다. URL 의 pathname 을 그냥 쓰면 "%20" 이 남아
// 파일을 못 찾는다. 게다가 그 실패를 조용히 삼키면 MONGODB_URI 가 빈 채로
// 진행되어, 엉뚱한 자리(몽고 연결)에서 터진다. 그래서 삼키지 않고 여기서 세운다.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const env = {};
// 줄 나눔은 \r 까지 함께 떼야 한다. 자바스크립트의 . 은 \r 을 먹지 않아서
// /^([A-Z_0-9]+)=(.*)$/ 가 윈도 줄바꿈 파일에서는 한 줄도 못 잡는다.
for (const line of readFileSync(`${ROOT}/.env.local`, "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.MONGODB_URI) throw new Error(`.env.local 에 MONGODB_URI 가 없다 — ${ROOT}`);

const API = "https://api.dailyshot.co";
// 브라우저가 붙여 보내는 것과 같은 표시. 없으면 응답이 달라진다.
const HEAD = {
  "user-agent": "ClaudeBot",
  "dailyshot-web": "1",
  "encrypted-web": "1",
  accept: "application/json",
};
const PAGE = 99; // 더 크게 불러도 99 까지만 준다
const GAP = 350;

// 데일리샷의 분류 번호 → 우리가 아는 이름. /m/recommendation 이 알려 준 표다.
const CATEGORIES = [
  [22, "위스키"],
  [43, "와인"],
  [5, "맥주"],
  [42, "사케"],
  [7, "우리술"],
  [40, "리큐르"],
  [145, "백주"],
  [48, "브랜디"],
  [58, "럼"],
  [28, "기타"],
  [125, "주류 용품"],
];

const args = process.argv.slice(2);
const maxPages = Number(args[args.indexOf("--pages") + 1]) || 0;
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
const wanted = only.length ? CATEGORIES.filter(([id]) => only.includes(id)) : CATEGORIES;

async function page(categoryId, n) {
  const url = `${API}/items/?page=${n}&page_size=${PAGE}&category_id=${categoryId}&include_sold_out=0`;
  const r = await fetch(url, { headers: HEAD, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

/** 목록 한 건 → 우리가 담을 모양 */
function shape(x, categoryName) {
  return {
    // 사람이 여는 주소에 쓰이는 번호. 예전 수집본과 이어지는 열쇠라 그대로 둔다.
    id: Number(x.top_product_id),
    // 판매처를 물을 때 쓰는 번호. 예전 수집본에는 없던 것이고, 이것이 있어야
    // "매장 픽업으로 지금 살 수 있는 최저가"를 낼 수 있다.
    itemId: Number(x.id),
    name: x.name,
    category: categoryName,
    subcategory: x.subcategory || null,
    price: num(x.price),
    rating: num(x.review_rate),
    reviews: num(x.review_count) || 0,
    vivino: num(x.vivino_score),
    image: x.thumbnail_image || null,
    url: `https://dailyshot.co/m/item/${x.top_product_id}`,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── 실행 ────────────────────────────────────────────────

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("dailyshot");
await col.createIndex({ id: 1 }, { unique: true });
await col.createIndex({ itemId: 1 });
await col.createIndex({ category: 1 });

const t0 = Date.now();
let total = 0;
let fresh = 0;

for (const [catId, catName] of wanted) {
  let n = 1;
  let count = null;
  let got = 0;

  while (true) {
    let data;
    try {
      data = await page(catId, n);
    } catch (e) {
      console.log(`  ! ${catName} ${n}쪽 실패 — ${e.message}`);
      break;
    }
    if (count === null) count = data.count ?? 0;
    const rows = (data.results || []).map((x) => shape(x, catName)).filter((r) => r.id && r.itemId);
    if (!rows.length) break;

    const before = await col.countDocuments({ id: { $in: rows.map((r) => r.id) } });
    await col.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { id: r.id },
          // 예전 수집본에는 용량·도수·국가가 들어 있다. 목록 API 는 그것을 주지
          // 않으므로 덮어쓰면 잃는다. 새로 아는 것만 채우고 나머지는 둔다.
          update: { $set: { ...r, seenAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    fresh += rows.length - before;
    got += rows.length;
    total += rows.length;

    if (!data.next || (maxPages && n >= maxPages)) break;
    n = data.next;
    await new Promise((z) => setTimeout(z, GAP));
  }

  console.log(`${catName.padEnd(7)} ${String(got).padStart(6)} / ${count ?? "?"}`);
  await new Promise((z) => setTimeout(z, GAP));
}

console.log(`\n끝. ${total}건 (새로 담은 것 ${fresh}건) · ${((Date.now() - t0) / 60000).toFixed(1)}분`);
await client.close();
