// 복구 반복기 — 20분마다 _status.mjs --heal 을 돌려 죽은 도우미(업로더·러너·반복기·순환기)를 되살린다.
// 대화 세션이 막혀도(5시간 창이 찼을 때) 이 프로세스는 계속 돈다.
//   node scripts/_heal-loop.mjs --every 20 --until 2026-10-02T08:50:00+09:00
// 기록: data/research/_work/heal.log (점검 요약). 멈추기: data/research/_work/HEAL_STOP 파일.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const EVERY = Number(arg("--every", 20)) * 60000;
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Infinity;
const LOG = "data/research/_work/heal.log", STOP = "data/research/_work/HEAL_STOP";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
appendFileSync(LOG, `${new Date().toISOString()} 복구 반복기 시작\n`);
while (Date.now() < UNTIL && !existsSync(STOP)) {
  const r = spawnSync(process.execPath, ["scripts/_status.mjs", "--heal"], { encoding: "utf8", timeout: 300000 });
  appendFileSync(LOG, `\n${String(r.stdout || "").trim()}\n${r.status ? `[종료 ${r.status}] ${String(r.stderr || "").slice(0, 200)}\n` : ""}`);
  await sleep(EVERY);
}
appendFileSync(LOG, `${new Date().toISOString()} 복구 반복기 끝\n`);
process.exit(0);
