// 결과 파일이 아직 없는 묶음의 입력 경로만 JSON 배열로 낸다 — Workflow 의 args.files 로 넘긴다.
//   node scripts/_remaining.mjs research wh            data/research/_work/in/wh-NNN.json 중 out 에 결과가 없는 것
//   node scripts/_remaining.mjs images img             data/images/_work/in/img-NNN.json 중 out 에 결과가 없는 것
//   뒤에 --count 만 붙이면 개수만 낸다
import { existsSync, readdirSync, statSync } from "node:fs";

const [kind, prefix] = process.argv.slice(2);
const base = kind === "images" ? "data/images/_work" : "data/research/_work";
if (!prefix || !["research", "images"].includes(kind)) { console.error("사용: _remaining.mjs <research|images> <접두사> [--count]"); process.exit(2); }

const ins = readdirSync(`${base}/in`).filter((f) => f.startsWith(`${prefix}-`) && /-\d+\.json$/.test(f)).sort();
const todo = ins.filter((f) => {
  const out = `${base}/out/${f}`;
  return !(existsSync(out) && statSync(out).size > 10);
});
if (process.argv.includes("--count")) console.log(`${prefix}: 전체 ${ins.length} · 남음 ${todo.length}`);
else console.log(JSON.stringify(todo.map((f) => `${base}/in/${f}`)));
