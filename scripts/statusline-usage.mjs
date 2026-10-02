// 상태줄 명령 — Claude Code 가 표준입력으로 주는 JSON 에서 사용률을 꺼내 파일로 남긴다.
//
// 왜 필요한가. 밤새 사람 없이 돌릴 때 "주간 한도 70% 에서 멈춘다"를 지키려면, 세션 안에서
// 사용률을 읽을 길이 있어야 한다. 구독자에게는 상태줄 명령의 입력에 rate_limits 가 들어온다.
//   rate_limits.seven_day.used_percentage   주간(7일) 사용률 0~100
//   rate_limits.five_hour.used_percentage   5시간 사용률 0~100
// 이 스크립트는 그 값을 data/research/_work/usage.json 에 적어 두고, 화면에는 짧은 한 줄만 낸다.
// 어떤 경우에도 오류로 끝나지 않는다 — 상태줄이 깨지면 사용자 화면이 지저분해진다.
//
// 설정: 프로젝트의 .claude/settings.local.json 에만 걸려 있다 (전역 설정은 건드리지 않았다).
// 되돌리기: 그 파일에서 statusLine 항목을 지우면 된다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "C:/Users/Yogibo Design/Desktop/wine/data/research/_work/usage.json";
let line = "";
try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch {}
  const j = raw ? JSON.parse(raw) : {};
  const rl = j.rate_limits || null;
  mkdirSync("C:/Users/Yogibo Design/Desktop/wine/data/research/_work", { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    at: new Date().toISOString(),
    rate_limits: rl,
    model: j.model?.display_name || null,
    cost: j.cost || null,
  }));
  const w = rl?.seven_day?.used_percentage, h = rl?.five_hour?.used_percentage;
  line = `주간 ${w == null ? "--" : Math.round(w)}% · 5시간 ${h == null ? "--" : Math.round(h)}%`;
} catch {
  line = "";
}
console.log(line);
process.exit(0);
