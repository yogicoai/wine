// 상태 점검 — 한 화면으로 요약하고, --heal 이면 죽은 도우미 프로세스를 다시 띄운다.
//   node scripts/_status.mjs            요약만
//   node scripts/_status.mjs --heal     죽은 것(업로더·러너·반복기·순환기)을 되살린다
// 되살리는 조건: 그 일이 남아 있고(남은 묶음/대기 사진), 멈춤 파일이 없고, 시각이 마감 전일 때.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

const HEAL = process.argv.includes("--heal");
const NOW = Date.now();
const END_LAUNCH = new Date("2026-10-02T08:15:00+09:00").getTime();
const END_ALL = new Date("2026-10-02T08:45:00+09:00").getTime();
const kst = (t = NOW) => new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(5, 16);
const W = "data/research/_work", IW = "data/images/_work";
const readJson = (p, d = null) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const lines = (p) => { try { return readFileSync(p, "utf8").trim().split("\n").filter(Boolean); } catch { return []; } };

// ── 프로세스 ──
const ps = spawnSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], { encoding: "utf8", timeout: 60000 });
let procs = []; try { const j = JSON.parse(ps.stdout); procs = Array.isArray(j) ? j : [j]; } catch {}
const has = (re, notRe) => procs.some((p) => re.test(p.CommandLine || "") && !(notRe && notRe.test(p.CommandLine || "")));
const alive = {
  upload: has(/images-upload\.mjs/), research: has(/research-runner\.mjs/, /--kind/), images: has(/research-runner\.mjs.*--kind images/),
  find: has(/research-runner\.mjs.*--kind imgfind/), apply: has(/_apply-loop\.mjs/), cycle: has(/_image-cycle\.mjs/), watch: has(/usage-watch\.mjs/),
};

// ── 남은 일 ──
const pending = (inDir, outDir, prefixRe) => {
  if (!existsSync(inDir)) return 0;
  return readdirSync(inDir).filter((f) => prefixRe.test(f)).filter((f) => { const o = `${outDir}/${f}`; return !(existsSync(o) && statSync(o).size > 10); }).length;
};
const pendResearch = pending(`${W}/in`, `${W}/out`, /^(x1|sk|wp|wv|tr|wh|sp|be|wr)-\d+\.json$/);
const pendFind = pending(`${IW}/find-in`, `${IW}/find-out`, /^fnd-\d+\.json$/);
const man = readJson("data/images/manifest.json", {});
const st = {}; for (const e of Object.values(man)) st[e.status] = (st[e.status] || 0) + 1;

// ── 사용률·비용 ──
const u = readJson(`${W}/usage.json`, {});
const pct = (x) => (x == null ? "?" : `${Math.round(x * 100)}%`);
const sum = (p, f) => lines(p).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).filter(f || (() => true));
const rr = sum(`${W}/runs.jsonl`, (r) => r.file && /^(x1|sk|wp|wv|tr|wh|sp|be|wr)-/.test(r.file));
const costR = rr.filter((r) => r.ok).reduce((a, r) => a + (r.costUsd || 0), 0);
const failR = rr.filter((r) => !r.ok).length;
const costF = sum(`${IW}/runs-find.jsonl`).reduce((a, r) => a + (r.costUsd || 0), 0);
const costI = sum(`${IW}/runs.jsonl`).reduce((a, r) => a + (r.costUsd || 0), 0);

console.log(`[${kst()}] 사용률 5시간 ${pct(u.fiveHour)} (초기화 ${kst((u.fiveHourResetsAt || 0) * 1000)}) · 주간 ${pct(u.sevenDay)} · 측정 ${kst(new Date(u.at || 0).getTime())}`);
console.log(`조사: 완료 ${rr.filter((r) => r.ok).length}묶음(실패 ${failR}) · 남음 ${pendResearch} · $${costR.toFixed(0)} | 사진 찾기 남음 ${pendFind} · $${costF.toFixed(0)} | 사진 확인 $${costI.toFixed(0)} | 합계 $${(costR + costF + costI).toFixed(0)}`);
console.log(`사진: live ${st.live || 0} · verified ${st.verified || 0} · staged ${st.staged || 0} · rejected ${st.rejected || 0} · missing ${st.missing || 0} · failed ${st.failed || 0}`);
console.log(`프로세스: ${Object.entries(alive).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}`);
for (const f of [`${W}/runner.log`, `${IW}/runner-find.log`, `${IW}/upload.log`, `${W}/apply-loop.log`, `${IW}/image-cycle.log`]) {
  const l = lines(f).slice(-1)[0]; if (l) console.log(`  ${f.split("/").pop().padEnd(18)} ${l.slice(0, 120)}`);
}

// ── 되살리기 ──
const notes = [];
const stopped = (p) => existsSync(p);
const launch = (name, args) => {
  notes.push(`재시작 ${name}`);
  if (HEAL) spawn(process.execPath, args, { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true }).unref();
};
const US = "--until"; const T = (iso) => iso;
if (!alive.upload && !stopped(`${IW}/STOP`) && NOW < END_ALL && ((st.verified || 0) > 0 || true)) launch("업로더", ["--env-file=.env.local", "scripts/images-upload.mjs", "--rate", "30", "--watch", US, T("2026-10-02T08:45:00+09:00")]);
if (!alive.research && pendResearch > 0 && !stopped(`${W}/RUNNER_STOP`) && NOW < END_LAUNCH && (u.sevenDay ?? 0) < 0.66) launch("조사 러너", ["scripts/research-runner.mjs", "--queue", "x1,sk,wp,wv,tr,wh,sp,be,wr", "--lanes", "6", "--effort", "high", US, T("2026-10-02T08:30:00+09:00")]);
if (!alive.find && pendFind > 0 && !stopped(`${W}/RUNNER_STOP`) && NOW < END_LAUNCH && (u.sevenDay ?? 0) < 0.66) launch("사진 찾기 러너", ["scripts/research-runner.mjs", "--kind", "imgfind", "--queue", "fnd", "--lanes", "3", "--effort", "high", US, T("2026-10-02T08:30:00+09:00")]);
if (!alive.apply && !stopped(`${W}/APPLY_STOP`) && NOW < END_ALL) launch("반영 반복기", ["scripts/_apply-loop.mjs", "--every", "10", US, T("2026-10-02T08:50:00+09:00")]);
if (!alive.cycle && !stopped(`${IW}/CYCLE_STOP`) && NOW < END_LAUNCH) launch("사진 순환기", ["scripts/_image-cycle.mjs", "--every", "15", US, T("2026-10-02T08:30:00+09:00")]);
if ((u.fiveHour ?? 0) >= 0.97) notes.push("⚠ 5시간 창 97% 이상 — 대화 세션이 막힐 수 있음");
if ((u.sevenDay ?? 0) >= 0.6) notes.push("⚠ 주간 60% 이상 — 새 가동 금지");
if (failR > 0) notes.push(`조사 실패 ${failR}묶음 (러너가 한 번 더 시도)`);
console.log(notes.length ? `점검: ${notes.join(" · ")}${HEAL ? "" : " (--heal 이면 실행)"}` : "점검: 이상 없음");
process.exit(0);
