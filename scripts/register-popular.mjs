// 판매처(데일리샷)에서 많이 팔리는데 우리 DB 에 없는 위스키·사케를 기본 항목(뼈대)으로 등록한다 — 모델 호출 없음.
//
//   node --env-file=.env.local scripts/register-popular.mjs --cat sake [--min 10]            보기만
//   node --env-file=.env.local scripts/register-popular.mjs --cat sake [--min 10] --apply    넣기 (넣은 목록을 data/backup/register-<cat>-2026-10-02.json 에 남긴다)
//   node --env-file=.env.local scripts/register-popular.mjs --cat sake --names <목록.json> --tag <이름> [--apply]
//        눈으로 고른 판매처 상품 이름(JSON 배열)만 넣는다 — 아래 '이미 있음' 판정이 등급 낱말을 빼고 보느라
//        다른 술(아카부 준마이 ↔ 아카부 준마이 다이긴조)을 있다고 본 것을 사람이 가려 넣을 때. 백업은 register-<cat>-2026-10-02-<이름>.json
//
// · 판매처 색인의 같은 술(크기·빈티지·행사 표시만 다른 상품)을 한 덩어리로 묶고, 후기 수 합이 --min 이상인 것만 본다.
// · 이미 있는 술은 넣지 않는다 — 표기를 맞춰(죠→조, 쥬→주, 더/the·라벨 떼기) 이름이 같거나 한쪽이 다른 쪽을 품으면 있는 것으로 본다(모든 주종 대상).
// · 넣는 칸: 이름·영문명·도수·국가·종류·용량·가격대(판매처 가격, 비표준 병은 700ml 기준으로 환산)·Vivino(있으면).
//   이야기·역사는 비워 둔다 — 누가 찍으면 정식 분석이 채운다(tier stub). 판매처 사진은 imageCandidate 로만 두고 눈 확인 뒤에 올린다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { displayName } from "../lib/nameClean.js";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CAT = arg("--cat"), MIN = Number(arg("--min", 10)), APPLY = process.argv.includes("--apply");
const PICK = arg("--names") ? new Set(JSON.parse(readFileSync(arg("--names"), "utf8"))) : null, TAG = arg("--tag");
const DS_CAT = { whisky: "위스키", sake: "사케" }[CAT];
if (!DS_CAT) { console.error("--cat whisky|sake"); process.exit(2); }
if (PICK && !TAG) { console.error("--names 를 쓸 때는 --tag 로 백업 이름을 따로 준다"); process.exit(2); }
const BACKUP = `data/backup/register-${CAT}-2026-10-02${TAG ? "-" + TAG : ""}.json`;

const GEN = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리|일본|청주)/g;
const norm = (s) => String(s || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ").replace(/\b(19|20)\d{2}\b/g, " ")
  .replace(/죠/g, "조").replace(/쥬/g, "주").replace(/^\s*(더|the)\s+/i, " ").replace(/라벨|label/gi, " ").replace(GEN, " ").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const catalogKey = (name, vintage) => `${displayName(name).toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]/gu, "").normalize("NFKC")}|${vintage || ""}`;
const SETLIKE = /세트|기획|선물|패키지|미니어처|미니|케이스|박스|box|기프트|gift|포장/i;
// 낱말 비교 — 어순이 달라도 같은 술을 잡는다. 등급·일반 낱말은 빼고(상표·숫자·특징만), 숫자가 다르면 다른 술이다.
// 보리·고구마·쌀·니고리·스파클링처럼 다른 상품을 가르는 말은 남긴다.
const WEAK = new Set(["준마이", "다이긴조", "긴조", "준마이긴조", "준마이다이긴조", "혼조조", "본양조", "특별", "특별준마이", "특별본양조", "토쿠베츠", "나마", "나마자케", "겐슈", "나마겐슈", "생", "원주", "사케", "일본", "청주", "니혼슈", "술", "쇼추", "소주", "일본식", "위스키", "싱글몰트", "싱글", "몰트", "스카치", "블렌디드", "버번", "스트레이트", "켄터키", "아메리칸", "재패니즈", "아이리시", "the", "더"]);
const toks = (s) => String(s || "").replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)(?=\s|$)/gi, " ").replace(/죠/g, "조").replace(/쥬/g, "주").replace(/라벨|label/gi, " ")
  .toLowerCase().split(/[^a-z0-9가-힣]+/).filter((t) => t && !WEAK.has(t));
const nums = (ts) => ts.filter((t) => /\d/.test(t)).sort().join(",");
const subset = (a, b) => a.every((t) => b.includes(t));
const sameByTokens = (a, b) => a.length && b.length && nums(a) === nums(b) && (subset(a, b) || subset(b, a));
const PROMO = /\[[^\]]*\]/;
const ml = (v) => { const m = /([\d.]+)\s*(ml|l)\b/i.exec(String(v || "")); if (!m) return null; return m[2].toLowerCase() === "l" ? Number(m[1]) * 1000 : Number(m[1]); };
const bandOf = (p) => (p <= 20000 ? 1 : p <= 50000 ? 2 : p <= 100000 ? 3 : p <= 300000 ? 4 : 5);
// 화면에 쓸 이름 — 행사 표시·(구형)·용량·도수 꼬리를 떼고, 사케는 우리 표기(긴조·주)로
const cleanName = (s) => {
  let n = String(s || "").replace(/\[[^\]]*\]/g, " ").replace(/\((?:구형|신형|리뉴얼|단종)\)/g, " ").replace(/\s*\d+(\.\d+)?\s*(ml|l|리터|%)(?=\s|$)/gi, " ").replace(/\s{2,}/g, " ").trim();
  if (CAT === "sake") n = n.replace(/죠/g, "조").replace(/쥬/g, "주");
  return n;
};
const cleanEn = (s) => { const e = String(s || "").replace(/\s*\d+(\.\d+)?\s*(ml|l|%)(?=\s|$)/gi, " ").replace(/\s*\((?:old bottle|new bottle)\)/gi, " ").replace(/\s*,\s*/g, " ").replace(/\s{2,}/g, " ").trim(); return e && !/[가-힣]/.test(e) ? e : null; };

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");
const col = db.collection("catalog");
const all = await col.find({}, { projection: { key: 1, name: 1, category: 1, searchKeyword: 1, "i18n.en.name": 1, "sourceFacts.dailyshot.itemId": 1, "sourceFacts.dailyshot.enName": 1, "sourceFacts.dailyshotUnlinked.itemId": 1 } }).toArray();
// 영문명 비교 — 한글 음역이 달라도(남부비진↔남부미인) 영문명이 같으면 같은 술이다
const EN_WEAK = new Set(["junmai", "daiginjo", "ginjo", "daiginjyo", "ginjyo", "tokubetsu", "honjozo", "namazake", "nama", "genshu", "sake", "shochu", "the", "whisky", "whiskey", "single", "malt", "scotch", "blended", "bourbon", "straight", "kentucky", "japanese", "irish", "of"]);
const enToks = (s) => String(s || "").replace(/\([^)]*\)/g, " ").replace(/\d+(\.\d+)?\s*(ml|l|%)(?=\s|$)/gi, " ").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((t) => t && t.length > 1 && !EN_WEAK.has(t));
const keys = new Set(all.map((d) => d.key));
const ours = all.map((d) => norm(d.name)).filter((k) => k.length >= 2);
const SCOPE = CAT === "sake" ? ["sake", "soju"] : ["whisky", "brandy", "spirits"];
const oursTok = all.filter((d) => SCOPE.includes(d.category)).map((d) => toks(d.name));
const linked = new Set(all.flatMap((d) => [d.sourceFacts?.dailyshot?.itemId, d.sourceFacts?.dailyshotUnlinked?.itemId]).filter(Boolean));
const oursEn = all.filter((d) => SCOPE.includes(d.category)).flatMap((d) => [d.i18n?.en?.name, d.sourceFacts?.dailyshot?.enName, /[a-z]{3,}/i.test(d.searchKeyword || "") ? d.searchKeyword : null]).filter(Boolean).map(enToks).filter((t) => t.length);
const have = (k, name, en) => ours.some((o) => o === k || (o.length >= 4 && k.length >= 4 && (o.includes(k) || k.includes(o)))) || oursTok.some((t) => sameByTokens(toks(name), t))
  || (en ? oursEn.some((t) => sameByTokens(enToks(en), t)) : false);

const idx = await db.collection("dailyshot").find({ category: DS_CAT }, { projection: { _id: 0, history: 0 } }).toArray();
const groups = new Map();
for (const x of idx) {
  if (SETLIKE.test(x.name || "")) continue;
  const k = norm(x.name); if (!k) continue;
  const g = groups.get(k) || { k, items: [], reviews: 0, have: false };
  g.items.push(x); g.reviews += Number(x.reviews || 0);
  if (linked.has(x.itemId) || have(k, x.name, x.nameEn)) g.have = true;
  groups.set(k, g);
}
const STD = CAT === "sake" ? [700, 760] : [690, 760];
const now = new Date(), docs = [], skipped = { dupKey: 0, noName: 0 };
const missing = (PICK ? [...groups.values()].filter((g) => g.items.some((x) => PICK.has(x.name))) : [...groups.values()].filter((g) => !g.have && g.reviews >= MIN)).sort((a, b) => b.reviews - a.reviews);
if (PICK) {
  const found = new Set(missing.flatMap((g) => g.items.map((x) => x.name)));
  const lost = [...PICK].filter((n) => !found.has(n));
  console.log(`지정 목록 ${PICK.size}개 중 판매처 색인에서 찾음 ${PICK.size - lost.length}` + (lost.length ? ` — 못 찾음: ${lost.join(" | ")}` : ""));
}
for (const g of missing) {
  // 대표 상품: 행사 표시 없고 표준 병인 것 중 후기 많은 것 → 없으면 행사 표시 없는 것 → 아무거나
  const byRev = [...g.items].sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  const std = (x) => { const v = ml(x.volume) ?? ml(x.name); return v != null && v >= STD[0] && v <= STD[1]; };
  // 정보가 다 찬 상품을 우선한다 (행사 표시 없음 > 도수·국가·용량 있음 > 표준 병 > 후기 수)
  const score = (x) => (PROMO.test(x.name) ? 0 : 8) + (x.abv ? 2 : 0) + (x.country ? 2 : 0) + (x.volume ? 1 : 0) + (std(x) ? 1 : 0);
  const rep = [...byRev].sort((a, b) => score(b) - score(a) || (b.reviews || 0) - (a.reviews || 0))[0];
  const name = cleanName(rep.name);
  if (!name) { skipped.noName++; continue; }
  const key = catalogKey(name, null);
  if (keys.has(key)) { skipped.dupKey++; continue; }
  keys.add(key);
  // 가격대 — 대표 상품 값. 표준 병이 아니면 700ml(사케 720ml) 기준으로 환산
  const v = ml(rep.volume) ?? ml(rep.name), base = CAT === "sake" ? 720 : 700;
  const price = Number(rep.price || 0);
  // 2L·3L 팩도 환산한다 — 큰 팩 값을 그대로 쓰면 가격대가 한두 칸 위로 간다
  const scaled = price > 0 && v && v >= 180 && v <= 5000 && !std(rep) ? Math.round(price * (base / v)) : price;
  const band = scaled > 0 ? bandOf(scaled) : null;
  const en = cleanEn(rep.nameEn);
  const vv = rep.vivino && typeof rep.vivino === "object" ? rep.vivino : null;
  const ratings = vv && Number(vv.score) > 0 && Number(vv.review_count || vv.count || 0) >= 30 ? [{ source: "Vivino", score: `${Number(vv.score).toFixed(1)} / 5 (평가 ${Number(vv.review_count || vv.count).toLocaleString("ko-KR")}건)` }] : undefined;
  const fields = ["name", "type", "specs"];
  // 종류 칸도 우리 표기로 (사케: 긴죠 → 긴조) — 잔·도구 추천 규칙이 '긴조'로 찾는다
  const type = rep.subcategory ? (CAT === "sake" ? rep.subcategory.replace(/죠/g, "조") : rep.subcategory) : null;
  const result = { found: true, name, category: CAT, type, specs: rep.volume ? [{ label: "용량", value: rep.volume }] : [], tier: "stub", basis: "판매처(데일리샷) 상품 정보 기준이며 웹 조사로 따로 확인하지는 않았습니다." };
  if (rep.country) { result.country = rep.country; fields.push("country"); }
  if (rep.abv) { result.alcohol = rep.abv; fields.push("alcohol"); }
  if (band) { result.priceBand = band; fields.push("priceBand"); }
  if (ratings) { result.ratings = ratings; fields.push("ratings"); }
  const doc = {
    key, name, category: CAT, vintage: null, producer: null,
    searchKeyword: [...new Set([name, rep.name, en].filter(Boolean))].join(" "),
    result, tier: "stub", usedWeb: false, model: null, source: "dailyshot-index", hits: 0, createdAt: now, updatedAt: now,
    ...(band ? { priceBand: band, priceBandBasis: { by: "dailyshot-price", price, volume: rep.volume || null, itemId: rep.itemId, seenAt: rep.seenAt || null, at: now, ...(scaled !== price ? { scaledTo: `${base}ml`, scaledPrice: scaled } : {}) } } : {}),
    ...(en ? { i18n: { en: { name: en } } } : {}),
    sourceFacts: { dailyshot: { id: rep.id, itemId: rep.itemId, name: rep.name, enName: rep.nameEn || null, url: rep.url, facts: { abv: rep.abv || null, country: rep.country || null, volume: rep.volume || null, type: rep.subcategory || null }, fetchedAt: rep.seenAt || null } },
    ...(rep.image ? { imageCandidate: { url: rep.image, source: "dailyshot", itemId: rep.itemId } } : {}),
    enrichedBy: "dailyshot-structured", enrichedAt: now, registeredFrom: "dailyshot-index",
    structuredFill: { at: now, source: "dailyshot", url: rep.url, fields: [...fields, ...(en ? ["i18n.en.name"] : [])] },
    popularity: { dailyshotReviews: g.reviews, listings: g.items.length },
  };
  docs.push(doc);
}
const groupsAll = [...groups.values()].filter((g) => g.reviews >= MIN);
const haveN = groupsAll.filter((g) => g.have).length;
console.log(`${CAT}: 판매처 후기 ${MIN}개 이상 ${groupsAll.length}종 — 이미 있음 ${haveN} · 빠짐 ${missing.length} → 넣을 것 ${docs.length} (같은 키가 이미 있어 건너뜀 ${skipped.dupKey}) · 넣은 뒤 보유 ${haveN + docs.length}/${groupsAll.length}`);
const bandN = docs.filter((d) => d.priceBand).length, enN = docs.filter((d) => d.i18n?.en?.name).length, imgN = docs.filter((d) => d.imageCandidate).length;
console.log(`  가격대 ${bandN} · 영문명 ${enN} · 도수 ${docs.filter((d) => d.result.alcohol).length} · 국가 ${docs.filter((d) => d.result.country).length} · Vivino ${docs.filter((d) => d.result.ratings).length} · 사진 후보 ${imgN}`);
for (const d of docs.slice(0, PICK ? Infinity : 14)) console.log(`  + ${d.name} | ${d.result.type || "-"} · ${d.result.alcohol || "-"} · ${d.result.country || "-"} · ${d.result.specs[0]?.value || "-"} · 가격대 ${d.priceBand || "-"} · EN ${d.i18n?.en?.name || "-"} (후기 ${d.popularity.dailyshotReviews})`);
if (!APPLY) { console.log("보기만 했습니다. 넣으려면 --apply"); await client.close(); process.exit(0); }
mkdirSync("data/backup", { recursive: true });
if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있습니다 — 두 번 넣지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, note: "새로 넣은 항목 — 되돌리려면 이 key 들을 지우면 된다", keys: docs.map((d) => d.key), names: docs.map((d) => d.name) }, null, 1), "utf8");
const r = await col.insertMany(docs, { ordered: false });
console.log(`넣었습니다 — ${r.insertedCount}종 (목록 ${BACKUP})`);
await client.close();
process.exit(0);
