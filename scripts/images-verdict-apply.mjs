// 사진 판정 결과를 기록에 옮긴다 — 맞는 것만 verified 로 올리고 나머지는 이유와 함께 rejected.
//   node scripts/images-verdict-apply.mjs [--prefix img] [--apply]
// 판정 파일: data/images/_work/out/*.json
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes("--apply");
const PREFIX = arg("--prefix", "");
const DIR = "data/images/_work/out";
const IN_DIR = "data/images/_work/in";

const m = readManifest();
const touched = new Set();
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json") && f.startsWith(PREFIX)) : [];
if (!files.length) { console.log("읽을 판정 파일이 없습니다"); process.exit(0); }

const tally = { match: 0, mismatch: 0, unclear: 0, not_product: 0, missing: 0, badFiles: 0, stale: 0, moved: 0 };
const flagCount = {}, bySource = {}, rejects = [];
for (const f of files) {
  let arr;
  try { arr = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); } catch { tally.badFiles++; console.log(`  ✗ JSON 이 깨진 파일: ${f}`); continue; }
  // 묶음을 만들 때의 사진 경로 — 그 뒤에 사진이 바뀌었으면(다시 받음) 이 판정은 옛 사진에 대한 것이다
  let packed = null;
  try { packed = new Map(JSON.parse(readFileSync(`${IN_DIR}/${f}`, "utf8")).map((x) => [x.name, x.file])); } catch {}
  for (const v of Array.isArray(arr) ? arr : []) {
    const e = m[v?.name];
    if (!e) { tally.missing++; continue; }
    if (e.status !== "staged") { tally.moved++; continue; }                 // 이미 확인·거절·업로드된 것은 건드리지 않는다
    if (packed && packed.get(v.name) && packed.get(v.name) !== `data/images/${e.file}`) { tally.stale++; continue; }
    const verdict = ["match", "mismatch", "unclear", "not_product"].includes(v.verdict) ? v.verdict : "unclear";
    tally[verdict]++;
    (bySource[e.source] ||= { match: 0, other: 0 })[verdict === "match" ? "match" : "other"]++;
    for (const fl of v.flags || []) flagCount[fl] = (flagCount[fl] || 0) + 1;
    // 배지·워터마크·문구가 남은 사진은 맞는 상품이어도 쓰지 않는다 — 깨끗한 것만 올린다
    const dirty = (v.flags || []).some((x) => ["adult-badge", "watermark", "text-overlay", "low-quality"].includes(x));
    if (verdict === "match" && !dirty) {
      if (APPLY) { touched.add(e.name); e.status = "verified"; e.seen = String(v.seen || "").slice(0, 80); e.verifiedAt = new Date().toISOString(); }
    } else {
      if (rejects.length < 12) rejects.push(`${e.name} [${e.source}] ${verdict}${dirty ? "+" + (v.flags || []).join(",") : ""} — ${String(v.note || "").slice(0, 70)}`);
      if (APPLY) { touched.add(e.name); e.status = "rejected"; e.rejectReason = `${verdict}${dirty ? "+" + (v.flags || []).join(",") : ""}`; e.rejectedSource = e.source; e.rejectNote = String(v.note || "").slice(0, 100); }
    }
  }
}

const total = tally.match + tally.mismatch + tally.unclear + tally.not_product;
console.log(`판정 ${total}장 — 맞음 ${tally.match} · 다름 ${tally.mismatch} · 불명 ${tally.unclear} · 상품 아님 ${tally.not_product}` + (tally.missing ? ` · 기록 없음 ${tally.missing}` : "") + (tally.stale ? ` · 사진이 바뀌어 건너뜀 ${tally.stale}` : "") + (tally.moved ? ` · 이미 처리돼 건너뜀 ${tally.moved}` : ""));
console.log("출처별 맞은 비율");
for (const [s, v] of Object.entries(bySource)) console.log(`  ${String(s).padEnd(16)} ${v.match}/${v.match + v.other}  (${Math.round((v.match / (v.match + v.other)) * 100)}%)`);
if (Object.keys(flagCount).length) console.log("남아 있던 표시: " + Object.entries(flagCount).map(([k, v]) => `${k} ${v}`).join(" · "));
if (rejects.length) { console.log("\n거른 것 예"); rejects.forEach((r) => console.log("  " + r)); }

if (APPLY) { await mergeSave(m, touched); console.log("\n기록을 갱신했습니다"); }
else console.log("\n눈으로만 봤습니다. 반영하려면 --apply");
process.exit(0);
