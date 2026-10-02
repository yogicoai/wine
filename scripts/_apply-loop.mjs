// 반영 반복기 — 몇 분마다 끝난 결과를 DB 와 사진 기록에 반영한다. 사람이 없어도 결과가 쌓이도록.
//
//   node scripts/_apply-loop.mjs --every 10 --until 2026-10-02T08:50:00+09:00
//
// 하는 일 (순서대로, 매번)
//   1. research-apply.mjs --apply         조사 결과 → DB (새 파일만, 이미 반영한 파일은 건너뜀)
//   2. images-verdict-apply.mjs --apply   사진 눈 확인 판정 → manifest
//   3. images-pair-unlink.mjs --apply     짝이 다른 제품으로 판정된 데일리샷 연결 끊기
// 기록: data/research/_work/apply-loop.log (요약 줄만). 멈추기: data/research/_work/APPLY_STOP 파일.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const EVERY = Number(arg("--every", 10)) * 60000;
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Infinity;
const LOG = "data/research/_work/apply-loop.log";
const STOP = "data/research/_work/APPLY_STOP";
const ts = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
const log = (s) => { try { appendFileSync(LOG, `${ts()} ${s}\n`); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JOBS = [
  { name: "조사 반영", script: "scripts/research-apply.mjs", keep: /^(파일 |  확정|  기존 정보|적었습니다|반영할 새|  ✗|  △)/ },
  { name: "사진 판정", script: "scripts/images-verdict-apply.mjs", keep: /^(판정 |읽을 판정|기록을 갱신)/, noEnv: true },
  { name: "짝 끊기", script: "scripts/images-pair-unlink.mjs", keep: /^(짝이 다른|끊을 연결|입력 묶음)/ },
];

log("반복기 시작");
while (Date.now() < UNTIL && !existsSync(STOP)) {
  for (const j of JOBS) {
    const args = (j.noEnv ? [] : ["--env-file=.env.local"]).concat([j.script, "--apply"]);
    const r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
    const lines = String(r.stdout || "").split("\n").filter((l) => j.keep.test(l)).slice(0, 8).map((l) => l.trim());
    const err = r.status !== 0 ? ` [종료 ${r.status}] ${String(r.stderr || "").split("\n").filter((l) => !/MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings|Assertion failed/.test(l)).slice(0, 2).join(" ").slice(0, 160)}` : "";
    if (lines.length || err) log(`${j.name}: ${lines.join(" | ")}${err}`);
  }
  await sleep(EVERY);
}
log("반복기 끝");
process.exit(0);
