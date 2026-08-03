// 앱 하나를 골라 띄운다 — 소스는 하나, 앱은 여섯이다.
//
//   node scripts/dev.mjs beer          개발 서버 (기본)
//   node scripts/dev.mjs beer start    빌드한 것을 띄우기
//
// 윈도우 cmd 와 bash 에서 환경변수 넣는 법이 달라 npm 스크립트에 바로 못 적는다.
// 그래서 이 파일이 대신 넣어 준다.
//
// 앱마다 포트와 빌드 폴더를 따로 준다 — 넷을 동시에 띄워 놓고 견줘 볼 수 있다.

import { spawn } from "node:child_process";
import { PROFILES } from "../lib/appProfile.js";

const PORTS = {
  wine: 5700,
  sake: 5701,
  beer: 5702,
  tradition: 5703,
  whisky: 5704,
  spirits: 5705,
};

const app = (process.argv[2] || "wine").trim();
const mode = (process.argv[3] || "dev").trim(); // dev | build | start

if (!PROFILES[app]) {
  console.error(`모르는 앱입니다: ${app}`);
  console.error(`쓸 수 있는 값: ${Object.keys(PROFILES).join(", ")}`);
  process.exit(1);
}

const port = String(process.env.PORT || PORTS[app] || 5700);
const env = {
  ...process.env,
  NEXT_PUBLIC_APP: app,
  // 빌드 폴더를 나눠야 앱을 동시에 띄울 수 있다 (next.config.mjs 가 받아 쓴다)
  NEXT_DIST_DIR: `.next-${app}`,
};

const args = mode === "build" ? ["build"] : [mode, "-p", port];
const where = mode === "build" ? "" : ` → http://localhost:${port}`;
console.log(`▸ ${PROFILES[app].name} (${app}) ${mode}${where}`);

const child = spawn("npx", ["next", ...args], {
  env,
  stdio: "inherit",
  shell: true, // 윈도우에서 npx 를 찾으려면 필요하다
});
child.on("exit", (code) => process.exit(code ?? 0));
