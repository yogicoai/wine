// 번역 파이썬을 분리 프로세스로 띄운다 (공백이 든 경로를 안전하게 넘기려고 인자 배열로 실행).
//   node scripts/mt/spawn-py.mjs <로그 이름 접두사> <translate.py 인자…>
//   예) node scripts/mt/spawn-py.mjs cal-en-fwd --lang en --in X --out Y --beam 2
// 로그: <MT_DIR>/<접두사>.log (표준 출력) · .err (표준 오류)
import { spawn } from "node:child_process";
import { closeSync, openSync, rmSync } from "node:fs";
import { MT_DIR } from "./_lib.mjs";

const [base, ...rest] = process.argv.slice(2);
if (!base) { console.error("로그 이름 접두사가 필요합니다"); process.exit(2); }
const py = `${MT_DIR}/venv/Scripts/python.exe`;
const out = openSync(`${MT_DIR}/${base}.log`, "w"), err = openSync(`${MT_DIR}/${base}.err`, "w");
const child = spawn(py, ["scripts/mt/translate.py", ...rest], { cwd: process.cwd(), detached: true, stdio: ["ignore", out, err], windowsHide: true });
child.unref();
closeSync(out); closeSync(err);
console.log(`시작 PID ${child.pid} — 로그 ${MT_DIR}/${base}.log`);
