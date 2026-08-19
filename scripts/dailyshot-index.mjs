// 데일리샷 색인 — 국내 주류 가격의 자체 색인을 만든다.
//
// 왜 이걸 만드는가.
// 네이버 쇼핑 API 가 닫힌 뒤 값을 얻을 곳이 다나와뿐이었는데, 다나와는 위스키
// 말고는 못 쓴다 (lib/danawa.js 에 실측을 적어 두었다). 특히 와인이 0 이었다.
// 그런데 이 앱의 처음 목표 하나가 "사고 싶은 술을 담아 두면 값이 떨어질 때
// 알려 준다" 였고, 그 목표는 값 없이는 성립하지 않는다.
//
// 데일리샷은 전국 매장의 스마트오더 값을 모아 놓은 곳이고, robots.txt 가
// ClaudeBot 을 이름으로 허용한다. 상세 페이지가 서버에서 그려져 데이터가 그대로
// 실려 있다 — 검색 화면만 브라우저에서 그려질 뿐이다. 그래서 상품 번호만 알면
// 값을 읽을 수 있고, 번호는 사이트맵이 전부 알려 준다.
//
// 한 상품에 대표가 · 전국 최저가 · 최고가 · 파는 곳 수까지 들어 있다.
// 값을 파는 API 를 사는 것보다 낫고, 비용이 들지 않는다.
//
// 쓰는 법
//   node scripts/dailyshot-index.mjs            전체 (없는 것만 — 이어서 할 수 있다)
//   node scripts/dailyshot-index.mjs --refresh  이미 담은 것도 값을 다시 받는다
//   node scripts/dailyshot-index.mjs --limit 200
//
// 예의. 동시 5 · 묶음 사이 500ms 로 둔다. 실측에서 이 속도까지는 한 건도
// 안 놓쳤고, 더 밀어붙일 이유가 없다. 남의 서버다.

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

const UA = "ClaudeBot";
const HOST = "https://dailyshot.co";
const CONC = 5;
const GAP = 500;

const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const LIMIT = Number(args[args.indexOf("--limit") + 1]) || 0;

/**
 * 이 배포의 빌드 번호 — _next/data 주소에 들어간다.
 *
 * 상세 페이지 HTML 은 100KB 인데 _next/data 로 받으면 7KB 다. 같은 내용을
 * 15분의 1 로 받는다. 대신 이 번호는 배포할 때마다 바뀌므로 시작할 때 한 번 읽는다.
 */
async function buildId() {
  const r = await fetch(`${HOST}/m/item/5395`, { headers: { "user-agent": UA } });
  const t = await r.text();
  const m = t.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("빌드 번호를 못 찾았다 — 사이트 구조가 바뀌었을 수 있다");
  return m[1];
}

/** 사이트맵에 실린 상품 번호 전부 */
async function allIds() {
  const r = await fetch(`${HOST}/sitemap-items.xml`, { headers: { "user-agent": UA } });
  const t = await r.text();
  return [...t.matchAll(/\/m\/item\/(\d+)/g)].map((m) => m[1]);
}

/** 상세 한 건 → 우리가 쓸 모양으로 */
async function fetchItem(bid, id) {
  const r = await fetch(`${HOST}/_next/data/${bid}/m/item/${id}.json`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  const qs = (await r.json())?.pageProps?.dehydratedState?.queries || [];
  const d = qs.find((q) => q.queryKey?.[1] === "getItemDetailsByTopProducts")?.state?.data;
  const s = qs.find((q) => q.queryKey?.[1] === "getItemDetailsSnippet")?.state?.data;
  if (!d?.name) return null;

  // 용량·도수는 "정보" 표에 라벨로 붙어 있다. 이름만으로 맞히면 750ml 와 375ml 를
  // 같은 술로 보게 된다 — 값이 두 배 차이 나므로 반드시 갈라야 한다.
  const info = {};
  for (const row of d.information || []) if (row?.label) info[row.label] = row.value;

  const o = s?.offers || {};
  return {
    id: Number(id),
    name: d.name,
    nameEn: d.en_name || null,
    category: d.category_name || null,
    subcategory: d.subcategory_name || null,
    volume: info["용량"] || null,
    abv: info["도수"] || null,
    country: info["국가"] || null,
    price: num(d.price),
    low: num(o.lowPrice),
    high: num(o.highPrice),
    // 파는 곳이 몇이냐가 값을 믿을 근거다. 한 곳뿐인 값은 그 가게 값일 뿐이고,
    // 백 곳이 파는 값은 시세다. 화면에서 이 숫자로 표현을 가른다.
    sellers: num(o.offerCount) || 0,
    rating: num(d.review_rate) || null,
    reviews: num(d.review_count) || 0,
    image: d.thumbnail_image || null,
    url: `${HOST}/m/item/${id}`,
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
await col.createIndex({ category: 1 });
await col.createIndex({ name: 1 });

const bid = await buildId();
let ids = await allIds();
console.log(`빌드 ${bid} · 사이트맵 ${ids.length}건`);

if (!REFRESH) {
  const have = new Set((await col.find({}, { projection: { id: 1 } }).toArray()).map((d) => String(d.id)));
  ids = ids.filter((i) => !have.has(i));
  console.log(`이미 담은 것 ${have.size}건 빼고 ${ids.length}건`);
}
if (LIMIT) ids = ids.slice(0, LIMIT);

const t0 = Date.now();
let ok = 0, skip = 0, err = 0;
const now = new Date();

for (let i = 0; i < ids.length; i += CONC) {
  const got = await Promise.all(
    ids.slice(i, i + CONC).map(async (id) => {
      try {
        return await fetchItem(bid, id);
      } catch {
        err++;
        return null;
      }
    })
  );
  const rows = got.filter(Boolean);
  rows.forEach(() => ok++);
  skip += got.length - rows.length;

  if (rows.length) {
    await col.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { id: r.id },
          // 값 이력을 남긴다 — 목표가 알림은 "떨어졌다"를 알아야 하고,
          // 그건 어제 값을 알아야 말할 수 있다.
          update: {
            $set: { ...r, seenAt: now },
            $push: { history: { $each: [{ at: now, low: r.low, price: r.price }], $slice: -60 } },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  const done = i + got.length;
  if (done % 250 < CONC) {
    const sec = (Date.now() - t0) / 1000;
    const left = ((ids.length - done) * (sec / done)) / 60;
    console.log(`  ${done}/${ids.length} · 담음 ${ok} · 건너뜀 ${skip} · 오류 ${err} · 남은 ${left.toFixed(0)}분`);
  }
  await new Promise((z) => setTimeout(z, GAP));
}

console.log(`끝. 담음 ${ok} · 건너뜀 ${skip} · 오류 ${err} · ${((Date.now() - t0) / 60000).toFixed(1)}분`);
await client.close();
