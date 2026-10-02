// 사용률 감시 — 5분(기본)마다 usage-probe 로 읽어 기록하고, 기준선을 넘으면 알리고 끝난다.
// 백그라운드로 돌리면 끝났을 때 알림이 와서 Claude 가 깨어난다.
//
//   node scripts/usage-watch.mjs --exit-at 0.60 [--every 5] [--until <ISO>]
//
//   --exit-at   주간(seven_day) 사용률이 이 값(0~1) 이상이면 한 줄 알리고 끝낸다
//   --every     읽는 간격(분)
//   --until     이 시각이 되면 조용히 끝낸다 (기본: 2시간 뒤 — 백그라운드 명령의 한도)
//
// 기록: data/research/_work/usage.jsonl (읽을 때마다 한 줄), usage-watch.log (감시기의 말)
// 출력(stdout): 기준선을 넘을 때의 한 줄만. 평소에는 조용하다.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const EXIT_AT = Number(arg("--exit-at", 0.6));
const EVERY = Number(arg("--every", 5)) * 60000;
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Date.now() + 115 * 60000;
const OUT = "data/research/_work";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/usage-watch.log`;
const log = (s) => appendFileSync(LOG, `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (x) => (x == null ? "?" : `${(x * 100).toFixed(0)}%`);

function probe() {
  const r = spawnSync(process.execPath, ["scripts/usage-probe.mjs", "--json"], { encoding: "utf8", timeout: 120000 });
  try { return JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch { return null; }
}

// 최근 한 시간 안의 기록으로 주간 사용률이 시간당 얼마나 오르는지 본다
function slopePerHour() {
  try {
    const rows = readFileSync(`${OUT}/usage.jsonl`, "utf8").trim().split("\n").slice(-40).map((l) => JSON.parse(l)).filter((x) => x.sevenDay != null);
    const last = rows[rows.length - 1];
    const ref = rows.find((x) => new Date(last.at) - new Date(x.at) <= 60 * 60000 && new Date(last.at) - new Date(x.at) >= 20 * 60000);
    if (!ref) return null;
    return ((last.sevenDay - ref.sevenDay) / ((new Date(last.at) - new Date(ref.at)) / 3600000));
  } catch { return null; }
}

log(`감시 시작 — 주간 ${pct(EXIT_AT)} 이상이면 알림, ${EVERY / 60000}분마다`);
let fails = 0;
while (Date.now() < UNTIL) {
  const u = probe();
  if (!u) {
    fails++; log(`읽기 실패 ${fails}회`);
    if (fails >= 6) { console.log("사용률 감시: 읽기가 6번 연속 실패했습니다 — 측정이 안 되는 상태입니다. 확인 필요."); process.exit(3); }
  } else {
    fails = 0;
    const s = slopePerHour();
    const eta = s && s > 0 ? ((0.7 - u.sevenDay) / s).toFixed(1) + "시간" : "-";
    log(`주간 ${pct(u.sevenDay)} · 5시간 ${pct(u.fiveHour)} · 상태 ${u.status}` + (s != null ? ` · 기울기 ${(s * 100).toFixed(1)}%p/시간 · 70% 까지 약 ${eta}` : ""));
    if (u.status && u.status !== "allowed" && u.status !== "allowed_warning") {
      console.log(`사용률 감시: 한도 상태가 ${u.status} 입니다 (5시간 ${pct(u.fiveHour)} · 주간 ${pct(u.sevenDay)}) — 요청이 막히고 있을 수 있습니다.`);
      process.exit(0);
    }
    if (u.sevenDay != null && u.sevenDay >= EXIT_AT) {
      console.log(`사용률 감시: 주간 ${pct(u.sevenDay)} 로 기준선 ${pct(EXIT_AT)} 에 닿았습니다 (5시간 ${pct(u.fiveHour)}${s != null ? ` · 시간당 ${(s * 100).toFixed(1)}%p` : ""}).`);
      process.exit(0);
    }
  }
  await sleep(EVERY);
}
log("감시 시간이 끝났습니다 (기준선 미도달)");
console.log("사용률 감시: 시간이 다 되어 조용히 끝납니다 — 기준선에는 닿지 않았습니다. 다시 띄우세요.");
process.exit(0);
