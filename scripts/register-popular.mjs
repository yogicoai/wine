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
//
// 2026-10-29 덧붙임(사용자 "사케 305종은 너무 적다" — 판매 중 전부 · 과실주 포함):
//   --since <ISO>  색인에서 그 뒤에 본(=지금 판매 중인) 상품만. 먼저 `node scripts/dailyshot-index.mjs 42` 로 색인을 새로 받는다
//   --detail       대표 상품의 상품 페이지(무료)에서 종류·용량·도수·국가·정미율·일본주도·산도를 채운다. 목록 API 가 이 값을
//                  주지 않아 10-01 뒤에 올라온 상품은 색인에 비어 있다. 판매처 소개글은 화면에 쓰지 않고 조사 재료로만 남긴다
//   종류(사케)     데일리샷 "기타"에 섞인 우메슈 · 유즈슈 같은 과실주는 이름으로 가려 "과실주 · 리큐르"로, 등급 낱말이 이름에 있으면
//                  그 등급으로 적는다. 둘 다 아니면 비워 둔다 — 틀린 종류보다 빈칸이 낫다
//   --sets         세트 · 케이스 · 잔 패키지로만 올라온 술도 넣는다 — 포장 말을 떼고 낱병 이름으로 묶는다. 낱병 상품이 있으면 그쪽이
//                  대표가 된다. 세트로만 있는 술은 값이 병 값이 아니라 가격대를 비워 둔다
//   백업 파일 이름의 날짜는 넣는 날(KST)이다
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { displayName } from "../lib/nameClean.js";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CAT = arg("--cat"), MIN = Number(arg("--min", 10)), APPLY = process.argv.includes("--apply");
const PICK = arg("--names") ? new Set(JSON.parse(readFileSync(arg("--names"), "utf8"))) : null, TAG = arg("--tag");
const SINCE = arg("--since") ? new Date(arg("--since")) : null, DETAIL = process.argv.includes("--detail"), SETS = process.argv.includes("--sets");
// 세트 상품 이름에서 포장 말을 뗀 낱병 이름 — "닷사이 23 오동나무 케이스 에디션" → "닷사이 23"
const setCore = (s) => String(s || "")
  .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
  .replace(/(우드|종이|오동나무|나무|선물|기프트|고급)?\s*(케이스|박스|box)(\s*에디션)?/gi, " ")
  .replace(/(전용\s*)?(도쿠리|토쿠리|오쵸코|오초코|술잔|잔|글라스)(\s*\d+\s*개)?(\s*(세트|패키지))?/g, " ")
  .replace(/\d+\s*(개|팩|병|입|종)(\s*(세트|패키지|묶음|구성))?/g, " ")
  .replace(/(홈술\s*)?(세트|패키지|기획|선물용|선물|기프트|증정|포장|미니어처|미니)/gi, " ")
  .replace(/\s{2,}/g, " ").trim();
const DS_CAT = { whisky: "위스키", sake: "사케" }[CAT];
if (!DS_CAT) { console.error("--cat whisky|sake"); process.exit(2); }
if (PICK && !TAG) { console.error("--names 를 쓸 때는 --tag 로 백업 이름을 따로 준다"); process.exit(2); }
if (SINCE && isNaN(SINCE)) { console.error("--since 는 날짜(ISO)"); process.exit(2); }
const DAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const BACKUP = `data/backup/register-${CAT}-${DAY}${TAG ? "-" + TAG : ""}.json`;

// 상품 페이지 — 서버가 그린 페이지에 상품 정보 표(information)가 실려 온다. 목록 API 에는 없는 값들이다
async function pageFacts(id) {
  try {
    const r = await fetch(`https://dailyshot.co/m/item/${id}`, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const d = m && JSON.parse(m[1]).props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
    if (!d) return null;
    const info = Object.fromEntries((d.information || []).filter((x) => x?.label && x?.value).map((x) => [x.label.trim(), String(x.value).trim()]));
    const text = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").trim();
    const comments = (d.comments || []).map((c) => ({ title: text(c.title), text: text(c.description) })).filter((c) => c.text);
    return { info, enName: d.en_name || null, thumbnail: d.thumbnail_image || null, comments };
  } catch {
    return null;
  }
}
// 사케 분류 "기타"에 섞인 과실주 · 리큐르 — 이름으로 가린다
const LIQUEUR = /유즈|유자|우메슈|매실|리큐르|멜론|망고|피치|복숭아|모모|딸기|이치고|레몬|미캉|귤|링고|사과|블루베리|살구|안즈|샤인\s*머스캣|리치|시소|요구르트|요거트|커피|초콜릿|말차|체리|키위|파인애플|라임|자몽|진저|생강|시쿠와사|하쿠토|백도|포도/;
const GRADE = [[/준마이\s*다이긴[조죠]/, "준마이 다이긴조"], [/준마이\s*긴[조죠]/, "준마이 긴조"], [/다이긴[조죠]/, "다이긴조"], [/긴[조죠]/, "긴조"], [/혼[조죠][조죠]/, "혼조조"], [/준마이/, "준마이"], [/니고리/, "니고리"], [/나마/, "나마자케"]];
function sakeType(base, name) {
  const b = base && base !== "기타" ? base : null;
  if ((!b || b === "사케(청주)") && LIQUEUR.test(name)) return /우메슈|매실/.test(name) ? "우메슈(매실주)" : /유즈슈|유자주/.test(name) ? "유즈슈(유자술)" : "과실주 · 리큐르";
  if (b) return b.replace(/죠/g, "조");
  const g = GRADE.find(([re]) => re.test(name));
  return g ? g[1] : null;
}

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

const idx = await db.collection("dailyshot").find({ category: DS_CAT, ...(SINCE ? { seenAt: { $gte: SINCE } } : {}) }, { projection: { _id: 0, history: 0 } }).toArray();
const groups = new Map();
for (const x of idx) {
  const isSet = SETLIKE.test(x.name || "");
  if (isSet && !SETS) continue;
  const base = isSet ? setCore(x.name) : x.name;
  const k = norm(base); if (!k || k.length < 2) continue;
  const g = groups.get(k) || { k, items: [], reviews: 0, have: false };
  g.items.push(isSet ? { ...x, isSet: true, coreName: base } : x); g.reviews += Number(x.reviews || 0);
  if (linked.has(x.itemId) || have(k, base, x.nameEn)) g.have = true;
  groups.set(k, g);
}
const STD = CAT === "sake" ? [700, 760] : [690, 760];
const now = new Date(), docs = [], skipped = { dupKey: 0, noName: 0 }, pageN = { tried: 0, ok: 0 };
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
  // 낱병 상품이 세트보다 앞선다(--sets 일 때만 세트가 섞여 있다)
  const score = (x) => (x.isSet ? 0 : 16) + (PROMO.test(x.name) ? 0 : 8) + (x.abv ? 2 : 0) + (x.country ? 2 : 0) + (x.volume ? 1 : 0) + (std(x) ? 1 : 0);
  const rep0 = [...byRev].sort((a, b) => score(b) - score(a) || (b.reviews || 0) - (a.reviews || 0))[0];
  const name = cleanName(rep0.isSet ? rep0.coreName : rep0.name);
  if (!name) { skipped.noName++; continue; }
  const key = catalogKey(name, null);
  if (keys.has(key)) { skipped.dupKey++; continue; }
  keys.add(key);
  // 상품 페이지 값이 색인 값보다 앞선다(색인은 예전 수집본 · 목록 API 라 비어 있거나 낡았다)
  const page = DETAIL ? await pageFacts(rep0.id) : null;
  if (DETAIL) { pageN.tried++; if (page) pageN.ok++; await new Promise((z) => setTimeout(z, 250)); }
  const pi = page?.info || {};
  const rep = {
    ...rep0,
    abv: pi["도수"] || rep0.abv, country: pi["국가"] || rep0.country, volume: pi["용량"] || rep0.volume,
    // 상품 페이지 종류가 "사케"처럼 뭉뚱그린 말이면 목록의 세부 분류(준마이 …)가 낫다
    subcategory: (pi["종류"] && !/^(사케|사케\(청주\)|청주|일본주|기타)$/.test(pi["종류"]) ? pi["종류"] : rep0.subcategory) || pi["종류"] || null,
    nameEn: page?.enName && !/[가-힣]/.test(page.enName) ? page.enName : rep0.nameEn,
    image: page?.thumbnail || rep0.image,
  };
  const extraSpecs = page ? [["정미율", pi["정미율"]], ["일본주도", pi["일본주도"] || pi["주도"]], ["산도", pi["산도"]]].filter(([, v]) => v).map(([label, value]) => ({ label, value })) : [];
  // 가격대 — 대표 상품 값. 표준 병이 아니면 700ml(사케 720ml) 기준으로 환산
  const v = ml(rep.volume) ?? ml(rep.name), base = CAT === "sake" ? 720 : 700;
  const price = Number(rep.price || 0);
  // 2L·3L 팩도 환산한다 — 큰 팩 값을 그대로 쓰면 가격대가 한두 칸 위로 간다
  const scaled = price > 0 && v && v >= 180 && v <= 5000 && !std(rep) ? Math.round(price * (base / v)) : price;
  // 세트로만 있는 술 — 값이 병 값이 아니다(잔 · 여러 병 · 케이스). 가격대를 비워 둔다
  const band = scaled > 0 && !rep.isSet ? bandOf(scaled) : null;
  const en = cleanEn(rep.nameEn);
  const vv = rep.vivino && typeof rep.vivino === "object" ? rep.vivino : null;
  const ratings = vv && Number(vv.score) > 0 && Number(vv.review_count || vv.count || 0) >= 30 ? [{ source: "Vivino", score: `${Number(vv.score).toFixed(1)} / 5 (평가 ${Number(vv.review_count || vv.count).toLocaleString("ko-KR")}건)` }] : undefined;
  const fields = ["name", "type", "specs"];
  // 종류 칸도 우리 표기로 (사케: 긴죠 → 긴조) — 잔·도구 추천 규칙이 '긴조'로 찾는다
  const type = CAT === "sake" ? sakeType(rep.subcategory, name) : rep.subcategory || null;
  const result = { found: true, name, category: CAT, type, specs: [...(rep.volume ? [{ label: "용량", value: rep.volume }] : []), ...extraSpecs], tier: "stub", basis: "판매처(데일리샷) 상품 정보 기준이며 웹 조사로 따로 확인하지는 않았습니다." };
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
    sourceFacts: { dailyshot: {
      id: rep.id, itemId: rep.itemId, name: rep.name, enName: rep.nameEn || null, url: rep.url,
      facts: { abv: rep.abv || null, country: rep.country || null, volume: rep.volume || null, type: rep.subcategory || null, ...(page ? { info: pi } : {}) },
      // 사진 받기(images-stage)가 이 주소를 데일리샷 사진으로 쓴다
      ...(rep.image ? { thumbnail: rep.image } : {}),
      // 판매처 소개글 — 화면에 그대로 옮기지 않는다(그쪽 글이다). 이야기 조사 때 재료로 쓴다
      ...(page?.comments?.length ? { comments: page.comments } : {}),
      fetchedAt: page ? now : rep.seenAt || null,
    } },
    ...(rep.image ? { imageCandidate: { url: rep.image, source: "dailyshot", itemId: rep.itemId } } : {}),
    enrichedBy: "dailyshot-structured", enrichedAt: now, registeredFrom: rep.isSet ? "dailyshot-index-set" : "dailyshot-index",
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
