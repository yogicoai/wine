// さけのわ 인기 브랜드를 사케 목록에 — 2026-10-29 사용자 "사케 종류 더", 선택 "일본 공개 데이터(さけのわ) 인기 브랜드".
//
// 국내에서 파는 사케(데일리샷)는 판매 중 · 품절 · 세트 · 새 상품까지 다 넣었다(목록 1,363종). 그 밖으로는 さけのわ
// (일본 사케 공개 데이터 — 출처를 밝히면 자유롭게 쓸 수 있다, lib/sakenowa.js)를 쓴다.
//  · 인기 = 전국 순위 100위 + 현별 순위 10위(47현) — 이미 우리 술과 이어진 브랜드는 뺀다
//  · 한글 이름은 data/sakenowa-ko.json(눈으로 붙였다). null = 읽는 법이 확실치 않아 일본어 이름 그대로, "skip" = 넣지 않음
//    (같은 브랜드의 다른 표기 · 일반 명사). 사케 이름은 읽는 법이 불규칙해 짐작으로 붙이지 않는다
//  · 우리 DB 에 그 브랜드의 상품이 이미 있으면(이름이 그 한글 브랜드로 시작) 새로 만들지 않고 그 상품들에 さけのわ 맛 좌표를 잇는다
//  · 없으면 브랜드(銘柄) 단위 항목을 만든다 — 사진 · 가격 없음, 출처를 basis 에 밝힌다
//
//   node --env-file=.env.local scripts/sakenowa-brands.mjs            보기만
//   node --env-file=.env.local scripts/sakenowa-brands.mjs --apply    넣기(백업 data/backup/sakenowa-brands-2026-10-29.json)
import { MongoClient } from "mongodb";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { displayName } from "../lib/nameClean.js";

const APPLY = process.argv.includes("--apply");
const BACKUP = "data/backup/sakenowa-brands-2026-10-29.json";
const BASE = "https://muro.sakenowa.com/sakenowa-data/api";
const KO = JSON.parse(readFileSync("data/sakenowa-ko.json", "utf8"));

// 일본 도도부현 → 한글(국립국어원 표기)
const PREF = {
  北海道: "홋카이도", 青森県: "아오모리현", 岩手県: "이와테현", 宮城県: "미야기현", 秋田県: "아키타현", 山形県: "야마가타현", 福島県: "후쿠시마현",
  茨城県: "이바라키현", 栃木県: "도치기현", 群馬県: "군마현", 埼玉県: "사이타마현", 千葉県: "지바현", 東京都: "도쿄도", 神奈川県: "가나가와현",
  新潟県: "니가타현", 富山県: "도야마현", 石川県: "이시카와현", 福井県: "후쿠이현", 山梨県: "야마나시현", 長野県: "나가노현", 岐阜県: "기후현",
  静岡県: "시즈오카현", 愛知県: "아이치현", 三重県: "미에현", 滋賀県: "시가현", 京都府: "교토부", 大阪府: "오사카부", 兵庫県: "효고현",
  奈良県: "나라현", 和歌山県: "와카야마현", 鳥取県: "돗토리현", 島根県: "시마네현", 岡山県: "오카야마현", 広島県: "히로시마현", 山口県: "야마구치현",
  徳島県: "도쿠시마현", 香川県: "가가와현", 愛媛県: "에히메현", 高知県: "고치현", 福岡県: "후쿠오카현", 佐賀県: "사가현", 長崎県: "나가사키현",
  熊本県: "구마모토현", 大分県: "오이타현", 宮崎県: "미야자키현", 鹿児島県: "가고시마현", 沖縄県: "오키나와현", その他: "일본 밖",
};

const get = async (p) => {
  const r = await fetch(`${BASE}/${p}`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`さけのわ ${p} ${r.status}`);
  return r.json();
};
const [brandsJ, breweriesJ, areasJ, rankingsJ, chartsJ, tagsJ, brandTagsJ] = await Promise.all(
  ["brands", "breweries", "areas", "rankings", "flavor-charts", "flavor-tags", "brand-flavor-tags"].map(get)
);
const brandById = new Map(brandsJ.brands.map((b) => [b.id, b]));
const breweryById = new Map(breweriesJ.breweries.map((b) => [b.id, b]));
const areaById = new Map(areasJ.areas.map((a) => [a.id, a.name]));
const chartOf = new Map(chartsJ.flavorCharts.map((c) => [c.brandId, c]));
const tagName = new Map(tagsJ.tags.map((t) => [t.id, t.tag]));
const tagsOf = new Map((brandTagsJ.flavorTags || brandTagsJ.brandFlavorTags || []).map((b) => [b.brandId, b.tagIds || []]));

// 인기 — 전국 100위 + 현별 10위
const pick = new Map();
for (const x of rankingsJ.overall) pick.set(x.brandId, { rank: x.rank });
for (const a of rankingsJ.areas) for (const x of (a.ranking || []).filter((y) => y.rank <= 10)) {
  const p = pick.get(x.brandId) || {};
  if (p.areaRank == null || x.rank < p.areaRank) Object.assign(p, { areaRank: x.rank });
  pick.set(x.brandId, p);
}

const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const sake = await col.find({ category: "sake" }, { projection: { key: 1, name: 1, sakenowa: 1, "result.type": 1 } }).toArray();
// 같은 양조장의 과일 리큐르 · 소주 — 사케 맛 좌표를 붙이면 안 된다(니토 니토토 이치고 · 만사쿠노하나 요구루슈 · 코자에몽 준마이 유즈 …)
const NOT_SAKE = /리큐르|우메슈|유즈슈|소주|요구르|요구루|유즈|유자|모모|복숭아|딸기|이치고|하쿠토|백도|맛차|말차|매실|레몬|사과|링고|멜론|망고/;
const linked = new Set(sake.filter((d) => d.sakenowa?.brandId).map((d) => d.sakenowa.brandId));
const keys = new Set((await col.find({}, { projection: { key: 1 } }).toArray()).map((d) => d.key));
const catalogKey = (name) => `${displayName(name).toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]/gu, "").normalize("NFKC")}|`;

const sakenowaOf = (brand, brewery, p, pref) => {
  const ch = chartOf.get(brand.id);
  return {
    brandId: brand.id, brand: brand.name, brewery: brewery?.name || null,
    ...(ch ? { flavor: { f1: ch.f1, f2: ch.f2, f3: ch.f3, f4: ch.f4, f5: ch.f5, f6: ch.f6 } } : {}),
    tags: (tagsOf.get(brand.id) || []).map((id) => tagName.get(id)).filter(Boolean).slice(0, 6),
    rank: p.rank || null,
    // 현별 순위 — 그 현 안에서 몇 위인가(10위까지만 골랐다)
    areaRank: p.areaRank ?? null, area: pref || null,
  };
};

const now = new Date();
const create = [], attach = [], skipped = { skip: 0, linked: 0, ambiguous: 0, dupKey: 0 };
for (const [id, p] of pick) {
  if (linked.has(id)) { skipped.linked++; continue; }
  const ko = KO[String(id)];
  if (ko === "skip") { skipped.skip++; continue; }
  const brand = brandById.get(id);
  if (!brand) continue;
  const brewery = breweryById.get(brand.breweryId);
  const prefJa = areaById.get(brewery?.areaId);
  const pref = PREF[prefJa] || prefJa || null;
  const info = sakenowaOf(brand, brewery, p, pref);

  // 우리 DB 에 그 브랜드의 상품이 있나 — 이름이 한글 브랜드(구별 괄호를 뗀 것)로 시작하면
  const base = ko ? ko.replace(/\s*\([^)]*\)$/, "") : null;
  const own = base ? sake.filter((d) => d.name === base || d.name.startsWith(base + " ")) : [];
  if (own.length) {
    // "치요츠루 (도쿄)"처럼 같은 이름이 둘인 브랜드는 어느 쪽 상품인지 알 수 없어 건드리지 않는다
    if (ko !== base) { skipped.ambiguous++; continue; }
    const targets = own.filter((d) => !d.sakenowa && !NOT_SAKE.test(`${d.name} ${d.result?.type || ""}`));
    if (info.flavor && targets.length) attach.push({ id, ko, info: { ...info, matchedBy: "한글 브랜드 이름(2026-10-29)" }, docs: targets.map((d) => ({ key: d.key, name: d.name })) });
    continue;
  }

  const name = ko || brand.name;
  const key = catalogKey(name);
  if (keys.has(key)) { skipped.dupKey++; continue; }
  keys.add(key);
  create.push({
    key, name, category: "sake", vintage: null, producer: brewery?.name || null,
    searchKeyword: [...new Set([name, brand.name, brewery?.name].filter(Boolean))].join(" "),
    result: {
      found: true, name, category: "sake", type: null, country: prefJa === "その他" ? null : "일본",
      ...(pref && prefJa !== "その他" ? { region: pref } : {}), producer: brewery?.name || null, specs: [], tier: "stub",
      basis: "일본 공개 데이터(さけのわ) 기준 — 브랜드(銘柄) 단위 정보이며, 국내 판매 · 가격 정보는 없습니다.",
    },
    tier: "stub", usedWeb: false, model: null, source: "sakenowa", registeredFrom: "sakenowa-ranking", hits: 0, createdAt: now, updatedAt: now,
    sakenowa: { ...info, matchedBy: "さけのわ 인기 브랜드로 등록(2026-10-29)" },
    i18n: { ja: { name: brand.name } },
  });
}

const kanjiOnly = create.filter((d) => d.name === d.sakenowa.brand).length;
console.log(`인기 브랜드 ${pick.size}개 — 이미 이어짐 ${skipped.linked} · 넣지 않음 ${skipped.skip} · 같은 이름 둘이라 건너뜀 ${skipped.ambiguous} · 같은 키 ${skipped.dupKey}`);
console.log(`새로 만들 브랜드 ${create.length}개(일본어 이름 그대로 ${kanjiOnly}) · 맛 좌표 있음 ${create.filter((d) => d.sakenowa.flavor).length}`);
console.log(`이미 있는 상품에 맛 좌표 잇기: 브랜드 ${attach.length}개 → 상품 ${attach.reduce((s, a) => s + a.docs.length, 0)}개`);
console.log("  예(잇기):", attach.slice(0, 8).map((a) => `${a.ko}→${a.docs.slice(0, 2).map((d) => d.name).join("/")}`).join(" | "));
// --all: 잇는 짝을 전부 찍는다 — 한글 이름 앞부분으로 맞추므로 눈으로 훑어 엉뚱한 상품이 없는지 본다
if (process.argv.includes("--all")) for (const a of attach) console.log(`   ${a.ko}(${a.info.brand}) ${a.docs.length}: ${a.docs.slice(0, 3).map((d) => d.name).join(" / ")}`);
console.log("  예(새로):", create.slice(0, 12).map((d) => `${d.name}(${d.sakenowa.brand} · ${d.result.region || "-"}${d.sakenowa.rank ? ` · 전국 ${d.sakenowa.rank}위` : ""})`).join(" | "));
if (!APPLY) { console.log("보기만 했습니다. 넣으려면 --apply"); await c.close(); process.exit(0); }

if (existsSync(BACKUP)) throw new Error(`${BACKUP} 가 이미 있다 — 두 번 넣지 않게 멈춤`);
writeFileSync(BACKUP, JSON.stringify({ at: now, note: "さけのわ 인기 브랜드 — created 는 지우면 되돌아가고, attached 는 그 문서의 sakenowa 를 지우면 된다", created: create.map((d) => ({ key: d.key, name: d.name, brandId: d.sakenowa.brandId })), attached: attach.flatMap((a) => a.docs.map((d) => ({ key: d.key, name: d.name, brandId: a.id }))) }, null, 1));
if (create.length) await col.insertMany(create, { ordered: false });
for (const a of attach) await col.updateMany({ key: { $in: a.docs.map((d) => d.key) }, sakenowa: { $exists: false } }, { $set: { sakenowa: a.info, updatedAt: now } });
console.log(`넣었습니다 — 새 브랜드 ${create.length} · 맛 좌표 이은 상품 ${attach.reduce((s, a) => s + a.docs.length, 0)} (백업 ${BACKUP})`);
await c.close();
process.exit(0);
