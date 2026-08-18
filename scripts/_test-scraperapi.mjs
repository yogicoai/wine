// ScraperAPI 시험 — 계약 전에 무료 구간으로 확인한다.
//
// 무엇을 재는가.
//   ① 어느 조합이 통하는가        기본 / 렌더링 / 프리미엄 / 프리미엄+렌더링
//      → 이것이 요금을 정한다. 크레딧이 1 이냐 25 냐로 스물다섯 배가 갈린다.
//   ② 주종별로 값이 몇 %나 나오는가
//      → 술은 온라인 판매가 막혀 있어 값이 붙은 상품 자체가 제한적일 수 있다.
//   ③ 값이 맞는가
//      → 7월 31일까지 받아 둔 가격 이력과 대조한다. 우리에게만 있는 대조군이다.
//
// 쓰는 법
//   SCRAPERAPI_KEY=... node --env-file=.env.local scripts/_test-scraperapi.mjs
//   SCRAPERAPI_KEY=... node --env-file=.env.local scripts/_test-scraperapi.mjs --n=30
//
// 무료 구간은 1,000 크레딧이다. 기본값(주종별 5종)이면 넉넉히 들어간다.

import { MongoClient } from "mongodb";

const KEY = process.env.SCRAPERAPI_KEY;
const N = Number((process.argv.find((a) => a.startsWith("--n=")) || "").slice(4)) || 5;
const BASE = "https://api.scraperapi.com";

if (!KEY) {
  console.log("SCRAPERAPI_KEY 가 없습니다. 무료 가입 후 키를 넣고 다시 실행하세요.");
  console.log("  https://www.scraperapi.com  →  가입  →  Dashboard 의 API Key");
  process.exit(1);
}

const jsonUrl = (q) =>
  `https://search.shopping.naver.com/api/search/all?sort=rel&pagingIndex=1&pagingSize=20&productSet=total&query=${encodeURIComponent(q)}`;
const htmlUrl = (q) =>
  `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;

async function account() {
  const r = await fetch(`${BASE}/account?api_key=${KEY}`);
  return r.ok ? r.json() : null;
}

async function via(target, { render = false, premium = false } = {}) {
  const p = new URLSearchParams({ api_key: KEY, url: target, country_code: "kr" });
  if (render) p.set("render", "true");
  if (premium) p.set("premium", "true");
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}?${p}`, { signal: AbortSignal.timeout(75000) });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ms: Date.now() - started,
             credits: 1 + (render ? 10 : 0) + (premium ? 10 : 0) };
  } catch (e) {
    return { ok: false, status: 0, body: "", ms: Date.now() - started, credits: 0, err: e.message };
  }
}

function prices(body) {
  // 값이 붙은 상품이 하나라도 잡히면 성공으로 본다
  const out = [];
  try {
    const j = JSON.parse(body);
    for (const it of j?.shoppingResult?.products || j?.products || []) {
      const p = Number(it.price || it.lowPrice || 0);
      if (p) out.push({ title: String(it.productTitle || "").replace(/<[^>]+>/g, ""), price: p });
    }
    if (out.length) return out;
  } catch { /* HTML 일 것이다 */ }
  for (const m of body.matchAll(/"productTitle":"(.*?)".*?"price":"?(\d{3,})"?/g)) {
    out.push({ title: m[1].replace(/<[^>]+>/g, ""), price: Number(m[2]) });
  }
  return out;
}

// ── ① 어느 조합이 통하는가 ───────────────────────────────
console.log("① 어느 조합이 통하는가  (요금을 정하는 값)\n");
const COMBOS = [
  ["JSON · 기본", jsonUrl("발렌타인 17년"), {}],
  ["JSON · 프리미엄", jsonUrl("발렌타인 17년"), { premium: true }],
  ["HTML · 기본", htmlUrl("발렌타인 17년"), {}],
  ["HTML · 렌더링", htmlUrl("발렌타인 17년"), { render: true }],
  ["HTML · 프리미엄+렌더링", htmlUrl("발렌타인 17년"), { premium: true, render: true }],
];
let best = null;
for (const [label, url, opt] of COMBOS) {
  const r = await via(url, opt);
  const found = r.ok ? prices(r.body) : [];
  const mark = found.length ? "값 " + found.length + "개" : r.ok ? "열렸으나 값 없음" : `실패 ${r.status || r.err}`;
  console.log(`  ${String(r.credits).padStart(2)}크레딧  ${label.padEnd(22)} ${String(r.ms).padStart(6)}ms  ${mark}`);
  if (found.length && (!best || r.credits < best.credits)) best = { label, opt, credits: r.credits, url };
}
if (!best) {
  console.log("\n어느 조합으로도 값을 얻지 못했습니다. 이 방법은 쓸 수 없습니다.");
  process.exit(0);
}
console.log(`\n  → 가장 싼 성공 조합: ${best.label} (${best.credits}크레딧)\n`);

// ── ② 주종별 성공률 ─────────────────────────────────────
const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const CATS = ["wine", "whisky", "sake", "beer", "traditional", "soju"];
const urlFor = best.label.startsWith("JSON") ? jsonUrl : htmlUrl;

console.log(`② 주종별로 값이 나오는 비율  (주종당 ${N}종)\n`);
let used = 0;
const summary = [];
for (const cat of CATS) {
  const docs = await col.find({ category: cat, tier: { $ne: "stub" } },
    { projection: { name: 1, searchKeyword: 1 } }).limit(N).toArray();
  let hit = 0;
  for (const d of docs) {
    const r = await via(urlFor(d.searchKeyword || d.name), best.opt);
    used += r.credits;
    if (r.ok && prices(r.body).length) hit++;
    await new Promise((s) => setTimeout(s, 300));
  }
  summary.push([cat, hit, docs.length]);
  console.log(`  ${cat.padEnd(12)} ${hit}/${docs.length}`);
}

// ── ③ 값이 맞는가 ───────────────────────────────────────
console.log("\n③ 7월에 받아 둔 값과 대조\n");
const hist = await c.db(process.env.MONGODB_DB || "winelens").collection("cellar")
  .find({ priceHistory: { $exists: true, $ne: [] } }, { projection: { name: 1, priceHistory: 1 } })
  .limit(5).toArray();
for (const h of hist) {
  const old = h.priceHistory[h.priceHistory.length - 1];
  const r = await via(urlFor(h.name), best.opt);
  used += r.credits;
  const now = prices(r.body).map((x) => x.price).sort((a, b) => a - b)[0];
  console.log(`  ${h.name}`);
  console.log(`     7월(${old.d}) ${old.p.toLocaleString()}원  →  지금 ${now ? now.toLocaleString() + "원" : "못 받음"}`);
  await new Promise((s) => setTimeout(s, 300));
}
await c.close();

// ── 요금 환산 ───────────────────────────────────────────
const acct = await account();
const totalHit = summary.reduce((a, [, h]) => a + h, 0);
const totalTry = summary.reduce((a, [, , n]) => a + n, 0);
console.log("\n── 요금 환산 ──────────────────────────────");
console.log(`  이번 시험에 쓴 크레딧 약 ${used}`);
if (acct) console.log(`  계정 잔여: ${acct.requestCount ?? "?"} / ${acct.requestLimit ?? "?"}`);
console.log(`  성공률 ${totalHit}/${totalTry} (${Math.round((totalHit / totalTry) * 100)}%)`);
const perMonth = 4500; // 여섯 앱 × 하루 25건 × 30일
const credits = perMonth * best.credits;
console.log(`\n  지금 규모(월 ${perMonth.toLocaleString()}건) → 월 ${credits.toLocaleString()} 크레딧`);
console.log(`    Hobby   $49  (10만)  ${credits <= 100000 ? "가능" : "부족"}`);
console.log(`    Startup $149 (100만) ${credits <= 1000000 ? "가능" : "부족"}`);
