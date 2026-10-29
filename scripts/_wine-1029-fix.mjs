// 10-29 와인 등록분 손질(한 번 쓰고 마는 스크립트) — 묶음 상품 지우기 · 낱병 이름으로 바꾸기 · 종류 표기 맞추기
//
//   node --env-file=.env.local scripts/_wine-1029-fix.mjs            보기만
//   node --env-file=.env.local scripts/_wine-1029-fix.mjs --apply    적기 (바뀌기 전 문서를 data/backup/register-wine-2026-10-29-fix.json 에 통째로 남긴다)
//
// 1) 서로 다른 와인 두 병 이상을 묶은 상품("디아블로 … & 디아블로 …", 와인 + 잔, "본드 5종") — 한 종이 아니다. 지운다.
//    생산자 이름에 &가 든 것(장 폴 & 브누아 드루앵 · 마티니 & 로시 · J&J …)은 아래 KEEP_AMP 로 남긴다 — 눈으로 가렸다.
// 2) 같은 와인 여러 병 · 캔("…6병", "…24캔") — "6병"을 뗀 이름이 이미 있으면 지우고, 없으면 낱병 이름으로 바꾸고
//    가격대를 병 하나(750ml 환산) 값으로 다시 매긴다(묶음 값으로 매기면 한두 칸 위로 간다).
// 3) 종류 표기 — "샴페인 와인" → "스파클링 와인 · 샴페인"(기존 정식 와인 표기), "과실주 와인" → "과실주", 띄어쓰기.
import { MongoClient } from "mongodb";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const OUT = "data/backup/register-wine-2026-10-29-fix.json";
const keys = JSON.parse(readFileSync("data/backup/register-wine-2026-10-29.json", "utf8")).keys;

const KEEP_AMP = [/^장 폴 & 브누아 드루앵/, /^엔리크&엔리크/, /^J&J /, /^엘렌&크리스토프/, /^엑스엑스엘\(XXL\)/, /^카판넬레 50 & 50/, /^에릭슨 & 카라딘/, /^마티니 & 로시/, /^르그라 & 아스/, /^꼴렛 실렉스 & 크레/];
const MULTI = /\s*(\d+)\s*(병|입|캔)$/;
const bandOf = (p) => (p <= 20000 ? 1 : p <= 50000 ? 2 : p <= 100000 ? 3 : p <= 300000 ? 4 : 5);
const ml = (v) => { const m = /([\d.]+)\s*(ml|l)\b/i.exec(String(v || "")); if (!m) return null; return m[2].toLowerCase() === "l" ? Number(m[1]) * 1000 : Number(m[1]); };
const catalogKeyOf = (name) => `${name.toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]/gu, "").normalize("NFKC")}|`;
function fixType(t) {
  if (!t) return t;
  const [kind, ...rest] = t.split(" · ");
  let k = kind.replace(/\s+/g, " ").replace(/레드와인/, "레드 와인").trim();
  if (/샴페인 와인$/.test(k)) k = k.replace(/샴페인 와인$/, "스파클링 와인") + " · 샴페인";
  if (k === "과실주 와인") k = "과실주";
  return [k, ...rest].join(" · ");
}

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const col = c.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ key: { $in: keys } }).toArray();
const allKeys = new Set((await col.find({}, { projection: { key: 1 } }).toArray()).map((d) => d.key));

const drop = [], rename = [], retype = [];
for (const d of docs) {
  const n = d.name;
  const bundle = (/&|\+/.test(n) && !KEEP_AMP.some((re) => re.test(n))) || /\d+\s*종(?![가-힣])/.test(n) || /올리브\s*오일/.test(n);
  if (bundle) { drop.push(d); continue; }
  const m = MULTI.exec(n);
  if (m) {
    const base = n.replace(MULTI, "").trim();
    const key = catalogKeyOf(base);
    if (allKeys.has(key)) { drop.push(d); continue; }
    const count = Number(m[1]);
    const price = Number(d.priceBandBasis?.price || 0);
    const vol = ml(d.priceBandBasis?.volume) || ml(d.result?.specs?.find((s) => s.label === "용량")?.value);
    const per = price && count ? price / count : 0;
    const scaled = per && vol && vol !== 750 ? Math.round(per * (750 / vol)) : Math.round(per);
    rename.push({ d, base, key, band: scaled > 0 ? bandOf(scaled) : null, per: Math.round(per), scaled });
    allKeys.add(key);
    continue;
  }
  const t2 = fixType(d.result?.type);
  if (t2 !== d.result?.type) retype.push({ d, before: d.result?.type, after: t2 });
}
console.log(`지울 것 ${drop.length} · 낱병 이름으로 ${rename.length} · 종류 표기 ${retype.length}`);
console.log("지움:", drop.map((d) => d.name).join(" | "));
console.log("바꿈:", rename.map((x) => `${x.d.name} → ${x.base} (병당 ${x.per}원 → 가격대 ${x.band})`).join(" | "));
const tc = {}; for (const x of retype) { const k = `${x.before.split(" · ")[0]} → ${x.after.split(" · ").slice(0, 2).join(" · ")}`; tc[k] = (tc[k] || 0) + 1; }
console.log("종류:", Object.entries(tc).map(([k, v]) => `${v} ${k}`).join(" | "));
if (!APPLY) { console.log("보기만 했습니다. 적으려면 --apply"); await c.close(); process.exit(0); }
if (existsSync(OUT)) throw new Error(`${OUT} 가 이미 있다 — 두 번 적지 않게 멈춤`);
writeFileSync(OUT, JSON.stringify({ at: new Date(), note: "10-29 와인 등록분 손질 — 지운 문서는 통째로, 바꾼 것은 바뀌기 전 값", dropped: drop, renamed: rename.map((x) => ({ key: x.d.key, name: x.d.name, priceBand: x.d.priceBand ?? null, to: { key: x.key, name: x.base, priceBand: x.band } })), retyped: retype.map((x) => ({ key: x.d.key, before: x.before, after: x.after })) }, null, 1));
await col.deleteMany({ _id: { $in: drop.map((d) => d._id) } });
for (const x of rename) {
  await col.updateOne({ _id: x.d._id }, { $set: {
    key: x.key, name: x.base, "result.name": x.base, updatedAt: new Date(),
    ...(x.band ? { priceBand: x.band, "result.priceBand": x.band, "priceBandBasis.perBottle": x.per, "priceBandBasis.scaledPrice": x.scaled } : {}),
  }, ...(x.band ? {} : { $unset: { priceBand: "", "result.priceBand": "" } }) });
}
for (const x of retype) await col.updateOne({ _id: x.d._id }, { $set: { "result.type": x.after, updatedAt: new Date() } });
console.log(`적었습니다 — 지움 ${drop.length} · 바꿈 ${rename.length} · 종류 ${retype.length} (백업 ${OUT})`);
await c.close();
