// 정번역 결과 중 기본 검사를 통과한 문장만 골라 역번역(영어·일본어 → 한국어) 입력을 만든다.
// 기본 검사(한글 잔존·숫자·길이·반복·영문 고유명사)에 걸린 문장은 어차피 못 쓰니 역번역 계산을 아낀다.
//
//   node scripts/mt/back-prepare.mjs --lang en --units <units.jsonl> --fwd <out-en.jsonl> --out <back-in-en.jsonl>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MT_DIR, check, tidy } from "./_lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LANG = arg("--lang");
const UNITS = arg("--units", `${MT_DIR}/units.jsonl`), FWD = arg("--fwd", `${MT_DIR}/out-${LANG}.jsonl`), OUT = arg("--out", `${MT_DIR}/back-in-${LANG}.jsonl`);
if (!["en", "ja"].includes(LANG)) throw new Error("--lang en|ja 가 필요합니다");
const jl = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const units = new Map(jl(UNITS).map((u) => [u.id, u.text]));
const rows = [], why = {};
for (const r of jl(FWD)) {
  const src = units.get(r.id); if (!src) continue;
  const t = tidy(r.out, LANG); const bad = check(src, t, LANG);
  if (bad) { const k = bad.replace(/\d+/g, "N").replace(/[A-Za-z’'\-]{4,}/g, "X").slice(0, 16); why[k] = (why[k] || 0) + 1; continue; }
  rows.push({ id: r.id, text: t });
}
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), "utf8");
const total = jl(FWD).length;
console.log(`[${LANG}] 정번역 ${total}문장 중 기본 검사 통과 ${rows.length} (${total ? Math.round((rows.length / total) * 100) : 0}%) → 역번역 입력 ${OUT}`);
console.log("걸린 이유:", JSON.stringify(Object.fromEntries(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 8))));
