// 조사 에이전트가 열어 본 페이지에서 가져온 병 사진 주소(imageCandidates)로 사진을 받는다.
//
// 데일리샷·네이버쇼핑으로 사진을 못 구한 술(없음·받다 실패·거절)이 대상이다. 에이전트가 생산자 공식 사이트·수입사·
// 판매처 페이지에서 병 사진을 직접 봤다고 적은 주소만 쓴다. 지어낸 주소는 받기에서 걸러지고, 엉뚱한 병은 눈 확인이 거른다.
//
//   node --env-file=.env.local scripts/images-from-research.mjs           보기만 (받지 않음)
//   node --env-file=.env.local scripts/images-from-research.mjs --apply   받아서 규격을 맞춰 staged 로 올림
//
// 이 뒤는 같은 길이다 — images-pack.mjs → wf/imgcheck.mjs(눈 확인) → images-verdict-apply.mjs → images-upload.mjs
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";
import { download, normalize, stagePath, ROOT } from "./_images-lib.mjs";

const APPLY = process.argv.includes("--apply");
// 조사 결과(research out)와 사진 찾기 결과(find-out) 둘 다 읽는다 — 같은 모양이다 (entries[].name · imageCandidates[])
const DIRS = ["data/research/_work/out", "data/images/_work/find-out"];
const m = readManifest();
const touched = new Set();

// 사진이 없거나 못 쓰게 된 상태인 것만. 이미 staged·verified·live 인 술은 건드리지 않는다.
const NEEDS = new Set(["missing", "failed", "rejected", undefined]);

const cands = new Map();   // name → [{url, page, note}]
const finderSeen = new Set();   // 사진 찾기가 한 번 다녀간 술 — 못 찾았어도 다시 찾지 않게 기록한다
for (const dir of DIRS) {
 if (!existsSync(dir)) continue;
 for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  let data; try { data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")); } catch { continue; }
  for (const e of data.entries || []) {
    if (e?.name && dir.endsWith("find-out")) finderSeen.add(e.name);
    if (!e?.name || !Array.isArray(e.imageCandidates) || !e.imageCandidates.length) continue;
    if (!NEEDS.has(m[e.name]?.status)) continue;
    // 이미 조사 결과로 거절된 적이 있는 주소는 다시 받지 않는다
    const tried = new Set((m[e.name]?.tries || []).map((t) => t.origin));
    const list = e.imageCandidates
      .filter((c) => c && typeof c.url === "string" && /^https?:\/\//i.test(c.url) && !tried.has(c.url))
      .slice(0, 2);
    if (list.length) cands.set(e.name, list.map((c) => ({ url: c.url, page: c.page || null, note: String(c.note || "").slice(0, 100) })));
  }
 }
}
console.log(`사진이 없는 술 중 에이전트가 사진 주소를 가져온 것: ${cands.size}종 (사진 찾기를 거친 술 ${finderSeen.size}종)`);
if (!APPLY) { for (const [n, l] of [...cands].slice(0, 12)) console.log(`  ${n}  ←  ${l[0].url.slice(0, 80)}`); console.log("보기만 했습니다. 받으려면 --apply"); process.exit(0); }

const hashOwners = {};
for (const e of Object.values(m)) if (e.hash) (hashOwners[e.hash] ||= new Set()).add(e.name);

let ok = 0, fail = 0;
for (const [name, list] of cands) {
  const cat = m[name]?.category;
  const category = cat || null;
  if (!category) { console.log(`  ✗ ${name} — 주종을 알 수 없어 건너뜀`); continue; }
  const tries = [...(m[name]?.tries || [])];
  let done = null;
  for (const c of list) {
    try {
      const norm = await normalize(await download(c.url), { source: "research-page" });
      const hash = createHash("sha1").update(norm.data).digest("hex").slice(0, 12);
      // 이미 다른 술이 쓰는 사진이면 그 술의 사진이다 — 자리표시나 브랜드 공용 이미지일 수 있다
      const owners = hashOwners[hash];
      if (owners && [...owners].some((n) => n !== name)) { tries.push({ source: "research-page", origin: c.url, reason: "다른 술이 같은 사진을 쓴다" }); continue; }
      const p = stagePath(category, hash);
      if (!existsSync(p.file)) writeFileSync(p.file, norm.data);
      done = { source: "research-page", origin: c.url, originPage: c.page, originNote: c.note, hash, file: p.rel, w: norm.w, h: norm.h, bytes: norm.data.length };
      break;
    } catch (e) {
      tries.push({ source: "research-page", origin: c.url, reason: String(e.message).slice(0, 80) });
    }
  }
  if (done) { m[name] = { name, category, status: "staged", ...done, tries: [...tries, { source: "research-page", origin: done.origin, reason: "받음" }], at: new Date().toISOString() }; ok++; }
  else { m[name] = { ...(m[name] || { name, category }), status: m[name]?.status || "failed", tries, at: new Date().toISOString() }; fail++; }
  touched.add(name);
  await new Promise((r) => setTimeout(r, 400));          // 남의 사이트다 — 천천히
}
// 사진 찾기가 다녀갔으나 쓸 사진을 못 얻은 술은 표시해 둔다 — 다음 묶음에서 다시 찾지 않게
for (const name of finderSeen) {
  const e = m[name];
  if (!e || !NEEDS.has(e.status) || (e.tries || []).some((t) => t.source === "image-finder")) continue;
  e.tries = [...(e.tries || []), { source: "image-finder", origin: "-", reason: "사진 찾기가 다녀감" }];
  touched.add(name);
}
await mergeSave(m, touched);
console.log(`끝. 받아서 staged ${ok} · 받지 못함 ${fail}`);
process.exit(0);
