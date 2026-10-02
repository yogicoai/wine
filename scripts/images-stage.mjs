// 이미지 모으기 1단계 — 내 PC 폴더에 받아서 규격을 맞춘다. 호스팅에는 아직 아무것도 올리지 않는다.
//
//   data/images/stage/<주종>/<해시 첫 글자>/<해시12>.webp     규격을 맞춘 사진
//   data/images/manifest.json                                  이름별 기록 (어디서 왔고 지금 어느 단계인가)
//
// 단계: staged → verified(눈으로 확인) → uploaded(호스팅 _staging) → live(공개 폴더, DB 주소 교체)
//
// 왜 PC 에 먼저 받는가.
//  · 규격을 한 번에 통일한다 — 가로세로 640 이내, WebP, 흰 바탕. 장당 수십 KB 로 줄어든다.
//  · 같은 사진이 여러 술에 쓰였는지 해시로 가린다.
//  · 상품과 맞는 사진인지 눈으로 확인한 뒤에야 올린다. 틀린 사진이 공개 폴더에 들어가지 않는다.
//
// 어디서 받는가 (앞쪽이 우선).
//  1. 데일리샷 상품 사진 — 짝이 맞은 술만. 흰 바탕의 상품 단독 컷이라 가장 고르다.
//  2. 카탈로그에 걸려 있던 사진 — 대부분 네이버쇼핑 CDN. 쇼핑 API 가 닫혀 언제 깨질지 모른다.
//
// 사진은 판매처와 브랜드의 저작물이다. 어디서 받았는지(origin)를 기록에 남겨 두므로 문제가
// 생기면 그 출처 단위로 바로 지우거나 바꿀 수 있다.
//
//   node --env-file=.env.local scripts/images-stage.mjs --limit 40     시험
//   node --env-file=.env.local scripts/images-stage.mjs                전부 (이미 한 것은 건너뜀)
//   node --env-file=.env.local scripts/images-stage.mjs --cat whisky   한 주종만

import { MongoClient } from "mongodb";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";
import { download, normalize, stagePath } from "./_images-lib.mjs";

const ROOT = "data/images";
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const ONLY = arg("--cat");
const FORCE = process.argv.includes("--force");
// --restage : 담음·실패·없음·거절 상태를 다시 한다. 확인·업로드·공개된 것은 건드리지 않는다.
// --ds-only : 데일리샷 사진이 있는 것만 (데일리샷을 우선으로 다시 받을 때)
const RESTAGE = process.argv.includes("--restage");
const DS_ONLY = process.argv.includes("--ds-only");
const WORKERS = 4;

const manifest = readManifest();
const touched = new Set();
let dirty = 0;
// 내가 바꾼 항목만 디스크의 최신 기록에 병합해 저장한다 — 업로더·판정 적용과 같이 돌아도 서로 지우지 않는다
async function save() {
  mkdirSync(ROOT, { recursive: true });
  await mergeSave(manifest, touched);
  dirty = 0;
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const q = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };
if (ONLY) q.category = ONLY;
if (DS_ONLY) q["sourceFacts.dailyshot.thumbnail"] = { $nin: [null, ""] };
const docs = await col
  .find(q, { projection: { name: 1, category: 1, image: 1, "sourceFacts.dailyshot.thumbnail": 1 } })
  .sort({ category: 1, name: 1 })
  .toArray();

const KEEP = (st) =>
  RESTAGE ? ["verified", "uploaded", "live"].includes(st) : FORCE ? false : ["staged", "verified", "uploaded", "live", "rejected"].includes(st);   // 거절된 것은 --restage 로만 다시 한다 — 같은 사진이 도로 staged 가 되어 헛되이 다시 판정받는다
const todo = docs.filter((d) => !KEEP(manifest[d.name]?.status)).slice(0, LIMIT);
console.log(`카탈로그 ${docs.length}종 중 이번에 할 것 ${todo.length}종`);

let n = 0, ok = 0, none = 0, fail = 0;
async function worker() {
  while (todo.length) {
    const d = todo.shift();
    const cands = [];
    const ds = d.sourceFacts?.dailyshot?.thumbnail;
    if (ds) cands.push({ source: "dailyshot", origin: ds });
    if (d.image && /^https?:/.test(d.image) && !/cafe24\.com/.test(d.image)) {
      cands.push({ source: "naver-shopping", origin: d.image });
    }
    const tries = [];
    let done = null;
    for (const c of cands) {
      try {
        const norm = await normalize(await download(c.origin), { source: c.source });
        const hash = createHash("sha1").update(norm.data).digest("hex").slice(0, 12);
        const p = stagePath(d.category, hash);
        if (!existsSync(p.file)) writeFileSync(p.file, norm.data);
        done = { ...c, hash, file: p.rel, w: norm.w, h: norm.h, bytes: norm.data.length };
        break;
      } catch (e) {
        tries.push({ source: c.source, origin: c.origin, reason: String(e.message).slice(0, 80) });
      }
    }
    if (done) {
      manifest[d.name] = { name: d.name, category: d.category, status: "staged", ...done, tries, at: new Date().toISOString() };
      ok++;
    } else {
      manifest[d.name] = { name: d.name, category: d.category, status: cands.length ? "failed" : "missing", tries, at: new Date().toISOString() };
      cands.length ? fail++ : none++;
    }
    touched.add(d.name);
    n++;
    if (++dirty >= 50) await save();
    if (n % 200 === 0) console.log(`  … ${n} — 담음 ${ok} · 받다 실패 ${fail} · 사진 없음 ${none}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await save();

// 같은 사진이 여러 술에 쓰였는지 — 자리표시 이미지가 섞였다는 신호다
const byHash = {};
for (const e of Object.values(manifest)) if (e.hash) (byHash[e.hash] ||= []).push(e.name);
const shared = Object.entries(byHash).filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length);

console.log(`끝. 담음 ${ok} · 받다 실패 ${fail} · 사진 없음 ${none}`);
console.log(`같은 사진을 3종 이상이 쓰는 해시 ${shared.length}개`);
shared.slice(0, 5).forEach(([h, v]) => console.log(`   ${h}  ${v.length}종  예: ${v.slice(0, 3).join(" / ")}`));
await client.close();
process.exit(0);
