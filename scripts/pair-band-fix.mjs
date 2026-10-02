// 판매처(데일리샷) 짝 정리 + 판매처 가격으로 가격대 바로잡기 — 모델 호출 없음, DB 와 코드만.
//
//   node --env-file=.env.local scripts/pair-band-fix.mjs            보기만
//   node --env-file=.env.local scripts/pair-band-fix.mjs --apply    적기 (먼저 data/backup/pair-band-2026-10-02.json 에 원래 값을 남긴다)
//
// ① 짝 끊기: 도수 대조(10-02)에서 이름부터 다른 상품을 이은 것으로 확인한 4건. sourceFacts.dailyshot 을 지우고
//    sourceFacts.dailyshotUnlinked 에 옛 짝과 이유를 남긴다 (scripts/images-pair-unlink.mjs 와 같은 방식).
// ② 가격대: 판매처 가격이 이어진 술의 가격대를 그 값으로 다시 매긴다. 2만 이하 · 2~5만 · 5~10만 · 10~30만 · 30만 이상.
//    빼는 것 — 표준 병이 아닌 것(맥주 250~1000ml, 나머지 500~1000ml 밖), 세트·기획·미니·하프·매그넘, 2016년 이전 빈티지 한정 판매.
//    모든 대상에 priceBandBasis(가격·용량·상품 번호·확인 시각, 바꿨으면 옛 값)를 남긴다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const BACKUP = "data/backup/pair-band-2026-10-02.json";
const UNLINK = {
  "무통 카데 로제": "판매처 짝이 다른 상품(무똥 까데 비오 로제 — 유기농 판)",
  "더 라인 카베르네 소비뇽": "판매처 짝이 다른 상품(라인 39 까베르네 소비뇽)",
  "사려 고량주 33도": "판매처 짝이 다른 상품(사려 고량주 52%)",
  "안동소주 올소": "판매처 짝이 다른 병(안동소주 올소 25% — 이 항목은 35도)",
  "알패션 그랑 말벡": "판매처 짝이 다른 상품(알패션 말벡 — 그랑 말벡은 윗급 라인)",
};
// 행사 표시가 붙은 판매가는 깎인 값일 수 있어 가격대 근거로 쓰지 않는다 (예: [한가위샷] 샤또 몽로즈 239,000원)
const PROMO = /\[[^\]]*(?:행사|샷|특가|할인|이벤트|세일|sale)[^\]]*\]/i;
const bandOf = (p) => (p <= 20000 ? 1 : p <= 50000 ? 2 : p <= 100000 ? 3 : p <= 300000 ? 4 : 5);
const LABEL = { 1: "2만원 이하", 2: "2~5만원", 3: "5~10만원", 4: "10~30만원", 5: "30만원 이상" };
const ml = (v) => { const m = /([\d.]+)\s*(ml|l)\b/i.exec(String(v || "")); if (!m) return null; return m[2].toLowerCase() === "l" ? Number(m[1]) * 1000 : Number(m[1]); };
const BAD_NAME = /세트|기획|선물|패키지|미니어처|미니|하프|매그넘|magnum|half|\b(?:50|100|187|200|375)\s*ml\b|\b(?:1\.5|3)\s*l\b/i;
const oldVintage = (name) => { const m = /(?:\(|\[|빈티지\s*)(\d{4})|(\d{4})\s*vintage/i.exec(String(name || "")); const y = m ? Number(m[1] || m[2]) : null; return y && y < 2016 ? y : null; };

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");
const col = db.collection("catalog");
const now = new Date();
const ops = [], backup = [];

// ① 짝 끊기
const unlinked = new Set();
for (const [name, reason] of Object.entries(UNLINK)) {
  const d = await col.findOne({ name, notDrink: { $ne: true } }, { projection: { name: 1, sourceFacts: 1 } });
  const ds = d?.sourceFacts?.dailyshot;
  if (!ds) { console.log(`짝 없음(이미 끊김?): ${name}`); continue; }
  unlinked.add(d._id.toString());
  console.log(`짝 끊기: ${name}  ⇢  ${ds.name}`);
  backup.push({ _id: d._id, name, sourceFactsDailyshot: ds });
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $unset: { "sourceFacts.dailyshot": "" }, $set: { "sourceFacts.dailyshotUnlinked": { name: ds.name, url: ds.url, itemId: ds.itemId, reason, at: now } } } } });
}

// ② 가격대
const docs = await col.find({ notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, priceBand: { $exists: true }, "sourceFacts.dailyshot.itemId": { $exists: true } }, { projection: { name: 1, category: 1, priceBand: 1, "result.priceBand": 1, "sourceFacts.dailyshot.itemId": 1, "verified.by": 1 } }).toArray();
const idx = new Map((await db.collection("dailyshot").find({ itemId: { $in: docs.map((d) => d.sourceFacts.dailyshot.itemId) } }, { projection: { itemId: 1, price: 1, volume: 1, name: 1, seenAt: 1 } }).toArray()).map((x) => [x.itemId, x]));
const skip = { unlinked: 0, noPrice: 0, volume: 0, name: 0, vintage: 0, promo: 0 }, change = { same: 0, d1: 0, d2: 0 };
const big = [], samples = [];
for (const d of docs) {
  if (unlinked.has(d._id.toString())) { skip.unlinked++; continue; }
  const x = idx.get(d.sourceFacts.dailyshot.itemId);
  if (!x || !(x.price > 0)) { skip.noPrice++; continue; }
  const v = ml(x.volume) ?? ml(x.name);
  const okVol = v == null || (d.category === "beer" ? v >= 250 && v <= 1000 : v >= 500 && v <= 1000);
  if (!okVol) { skip.volume++; continue; }
  if (BAD_NAME.test(x.name || "")) { skip.name++; continue; }
  if (oldVintage(x.name)) { skip.vintage++; continue; }
  if (PROMO.test(x.name || "")) { skip.promo++; continue; }
  const was = Number(d.priceBand), now_ = bandOf(x.price);
  const diff = Math.abs(was - now_);
  const basis = { by: "dailyshot-price", price: x.price, volume: x.volume || null, itemId: x.itemId, seenAt: x.seenAt || null, at: now, ...(diff ? { was } : {}) };
  const set = { priceBandBasis: basis };
  if (diff) {
    set.priceBand = now_;
    if (d.result && d.result.priceBand != null) set["result.priceBand"] = now_;
    backup.push({ _id: d._id, name: d.name, priceBand: d.priceBand, resultPriceBand: d.result?.priceBand ?? null });
    if (diff >= 2) { change.d2++; big.push(`${d.name} (${d.category}) ${LABEL[was]} → ${LABEL[now_]} · ${x.price.toLocaleString()}원 ${x.volume || ""} · 판매처: ${x.name}`); }
    else { change.d1++; if (samples.length < 10) samples.push(`${d.name} ${LABEL[was]} → ${LABEL[now_]} (${x.price.toLocaleString()}원)`); }
  } else change.same++;
  ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: set } } });
}
console.log(`\n가격대 대상 ${docs.length}종 → 다시 매긴 것 ${change.same + change.d1 + change.d2} (그대로 ${change.same} · 한 구간 바뀜 ${change.d1} · 두 구간 이상 바뀜 ${change.d2})`);
console.log(`뺀 것: 짝 끊김 ${skip.unlinked} · 판매처 가격 없음 ${skip.noPrice} · 표준 병 아님 ${skip.volume} · 세트·미니 등 ${skip.name} · 옛 빈티지 ${skip.vintage} · 행사가 ${skip.promo}`);
console.log("두 구간 이상 바뀌는 것:\n  " + big.join("\n  "));
console.log("한 구간 바뀌는 것 예:\n  " + samples.join("\n  "));
if (!APPLY) { console.log("\n보기만 했습니다. 적으려면 --apply"); await client.close(); process.exit(0); }
mkdirSync("data/backup", { recursive: true });
if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있습니다 — 두 번 적지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, docs: backup }, null, 1), "utf8");
const r = await col.bulkWrite(ops, { ordered: false });
console.log(`\n적었습니다 — ${r.modifiedCount}종 (백업 ${BACKUP})`);
await client.close();
process.exit(0);
