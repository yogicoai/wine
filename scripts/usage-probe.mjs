// 요금제 사용률 읽기 — 공식 CLI 의 비대화형 모드(-p)가 내보내는 rate_limit_event 를 쓴다.
//
//   node scripts/usage-probe.mjs            읽고 한 줄로 보여 준다 (data/research/_work/usage.jsonl 에 이어 적는다)
//   node scripts/usage-probe.mjs --json     최신 값을 JSON 으로
//
// 왜 이 길인가
//  · 상태줄(statusLine)은 VS Code 확장에서 실행되지 않아 사용률을 받을 수 없었다.
//  · OAuth 자격 증명을 직접 읽어 API 를 부르는 방법은 쓰지 않는다. 공식 CLI 가 자기 인증으로 부른다.
//  · 가장 작은 모델(haiku)로 한 마디만 시켜서 한 번에 토큰 수십 개만 든다.
//
// 값: unifiedWindows.five_hour / seven_day 의 utilization (0~1) 과 resetsAt (초 단위 에포크).
//     주간(seven_day) 70% 가 사용자가 정한 멈춤 선이다.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

const OUT = "data/research/_work";
const JSON_ONLY = process.argv.includes("--json");

function findExe() {
  const base = `${homedir()}/.vscode/extensions`;
  if (!existsSync(base)) return null;
  const dirs = readdirSync(base).filter((d) => d.startsWith("anthropic.claude-code-")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const d of dirs.reverse()) {
    const p = `${base}/${d}/resources/native-binary/claude.exe`;
    if (existsSync(p)) return p;
  }
  return null;
}

const exe = process.env.CLAUDE_EXE || findExe();
if (!exe) { console.error("claude 실행 파일을 못 찾았습니다 (CLAUDE_EXE 로 지정)"); process.exit(2); }

const r = spawnSync(exe, ["-p", "OK", "--model", "haiku", "--output-format", "stream-json", "--verbose", "--no-session-persistence"], {
  cwd: tmpdir(), encoding: "utf8", timeout: 90000, maxBuffer: 16 * 1024 * 1024,
});
let info = null;
for (const ln of String(r.stdout || "").split("\n")) {
  if (!ln.includes("rate_limit_event")) continue;
  try { info = JSON.parse(ln).rate_limit_info; } catch {}
}
if (!info?.unifiedWindows) { console.error("rate_limit_event 를 못 받았습니다", String(r.stderr || "").slice(0, 200)); process.exit(1); }

const w = info.unifiedWindows;
const rec = {
  at: new Date().toISOString(),
  fiveHour: w.five_hour?.utilization ?? null, fiveHourResetsAt: w.five_hour?.resetsAt ?? null,
  sevenDay: w.seven_day?.utilization ?? null, sevenDayResetsAt: w.seven_day?.resetsAt ?? null,
  status: info.status, windows: Object.keys(w),
};
// 다른 창(주간 오퍼스 등)이 있으면 같이 남긴다
for (const k of Object.keys(w)) if (!["five_hour", "seven_day"].includes(k)) rec[k] = w[k]?.utilization ?? null;

mkdirSync(OUT, { recursive: true });
appendFileSync(`${OUT}/usage.jsonl`, JSON.stringify(rec) + "\n");
writeFileSync(`${OUT}/usage.json`, JSON.stringify(rec, null, 1));

const kst = (s) => (s ? new Date(s * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(5, 16) : "?");
const pct = (x) => (x == null ? "?" : `${(x * 100).toFixed(0)}%`);
if (JSON_ONLY) console.log(JSON.stringify(rec));
else console.log(`사용률 — 5시간 ${pct(rec.fiveHour)} (${kst(rec.fiveHourResetsAt)} 초기화) · 주간 ${pct(rec.sevenDay)} (${kst(rec.sevenDayResetsAt)} 초기화) · 상태 ${rec.status}`);
process.exit(0);
