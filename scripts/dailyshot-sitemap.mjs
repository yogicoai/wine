// 데일리샷 사이트맵으로 색인의 빈 곳을 채운다 — 목록 API 가 못 보여 주는 상품까지(2026-10-29 사용자 "종류 더 찾아줘").
//
// 목록 API(scripts/dailyshot-index.mjs)는 와인을 10,460개 중 4,201개까지만 넘겨준다(깊은 쪽수가 막힘). 사이트맵
// (sitemap-items.xml)에는 지금 있는 상품 번호가 전부 있다(10-29: 25,740개, 색인에 없는 것 416개 — 거의 새 상품).
// 색인에 없는 번호는 상품 페이지(무료, __NEXT_DATA__)를 읽어 색인에 넣고, 사이트맵 번호 목록은 파일로 남긴다 —
// register-popular 가 --in-sitemap 으로 "지금도 데일리샷에 있는 상품"만 고르는 데 쓴다(내려간 상품은 넣지 않는다).
//
//   node --env-file=.env.local scripts/dailyshot-sitemap.mjs            모르는 번호를 받아 색인에 넣기
//   node --env-file=.env.local scripts/dailyshot-sitemap.mjs --dry      세기만
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const OUT = "data/research/_work/dailyshot-sitemap-ids.json";
const UA = { "user-agent": "Mozilla/5.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const xml = await (await fetch("https://dailyshot.co/sitemap-items.xml", { headers: UA, signal: AbortSignal.timeout(60000) })).text();
const ids = [...new Set([...xml.matchAll(/\/m\/item\/(\d+)/g)].map((m) => Number(m[1])))];
mkdirSync("data/research/_work", { recursive: true });
writeFileSync(OUT, JSON.stringify({ at: new Date(), count: ids.length, ids }));

const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("dailyshot");
const known = new Set((await col.find({}, { projection: { id: 1 } }).toArray()).map((d) => d.id));
const unknown = ids.filter((i) => !known.has(i));
console.log(`사이트맵 상품 ${ids.length}개 (번호 목록 ${OUT}) — 색인에 없는 것 ${unknown.length}개`);
if (DRY || !unknown.length) { await c.close(); process.exit(0); }

// 상품 페이지 한 장 → 색인 한 줄(dailyshot-index.mjs 의 shape 와 같은 칸 + 페이지에만 있는 용량 · 도수 · 국가)
async function pageRow(id) {
  try {
    const r = await fetch(`https://dailyshot.co/m/item/${id}`, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const d = m && JSON.parse(m[1]).props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
    if (!d?.id) return null;
    const info = Object.fromEntries((d.information || []).filter((x) => x?.label && x?.value).map((x) => [x.label.trim(), String(x.value).trim()]));
    const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
    return {
      id, itemId: Number(d.id), name: d.name, category: d.category_name || null, subcategory: d.subcategory_name || null,
      price: num(d.price), rating: num(d.review_rate), reviews: num(d.review_count) || 0,
      vivino: d.vivino && Number(d.vivino.score) > 0 ? { score: Number(d.vivino.score), review_count: Number(d.vivino.review_count || 0) } : null,
      image: d.thumbnail_image || null, url: `https://dailyshot.co/m/item/${id}`,
      nameEn: d.en_name || null, volume: info["용량"] || null, abv: info["도수"] || null, country: info["국가"] || null,
      seenAt: new Date(), fromSitemap: true,
    };
  } catch {
    return null;
  }
}

let next = 0, ok = 0, fail = 0;
const byCat = {};
async function worker() {
  while (next < unknown.length) {
    const id = unknown[next++];
    const row = await pageRow(id);
    if (row) {
      await col.updateOne({ id }, { $set: row }, { upsert: true });
      ok++;
      byCat[row.category || "-"] = (byCat[row.category || "-"] || 0) + 1;
    } else fail++;
    await sleep(300);
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
console.log(`색인에 넣음 ${ok} · 못 읽음 ${fail} · 분류별 ${JSON.stringify(byCat)}`);
await c.close();
process.exit(0);
