// 데일리샷 상품 상세 — 우리 술과 짝이 맞은 상품의 구조화된 정보를 받아 카탈로그에 담는다.
//
// 왜 받는가.
// 정보로 승부하려면 정확해야 한다. 데일리샷 상품 페이지에는 판매자가 채운 구조화 정보가
// 있다 — 종류 · 용량 · 도수 · 국가 · 향/맛/여운 · 어울리는 음식 · 영문명 · 상세 이미지.
// 이것은 우리가 기억으로 쓴 글을 대조할 기준이고, 도수나 국가가 어긋나면 바로 드러난다.
//
// 어떻게 받는가.
// 페이지 전체(100KB)가 아니라 Next 의 데이터 경로(약 11KB)로 받는다. 사이트가 /m 아래에
// 있어서 경로도 /m/_next/data/<buildId>/item/<번호>.json 이다. buildId 는 배포마다
// 바뀌므로 404 가 나면 새로 읽는다.
//
// 어디에 담는가.
// 카탈로그 문서의 sourceFacts.dailyshot. 화면에 그대로 내보내는 값이 아니라 근거 자료다.
// 판매자의 설명 글을 우리 글로 옮기지 않는다 — 사실(도수·용량·국가·종류)만 쓰고,
// 문장은 우리가 새로 쓴다.
//
//   node --env-file=.env.local scripts/dailyshot-detail.mjs            전부 (이미 받은 것은 건너뜀)
//   node --env-file=.env.local scripts/dailyshot-detail.mjs --limit 50 시험
//   node --env-file=.env.local scripts/dailyshot-detail.mjs --force    다시 받기

import { MongoClient } from "mongodb";
import { readdirSync, readFileSync } from "node:fs";

const FORCE = process.argv.includes("--force");
const LIM = (() => { const i = process.argv.indexOf("--limit"); return i > 0 ? Number(process.argv[i + 1]) : Infinity; })();
const WORKERS = 3;
const GAP = 700;               // 일꾼 하나가 한 건 받고 쉬는 시간 — 합쳐서 초당 3~4건
const FRESH_DAYS = 14;         // 이만큼 안 지난 것은 다시 안 받는다
const UA = "Mozilla/5.0 (compatible; BottleLens/1.0)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 우리 술 → 데일리샷 상품 번호 (짝 파일에서) ───────────────────────────────
const pairsByName = new Map(); // ours → { id, cat }
for (const f of readdirSync("scripts").filter((x) => /^_pairs-.+\.json$/.test(x))) {
  const cat = f.replace(/^_pairs-/, "").replace(/\.json$/, "");
  for (const p of JSON.parse(readFileSync(`scripts/${f}`, "utf8"))) {
    const id = Number(String(p.url || "").split("/").pop());
    if (id) pairsByName.set(p.ours, { id, cat });
  }
}
const idToNames = new Map();
for (const [name, { id }] of pairsByName) {
  if (!idToNames.has(id)) idToNames.set(id, []);
  idToNames.get(id).push(name);
}

// ── buildId ──────────────────────────────────────────────────────────────────
let buildId = null;
async function refreshBuildId() {
  const r = await fetch("https://dailyshot.co/m/item/1961", { headers: { "user-agent": UA } });
  const html = await r.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("buildId 를 못 읽음");
  buildId = m[1];
}

async function getDetail(id) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!buildId) await refreshBuildId();
      const r = await fetch(`https://dailyshot.co/m/_next/data/${buildId}/item/${id}.json`, {
        headers: { "user-agent": UA, "x-nextjs-data": "1" },
        signal: AbortSignal.timeout(20000),
      });
      if (r.status === 404) { buildId = null; if (attempt === 0) continue; return null; } // 배포가 바뀌었거나 없는 상품
      if (!r.ok) { await sleep(1500); continue; }
      const text = await r.text();
      if (text.trim().startsWith("<")) { buildId = null; continue; }
      const j = JSON.parse(text);
      const qs = j?.pageProps?.dehydratedState?.queries || [];
      const q = qs.find((x) => x?.queryKey?.[1] === "getItemDetailsByTopProducts") || qs[0];
      return q?.state?.data || null;
    } catch {
      await sleep(1500);
    }
  }
  return null;
}

// 정보표 [{label, value}] 에서 자주 쓰는 사실을 꺼낸다
function pick(information, ...labels) {
  for (const it of information || []) if (labels.includes(it?.label)) return it.value || null;
  return null;
}

function shape(d) {
  const information = Array.isArray(d.information) ? d.information : [];
  return {
    id: d.top_product_id,
    itemId: d.id,
    url: `https://dailyshot.co/m/item/${d.top_product_id}`,
    name: d.name,
    enName: d.en_name || null,
    information,
    facts: {
      type: pick(information, "종류"),
      volume: pick(information, "용량"),
      abv: pick(information, "도수"),
      country: pick(information, "국가", "원산지", "생산국"),
    },
    tastingNotes: (Array.isArray(d.tasting_notes) ? d.tasting_notes : []).map((t) => ({
      label: t.label_ko || t.label, value: t.value,
    })),
    tastes: Array.isArray(d.tastes) ? d.tastes : [],
    pairingFoods: d.pairing_foods || null,
    vivino: d.vivino && Object.keys(d.vivino).length ? d.vivino : null,
    categoryName: d.category_name || null,
    subcategoryName: d.subcategory_name || null,
    supplier: d.supplier_name || null,
    keywords: Array.isArray(d.related_keywords) ? d.related_keywords.slice(0, 12) : [],
    thumbnail: d.thumbnail_image || null,
    thumbnailTop: d.thumbnail_top_image || null,
    detailImages: Array.isArray(d.detail_images) ? d.detail_images.slice(0, 6) : [],
    reviewCount: d.review_count ?? null,
    reviewRate: d.review_rate ?? null,
    fetchedAt: new Date(),
  };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const cutoff = new Date(Date.now() - FRESH_DAYS * 864e5);
const todo = [];
for (const [id, names] of idToNames) {
  if (!FORCE) {
    const fresh = await col.countDocuments({ name: { $in: names }, "sourceFacts.dailyshot.fetchedAt": { $gte: cutoff } });
    if (fresh === names.length) continue;
  }
  todo.push(id);
}
const queue = todo.slice(0, LIM);
console.log(`상품 ${idToNames.size}개 중 받을 것 ${queue.length}개 (이미 받은 것 ${idToNames.size - todo.length}개 건너뜀)`);

let done = 0, ok = 0, miss = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift();
    const d = await getDetail(id);
    if (d && d.top_product_id) {
      const doc = shape(d);
      await col.updateMany({ name: { $in: idToNames.get(id) } }, { $set: { "sourceFacts.dailyshot": doc } });
      ok++;
    } else {
      miss++;
    }
    done++;
    if (done % 200 === 0) console.log(`  … ${done}/${todo.length} — 받음 ${ok} · 못 받음 ${miss}`);
    await sleep(GAP);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

console.log(`끝. 받음 ${ok} · 못 받음 ${miss}`);
await client.close();
process.exit(0);
