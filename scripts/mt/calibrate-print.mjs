// 검증 기준값을 정하려고 정번역·역번역 결과를 일치도 순으로 늘어놓는다 — 사람이 읽고 맞고 틀림을 표시한다.
//   node scripts/mt/calibrate-print.mjs --lang en --units U --fwd F --back B [--n 60]
import { existsSync, readFileSync } from "node:fs";
import { MT_DIR, check, chrf, tidy } from "./_lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LANG = arg("--lang"), N = Number(arg("--n", 60));
const jl = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const units = new Map(jl(arg("--units")).map((u) => [u.id, u.text]));
const back = new Map(jl(arg("--back")).map((r) => [r.id, r.out]));
const stems = (s) => String(s).normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((w) => /[가-힣]/.test(w) && w.length >= 2).map((w) => w.slice(0, 2));
const cov = (src, bk) => { const ss = stems(src); if (!ss.length) return 1; const b = String(bk).normalize("NFKC"); return ss.filter((x) => b.includes(x)).length / ss.length; };

const rows = [];
let basicFail = 0;
for (const r of jl(arg("--fwd"))) {
  const src = units.get(r.id); if (!src) continue;
  const t = tidy(r.out, LANG);
  if (check(src, t, LANG)) { basicFail++; continue; }
  const bk = back.get(r.id); if (bk == null) continue;
  rows.push({ src, t, bk, s: chrf(src, bk), c: cov(src, bk) });
}
rows.sort((a, b) => a.s - b.s);
console.log(`기본 검사에서 걸린 문장 ${basicFail} · 역번역까지 간 문장 ${rows.length} · 일치도 분포: 최소 ${rows[0]?.s.toFixed(2)} · 중앙 ${rows[Math.floor(rows.length / 2)]?.s.toFixed(2)} · 최대 ${rows[rows.length - 1]?.s.toFixed(2)}`);
// 구간별로 골고루: 낮은 쪽·중간·높은 쪽
const pick = [];
const step = Math.max(1, Math.floor(rows.length / N));
for (let i = 0; i < rows.length && pick.length < N; i += step) pick.push(rows[i]);
pick.forEach((r, i) => console.log(`${String(i + 1).padStart(2)} | ${r.s.toFixed(2)} ${r.c.toFixed(2)} | ${r.src.slice(0, 90)}\n     → ${r.t.slice(0, 130)}\n     ← ${r.bk.slice(0, 90)}`));
