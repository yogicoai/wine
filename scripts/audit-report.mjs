// 표본 재검증(감사) 결과 집계 — data/research/_work/audit-out/au-*.json 을 모아 틀린 비율을 낸다.
//   node scripts/audit-report.mjs        요약을 찍고 data/research/_work/audit-report.json 에 저장
//
// 판정: correct(맞음) · wrong(틀림) · partly(일부 틀림) · unverifiable(확인 불가)
// 오류율 = (틀림 + 일부 틀림) ÷ 판정이 난 주장(맞음+틀림+일부). 확인 불가는 분모에서 뺀다.
// 전체 추정은 등급(A·B·C)별 모집단 크기로 가중한다 — 표본은 등급마다 따로 뽑았기 때문이다.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const W = "data/research/_work";
const sample = JSON.parse(readFileSync(`${W}/audit-sample.json`, "utf8"));
const meta = new Map(sample.items.map((x) => [x.key, x]));
const files = existsSync(`${W}/audit-out`) ? readdirSync(`${W}/audit-out`).filter((f) => /^au-\d+\.json$/.test(f)).sort() : [];
const VERDICTS = ["correct", "wrong", "partly", "unverifiable"];
const norm = (v) => { v = String(v || "").toLowerCase().trim(); return VERDICTS.includes(v) ? v : v.startsWith("part") ? "partly" : v.startsWith("wrong") || v === "incorrect" ? "wrong" : v.startsWith("correct") || v === "true" ? "correct" : "unverifiable"; };
const blank = () => ({ items: 0, claims: 0, correct: 0, wrong: 0, partly: 0, unverifiable: 0, itemsWithError: 0 });
const add = (t, c) => { t.claims++; t[c.verdict]++; };
const rate = (t) => { const d = t.correct + t.wrong + t.partly; return d ? (t.wrong + t.partly) / d : null; };
// 윌슨 95% 구간 — 표본이 작을 때도 무리 없는 구간
const wilson = (x, n) => { if (!n) return null; const z = 1.96, p = x / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };

const all = blank(), byLevel = { A: blank(), B: blank(), C: blank() }, byCat = {}, byField = {};
const problems = [], perItem = [], missing = [];
const seen = new Set();
for (const f of files) {
  let d; try { d = JSON.parse(readFileSync(`${W}/audit-out/${f}`, "utf8")); } catch { continue; }
  for (const e of d.entries || []) {
    const m = meta.get(e.key) || [...meta.values()].find((x) => x.name === e.name);
    if (!m || seen.has(m.key)) continue;
    seen.add(m.key);
    const claims = (e.claims || []).map((c) => ({ ...c, verdict: norm(c.verdict) }));
    const it = blank(); it.items = 1;
    for (const c of claims) {
      add(it, c); add(all, c); add(byLevel[m.level], c);
      add((byCat[m.category] ||= blank()), c);
      const fam = String(c.field || "기타").split(/[.\[]/)[0];
      add((byField[fam] ||= blank()), c);
      if (c.verdict === "wrong" || c.verdict === "partly") problems.push({ key: m.key, name: m.name, category: m.category, level: m.level, field: fam, claim: c.claim, correct: c.correct || "", source: c.source || "", quote: c.quote || "", verdict: c.verdict, file: f });
    }
    const hasErr = it.wrong + it.partly > 0;
    for (const t of [all, byLevel[m.level], (byCat[m.category] ||= blank())]) { t.items++; if (hasErr) t.itemsWithError++; }
    perItem.push({ key: m.key, name: m.name, category: m.category, level: m.level, claims: claims.length, correct: it.correct, wrong: it.wrong, partly: it.partly, unverifiable: it.unverifiable, note: e.note || "" });
  }
}
for (const x of sample.items) if (!seen.has(x.key)) missing.push(x);

// 등급 가중 추정 — 등급별 오류율을 모집단 비중으로 섞는다
const pop = sample.population, popTotal = pop.A + pop.B + pop.C;
let weighted = 0, wsum = 0;
for (const lv of ["A", "B", "C"]) { const r = rate(byLevel[lv]); if (r != null) { weighted += r * pop[lv]; wsum += pop[lv]; } }
const decided = all.correct + all.wrong + all.partly;
const runs = (() => { try { return readFileSync(`${W}/runs-audit.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } })();
const out = {
  at: new Date().toISOString(), files: files.length, itemsDone: seen.size, itemsPlanned: sample.items.length, missing,
  all, byLevel, byCat, byField, problems, perItem,
  errorRate: rate(all), errorCI: wilson(all.wrong + all.partly, decided), weightedErrorRate: wsum ? weighted / wsum : null,
  itemErrorShare: all.items ? all.itemsWithError / all.items : null, itemErrorCI: wilson(all.itemsWithError, all.items),
  population: pop, popTotal,
  cost: +runs.reduce((a, r) => a + (r.costUsd || 0), 0).toFixed(2), runs: runs.length, searches: runs.reduce((a, r) => a + (r.searches || 0), 0), fetches: runs.reduce((a, r) => a + (r.fetches || 0), 0), models: [...new Set(runs.map((r) => r.model))],
};
writeFileSync(`${W}/audit-report.json`, JSON.stringify(out, null, 1), "utf8");

const p = (x) => (x == null ? "-" : `${(x * 100).toFixed(1)}%`);
console.log(`묶음 ${files.length} · 술 ${seen.size}/${sample.items.length} · 주장 ${all.claims} (맞음 ${all.correct} · 틀림 ${all.wrong} · 일부 ${all.partly} · 확인 불가 ${all.unverifiable})`);
console.log(`오류율(주장) ${p(out.errorRate)} [95% ${out.errorCI ? out.errorCI.map(p).join("~") : "-"}] · 등급 가중 ${p(out.weightedErrorRate)} · 틀린 곳이 하나라도 있는 술 ${p(out.itemErrorShare)} [${out.itemErrorCI ? out.itemErrorCI.map(p).join("~") : "-"}]`);
for (const lv of ["A", "B", "C"]) console.log(`  등급 ${lv}: 술 ${byLevel[lv].items} · 주장 ${byLevel[lv].claims} · 오류율 ${p(rate(byLevel[lv]))} · 확인 불가 ${byLevel[lv].unverifiable}`);
console.log("  칸별 오류율:", Object.entries(byField).sort((a, b) => b[1].claims - a[1].claims).map(([k, t]) => `${k} ${t.wrong + t.partly}/${t.correct + t.wrong + t.partly}`).join(" · "));
console.log(`비용 $${out.cost} · 묶음 ${runs.length} · 검색 ${out.searches} · 열람 ${out.fetches} · 모델 ${out.models.join(",")}`);
for (const x of problems.slice(0, 40)) console.log(`  ✗ [${x.verdict}] ${x.name} (${x.category}·${x.level}) ${x.field}: ${String(x.claim).slice(0, 70)} → ${String(x.correct).slice(0, 70)}`);
if (missing.length) console.log("아직 결과 없는 술:", missing.map((m) => m.name).join(", "));
