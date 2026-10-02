// 워크플로 서브에이전트의 토큰 사용량을 전사 파일에서 직접 센다 (완료 알림을 기다리지 않아도 된다).
//   node scripts/_wf-tokens.mjs                  모든 최근 워크플로
//   node scripts/_wf-tokens.mjs wf_f2e8a33e-1b2  하나
// 종류별로 따로 보여 준다 — 입력(새로 읽음) · 캐시 쓰기 · 캐시 읽기 · 출력.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

const SESSION = process.env.CLAUDE_SESSION_DIR || `${homedir()}/.claude/projects/c--Users-Yogibo-Design-Desktop-wine/0ec9be39-f320-406a-bd18-8512e148c51e`;
const ROOT = `${SESSION}/subagents/workflows`;
const only = process.argv[2];
const since = process.argv.includes("--all") ? 0 : Date.now() - 36 * 3600 * 1000;

const rows = [];
for (const wf of readdirSync(ROOT)) {
  if (only && !only.startsWith("--") && wf !== only) continue;
  const dir = `${ROOT}/${wf}`;
  if (!statSync(dir).isDirectory()) continue;
  if (statSync(dir).mtimeMs < since) continue;
  const t = { wf, agents: 0, done: 0, input: 0, cacheW: 0, cacheR: 0, output: 0, turns: 0, lastAt: 0 };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
    t.agents++;
    const lines = readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean);
    let lastStop = null;
    // 한 번의 응답이 블록(생각·글·도구 호출)마다 여러 줄로 기록되고 줄마다 같은 usage 가 붙는다 — 응답 id 별로 한 번만 센다
    const byId = new Map();
    for (const ln of lines) {
      let o; try { o = JSON.parse(ln); } catch { continue; }
      const u = o?.message?.usage;
      if (u && o.type === "assistant") {
        const id = o.message.id || o.requestId || ln.slice(0, 40);
        const prev = byId.get(id) || { i: 0, o: 0, w: 0, r: 0 };
        byId.set(id, { i: Math.max(prev.i, u.input_tokens || 0), o: Math.max(prev.o, u.output_tokens || 0), w: Math.max(prev.w, u.cache_creation_input_tokens || 0), r: Math.max(prev.r, u.cache_read_input_tokens || 0) });
        lastStop = o.message.stop_reason;
      }
    }
    for (const v of byId.values()) { t.input += v.i; t.output += v.o; t.cacheW += v.w; t.cacheR += v.r; t.turns++; }
    if (lastStop === "end_turn") t.done++;
    t.lastAt = Math.max(t.lastAt, statSync(`${dir}/${f}`).mtimeMs);
  }
  rows.push(t);
}
const M = (n) => (n / 1e6).toFixed(2) + "M";
for (const t of rows.sort((a, b) => a.lastAt - b.lastAt)) {
  console.log(`${t.wf}  에이전트 ${t.agents}(끝 ${t.done}) · 턴 ${t.turns} | 입력 ${M(t.input)} · 캐시쓰기 ${M(t.cacheW)} · 캐시읽기 ${M(t.cacheR)} · 출력 ${M(t.output)} | 입력+쓰기+출력 ${M(t.input + t.cacheW + t.output)}  전부 ${M(t.input + t.cacheW + t.cacheR + t.output)}`);
}
