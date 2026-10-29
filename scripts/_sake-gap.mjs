// 데일리샷에서 파는 사케 중 우리 카탈로그에 없는 종 — 읽기만 한다(2026-10-29, 사용자 "사케 305종은 너무 적다").
//
// 데일리샷 이름은 같은 술이 용량(300ml · 1.8L) · 케이스(우드 · 종이) · 잔 세트 · 계절 에디션으로 여러 줄이다.
// 그 껍데기를 떼고 낱말 묶음(순서 무시)으로 한 종을 만든 뒤, 카탈로그 이름 · 이어 둔 데일리샷 번호와 대조한다.
//   node --env-file=.env.local scripts/_sake-gap.mjs [--out 파일]   → 새 종 목록(JSON)
import { MongoClient } from "mongodb";
import { writeFileSync } from "node:fs";
import { searchName } from "../lib/dailyshot.js";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : null;

// 술이 아닌 것 — 잔 · 도쿠리만 파는 줄(사케 분류에 섞여 있다)
const NOT_DRINK = /^(?!.*(준마이|긴[조죠]|혼[조죠]조|사케|니고리|나마|소주|酒)).*(도쿠리|오초코|잔\s*세트|전용잔)$/;
// 같은 술의 포장 · 묶음 표시 — 떼고 묶는다
const WRAP = [
  /\[[^\]]*\]/g, /\([^)]*\)/g, /【[^】]*】/g,
  /\d+(\.\d+)?\s*(ml|l|리터)(?![a-z가-힣])/gi, /\d+(\.\d+)?\s*%/g, /(?<![가-힣])\d+(\.\d+)?\s*도(?![가-힣])/g,
  /(우드|종이|오동나무|나무|선물|기프트)?\s*(케이스|박스)(\s*에디션)?/g,
  /(크리스마스|벚꽃|홀리데이|기프트|선물용|한정|리미티드|스페셜)\s*(에디션|패키지|라벨)?/g,
  /(전용|도자기)?\s*(도쿠리|잔|술잔|오초코)\s*(\d+\s*개)?\s*(세트|패키지)?/g,
  /\d+\s*(개|팩|병|입)\s*(세트|패키지|묶음)?/g, /1\s*박스/g, /세트|패키지|묶음|기획/g,
  /[&+].*$/, /\s+x\s*\d+$/i,
];
const norm = (raw) => {
  let s = String(raw || "");
  for (const re of WRAP) s = s.replace(re, " ");
  s = searchName(s.replace(/\s+/g, " ").trim(), "sake").toLowerCase();
  return s.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
};
const tokKey = (s) => [...new Set(s.split(" ").filter(Boolean))].sort().join(" ");

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const db = c.db(process.env.MONGODB_DB || "winelens");
const today = new Date(Date.now() - 6 * 3600e3);
const ds = await db.collection("dailyshot").find({ category: "사케", seenAt: { $gte: today } }).toArray();
const cat = await db.collection("catalog").find({ category: "sake" }, { projection: { name: 1, "result.name": 1, tier: 1, "sourceFacts.dailyshot.id": 1, aliases: 1 } }).toArray();

const linkedIds = new Map(cat.filter((d) => d.sourceFacts?.dailyshot?.id).map((d) => [d.sourceFacts.dailyshot.id, d]));
const catKeys = new Map();
for (const d of cat) for (const n of [d.name, d.result?.name, ...(d.aliases || [])].filter(Boolean)) catKeys.set(tokKey(norm(n)), d);

const groups = new Map();
let accessories = 0;
for (const x of ds) {
  if (NOT_DRINK.test(x.name.trim())) { accessories++; continue; }
  const n = norm(x.name);
  if (!n) { accessories++; continue; }
  const k = tokKey(n);
  if (!groups.has(k)) groups.set(k, { key: k, name: n, rows: [] });
  groups.get(k).rows.push(x);
}
const out = [];
let covered = 0, coveredFull = 0, coveredStub = 0;
for (const g of groups.values()) {
  const hit = g.rows.map((r) => linkedIds.get(r.id)).find(Boolean) || catKeys.get(g.key);
  if (hit) { covered++; hit.tier === "stub" ? coveredStub++ : coveredFull++; continue; }
  g.rows.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  const top = g.rows[0];
  out.push({ name: g.name, sub: top.subcategory || null, reviews: g.rows.reduce((s, r) => s + (r.reviews || 0), 0), rating: top.rating, image: !!g.rows.find((r) => r.image), listings: g.rows.map((r) => ({ id: r.id, itemId: r.itemId, name: r.name, price: r.price, reviews: r.reviews })) });
}
out.sort((a, b) => b.reviews - a.reviews);
const bySub = out.reduce((m, g) => { const k = g.sub || "-"; m[k] = (m[k] || 0) + 1; return m; }, {});
console.log(`데일리샷 사케(오늘 판매 중) ${ds.length}줄 → 잔·도쿠리 ${accessories} · 종(묶은 것) ${groups.size}`);
console.log(`  우리 DB 에 있는 종 ${covered} (정식 ${coveredFull} · 이름만 ${coveredStub}) · 없는 종 ${out.length}`);
console.log(`  없는 종 분류 ${JSON.stringify(bySub)}`);
console.log(`  없는 종 중 후기 1+ ${out.filter((g) => g.reviews > 0).length} · 10+ ${out.filter((g) => g.reviews >= 10).length} · 사진 있음 ${out.filter((g) => g.image).length}`);
for (const g of out.slice(0, 50)) console.log(`   ${String(g.reviews).padStart(4)} ${g.rating ?? "-"} | ${g.name} | ${g.sub} | ${g.listings.length}줄: ${g.listings.slice(0, 2).map((l) => l.name).join(" / ")}`);
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
await c.close();
