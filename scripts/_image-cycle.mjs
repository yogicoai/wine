// 사진 순환기 — 사진 찾기가 가져온 주소를 받아 규격화하고 눈 확인까지 이어 준다. 사람이 없어도 파이프라인이 닫히게.
//
//   node scripts/_image-cycle.mjs --every 15 --until 2026-10-02T08:30:00+09:00
//
// 매번 순서대로:
//   1. images-from-research.mjs --apply   조사·사진 찾기 결과의 사진 주소 → 받기 → 규격화 → staged (source research-page)
//   2. images-pack.mjs --source research-page --prefix imrHHMM   staged 사진을 눈 확인 묶음으로
//   3. research-runner.mjs --kind images --queue imrHHMM   사진 눈 확인 (저렴한 러너)
// 판정 반영·업로드는 다른 반복기(_apply-loop, images-upload --watch)가 한다.
// 기록: data/images/_work/image-cycle.log. 멈추기: data/images/_work/CYCLE_STOP 파일.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const EVERY = Number(arg("--every", 15)) * 60000;
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Infinity;
const LOG = "data/images/_work/image-cycle.log", STOP = "data/images/_work/CYCLE_STOP";
const ts = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
const log = (s) => { try { appendFileSync(LOG, `${ts()} ${s}\n`); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JUNK = /MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings|Assertion failed/;
const run = (args, timeout = 900000) => spawnSync(process.execPath, args, { encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024 });
const tail = (r, re) => String(r.stdout || "").split("\n").filter((l) => re.test(l)).map((l) => l.trim()).slice(0, 3).join(" | ");

log("순환기 시작");
while (Date.now() < UNTIL && !existsSync(STOP)) {
  try {
    const a = run(["--env-file=.env.local", "scripts/images-from-research.mjs", "--apply"]);
    log(`받기: ${tail(a, /^(사진이 없는|끝\.)/) || String(a.stderr || "").split("\n").filter((l) => !JUNK.test(l))[0] || "-"}`);
    const prefix = `imr${new Date().toLocaleTimeString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 5).replace(":", "")}`;
    const p = run(["scripts/images-pack.mjs", "--prefix", prefix, "--batch", "14", "--source", "research-page"]);
    const m = /묶음 (\d+)개/.exec(String(p.stdout || ""));
    const n = m ? Number(m[1]) : 0;
    if (n > 0) {
      log(`눈 확인 묶음 ${prefix} ${n}개 — 러너 시작`);
      await new Promise((resolve) => {
        const c = spawn(process.execPath, ["scripts/research-runner.mjs", "--kind", "images", "--queue", prefix, "--lanes", "3", "--effort", "medium"], { stdio: "ignore", windowsHide: true });
        c.on("close", resolve); c.on("error", resolve);
      });
      log(`눈 확인 러너 끝 (${prefix})`);
    }
  } catch (e) { log(`오류: ${String(e.message).slice(0, 160)}`); }
  await sleep(EVERY);
}
log("순환기 끝");
process.exit(0);
