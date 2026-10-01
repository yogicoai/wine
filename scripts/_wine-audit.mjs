// 와인 쌍 점검 — 위스키와 달리 빈티지와 큐베(같은 집의 다른 병)가 위험하다.
import { readFileSync } from "node:fs";
const pairs = JSON.parse(readFileSync("scripts/_pairs-wine.json", "utf8"));

const yearsOf = (s) => new Set(String(s).match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || []);
const GENERIC = new Set(["샤또", "샤토", "도멘", "도매인", "와이너리", "에스테이트", "레드", "화이트", "로제", "스파클링", "와인", "빈티지", "더", "드", "르", "라", "델", "디", "엘", "카사", "보데가"]);
const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const toks = (s) =>
  String(s).replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|리터)\b/gi, " ").replace(/\b(19|20)\d{2}\b/g, " ")
    .toLowerCase().split(/[^a-z0-9가-힣]+/).filter((t) => t && !GENERIC.has(t));

let yearDiff = [], yearOnlyTheirs = 0, yearOnlyOurs = 0, tokDiff = [];
for (const p of pairs) {
  const a = yearsOf(p.ours), b = yearsOf(p.theirs);
  if (a.size && b.size && ![...a].some((y) => b.has(y))) yearDiff.push(p);
  else if (!a.size && b.size) yearOnlyTheirs++;
  else if (a.size && !b.size) yearOnlyOurs++;

  const fo = flat(p.q || p.ours), ft = flat(p.theirs);
  const extra = toks(p.theirs).filter((t) => !fo.includes(t));
  const lack = toks(p.q || p.ours).filter((t) => !ft.includes(t));
  if (extra.length || lack.length) tokDiff.push({ ...p, extra, lack });
}

console.log(`와인 붙은 ${pairs.length}쌍`);
console.log(`  빈티지가 서로 다른 것          ${yearDiff.length}쌍   ← 다른 해의 값`);
console.log(`  그쪽만 빈티지를 적은 것         ${yearOnlyTheirs}쌍   ← 어느 해 값인지 우리는 모름`);
console.log(`  우리만 빈티지를 적은 것         ${yearOnlyOurs}쌍`);
console.log(`  낱말이 어긋나는 것             ${tokDiff.length}쌍`);
console.log("");
console.log("── 빈티지 어긋남 ──");
yearDiff.slice(0, 12).forEach((p) => console.log(`  ${p.ours}  ↔  ${p.theirs}   ${p.won.toLocaleString()}원`));
console.log("");
console.log("── 낱말 어긋남 (앞 40건) ──");
tokDiff.slice(0, 40).forEach((p) =>
  console.log(`  ${p.ours}\n     ↔ ${p.theirs}  ${p.won.toLocaleString()}원   그쪽에만[${p.extra.join(" ")}] 우리에만[${p.lack.join(" ")}]`));
