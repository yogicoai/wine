// 데일리샷 가격을 한꺼번에 받아 둔다 — 카탈로그와 이어진 상품 전부(2026-10-29 사용자 "금액도 데일리샷에서 일단 뽑아와").
//
// 결과 화면은 사람이 열 때 그 술 하나만 물어 반나절 저장해 둔다(app/api/shop freshLow). 그러면 처음 여는 사람은 기다리고,
// 저장된 값은 "가장 싼 한 곳"이던 10-29 전 값이 남아 있다. 이 스크립트가 livePrice(보통 가격 · 몰린 만원대 · 튀는 값을 뺀
// 최저가)로 미리 채운다. 무료(데일리샷 판매처 API), 상품당 1~6번 묻는다 — 3개씩 동시에, 사이를 두고 천천히.
//
//   node --env-file=.env.local scripts/dailyshot-prices.mjs                  전부(반나절 안에 새 값으로 받은 것은 건너뜀)
//   node --env-file=.env.local scripts/dailyshot-prices.mjs --cat wine,sake  주종만
//   node --env-file=.env.local scripts/dailyshot-prices.mjs --limit 30       시험
//   node --env-file=.env.local scripts/dailyshot-prices.mjs --force          반나절 안에 받은 것도 다시
import { MongoClient } from "mongodb";
import { livePrice } from "../lib/dailyshot.js";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CATS = arg("--cat") ? arg("--cat").split(",") : null;
const LIMIT = Number(arg("--limit", 0)) || Infinity;
const FORCE = process.argv.includes("--force");
// 동시에 묻는 수 — 새벽 크론(refreshItems)이 다섯씩 묻는 것과 같은 수준. 상품당 3초 안팎이라 넷이면 6천 개에 한 시간쯤
const WORKERS = Number(arg("--workers", 4)), GAP = 250, TTL = 12 * 3600e3;

const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const db = c.db(process.env.MONGODB_DB || "winelens");
// 상품 번호(id = top_product_id)로 색인의 지금 판매 번호(itemId)를 찾는다 — 카탈로그에 적어 둔 itemId 는 낡은 것이 많다.
// 데일리샷이 대표 판매 번호를 바꾸기 때문이다(러시안 잭 소비뇽 블랑: 카탈로그 31401 ↔ 색인 490857). 10-29 첫 실행이
// 낡은 번호로 물어 인기 술 상당수가 비었다. 결과 화면(app/api/shop)은 처음부터 색인의 번호를 쓴다.
const cat = await db.collection("catalog").find(
  { "sourceFacts.dailyshot.id": { $exists: true }, hidden: { $ne: true }, ...(CATS ? { category: { $in: CATS } } : {}) },
  { projection: { name: 1, category: 1, "sourceFacts.dailyshot.id": 1 } }
).toArray();
const nameOf = new Map(cat.map((d) => [d.sourceFacts.dailyshot.id, `${d.name} (${d.category})`]));
const ds = db.collection("dailyshot");
const stored = new Map((await ds.find({ id: { $in: [...nameOf.keys()] } }, { projection: { id: 1, itemId: 1, low: 1, lowAt: 1, mid: 1 } }).toArray()).map((d) => [d.id, d]));
const todo = [...nameOf.keys()].filter((id) => {
  const s = stored.get(id);
  if (!s?.itemId) return false;
  return FORCE || !(s.mid != null && s.lowAt && Date.now() - new Date(s.lowAt).getTime() < TTL);
}).slice(0, LIMIT);
console.log(`카탈로그와 이어진 상품 ${nameOf.size}개 (색인에 판매 번호가 있는 것 ${[...nameOf.keys()].filter((id) => stored.get(id)?.itemId).length}) — 이번에 받을 것 ${todo.length}개 (주종 ${CATS ? CATS.join(",") : "전부"})`);

const t0 = Date.now();
let done = 0, ok = 0, fail = 0, withOutliers = 0, cross = 0;
const misled = []; // 예전 저장값(가장 싼 한 곳)이 새 보통 가격의 60% 밑이던 것 — 화면이 크게 틀리게 보여 주던 술
let next = 0;
async function worker() {
  while (next < todo.length) {
    const id = todo[next++];
    const live = await livePrice(stored.get(id).itemId);
    done++;
    if (!live) { fail++; }
    else {
      ok++;
      if (live.outliers > 0) withOutliers++;
      if (live.channel === "cross") cross++;
      const old = stored.get(id)?.low;
      if (old && live.mid && old < live.mid * 0.6) misled.push({ name: nameOf.get(id), old, mid: live.mid, low: live.low });
      const now = new Date();
      await ds.updateOne({ id }, {
        $set: {
          low: live.low, sellers: live.sellers, lowAt: now,
          lowSeller: live.seller || null, lowRegion: live.region || null, lowSoldOut: !!live.soldOut,
          mid: live.mid ?? null, midBand: live.band ?? null, midBandCount: live.bandCount ?? null, lowOutliers: live.outliers ?? 0,
          lowChannel: live.channel || "pickup",
        },
        $push: { history: { $each: [{ at: now, low: live.low }], $slice: -60 } },
      });
    }
    if (done % 300 === 0) console.log(`  … ${done}/${todo.length} — 받음 ${ok} · 실패 ${fail} · ${((Date.now() - t0) / 60000).toFixed(1)}분`);
    await new Promise((z) => setTimeout(z, GAP));
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

console.log(`\n끝. 받음 ${ok}(그중 해외직구 값 ${cross}) · 실패(판매처 없음 · 오류) ${fail} · ${((Date.now() - t0) / 60000).toFixed(1)}분`);
console.log(`튀는 값(보통 가격의 60% 밑)을 최저가에서 뺀 상품 ${withOutliers}개`);
console.log(`예전 화면 값(가장 싼 한 곳)이 보통 가격의 60% 밑이던 상품 ${misled.length}개 — 예:`);
for (const m of misled.sort((a, b) => a.old / a.mid - b.old / b.mid).slice(0, 15)) console.log(`   ${m.name}: 예전 ${m.old.toLocaleString()}원 → 보통 ${m.mid.toLocaleString()}원 · 가장 싼 곳 ${m.low.toLocaleString()}원`);
await c.close();
process.exit(0);
