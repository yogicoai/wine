// 조사 러너 — 묶음마다 별도의 Claude CLI 세션(`claude -p`)을 띄워 조사한다.
//
//   node scripts/research-runner.mjs --queue sk,wp,tr --lanes 4 --effort medium [--until <ISO>] [--max-usd 6] [--dry]
//
// 왜 워크플로가 아니라 이 러너인가 (2026-10-01)
//  · WebSearch 는 "세션당 200회"로 막혀 있다 (CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION). 워크플로의 에이전트는 모두 이 대화
//    세션을 공유해 첫 가동에서 200회를 다 썼고, 그 뒤 에이전트는 검색 없이 주소를 짐작해 열었다. 묶음마다 새 세션을 띄우면
//    묶음마다 새 예산을 받는다.
//  · 묶음마다 비용(total_cost_usd)·토큰·턴이 정확히 나온다 → data/research/_work/runs.jsonl
//  · 사용률(5시간·주간)을 보고 스스로 속도를 조절한다 — 5시간 창이 차가는 중이면 새 묶음을 미루고, 주간이 선에 닿으면 멈춘다.
//  · 이 대화 세션과 맥락·한도를 따로 쓴다 (대화 세션이 막혀도 러너는 돈다).
//
// 규칙(프롬프트)은 scripts/wf/research.mjs 의 RULES 를 그대로 읽어 쓴다 — 한 곳만 고치면 된다.
// 입력 data/research/_work/in/<접두사>-NNN.json → 결과 data/research/_work/out/<같은 이름> (이미 있으면 건너뜀)
//
// 멈추기: data/research/_work/RUNNER_STOP 파일을 만들면 새 묶음을 걸지 않고, 도는 것이 끝나면 끝낸다.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const QUEUE = String(arg("--queue", "")).split(",").map((s) => s.trim()).filter(Boolean);
const LANES = Number(arg("--lanes", 4));
// --kind images  : 사진 눈 확인 묶음을 같은 방식으로 돌린다 (data/images/_work/{in,out}, 도구는 Read·Write 만)
// --kind imgfind : 사진이 없는 술의 병 사진 주소를 웹에서 찾는다 (data/images/_work/find-{in,out}, 검색·열람 가능)
const KIND = arg("--kind", "research");
const IMG = KIND === "images", FIND = KIND === "imgfind", LIGHT = IMG || FIND;
// --kind audit   : 검증된 술 표본을 다른 모델로 다시 확인한다 (data/research/_work/audit-{in,out}, 검색·열람 가능, 규칙 scripts/wf/audit-rules.md)
const AUDIT = KIND === "audit";
const MODEL = arg("--model", "claude-sonnet-5-5");
const EFFORT = arg("--effort", LIGHT ? "medium" : "high");
const MAX_USD = Number(arg("--max-usd", LIGHT ? 3 : 6));
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Infinity;
const DRY = process.argv.includes("--dry");
const FIVE_PAUSE = Number(arg("--five-pause", 0.9));      // 5시간 창이 이 이상이면 새 묶음을 미룬다
const WEEK_STOP = Number(arg("--week-stop", 0.66));       // 주간이 이 이상이면 멈춘다
const MAX_ATTEMPTS = 2;

const UW = "data/research/_work";                              // 사용률 기록·전체 멈춤 파일은 항상 여기
const W = LIGHT ? "data/images/_work" : UW;
const IN = FIND ? `${W}/find-in` : AUDIT ? `${W}/audit-in` : `${W}/in`, OUT = FIND ? `${W}/find-out` : AUDIT ? `${W}/audit-out` : `${W}/out`;
const SUF = IMG ? "-img" : FIND ? "-find" : AUDIT ? "-audit" : "";
// 감사는 따로 멈춘다(AUDIT_STOP) — 밤샘 조사를 닫으며 남긴 RUNNER_STOP 에 막히지 않게
const LOG = `${W}/runner${SUF}.log`, RUNS = `${W}/runs${FIND ? "-find" : AUDIT ? "-audit" : ""}.jsonl`, STOPF = AUDIT ? `${W}/AUDIT_STOP` : `${W}/RUNNER_STOP`, STATUS = `${W}/runner${SUF}-status.json`;
// --hard-stop : 도는 중에도 몇 분마다 주간 사용률을 다시 재서, 선(--week-stop)에 닿으면 도는 묶음까지 끊고 멈춘다
const HARD = process.argv.includes("--hard-stop");
mkdirSync(OUT, { recursive: true });
const ts = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
const log = (s) => { const l = `${ts()} ${s}`; console.log(l); try { appendFileSync(LOG, l + "\n"); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!QUEUE.length) { console.error("--queue 가 필요합니다 (예: sk,wp,tr)"); process.exit(2); }

// ── 프롬프트: research.mjs 의 RULES 를 꺼내 쓴다 ──
function loadRules() {
  if (FIND) return readFileSync("scripts/wf/imgfind-rules.md", "utf8").trim();
  if (AUDIT) return readFileSync("scripts/wf/audit-rules.md", "utf8").trim();
  const file = IMG ? "scripts/wf/imgcheck.mjs" : "scripts/wf/research.mjs";
  const src = readFileSync(file, "utf8");
  const a = src.indexOf("const RULES = `");
  const b = src.indexOf("`\n", a + 16);
  if (a < 0 || b < 0) throw new Error(`${file} 에서 RULES 를 못 찾음`);
  let rules = src.slice(a + "const RULES = `".length, b);
  // 워크플로용 문장을 이 세션에 맞게 바꾼다 — 도구는 처음부터 열려 있고 ToolSearch 는 없다
  if (!IMG) rules = rules.split("\n").map((ln) => (ln.includes("ToolSearch") ? "1) WebSearch 와 WebFetch 가 열려 있습니다. 한국어·영어·일본어 검색이 모두 됩니다. (ToolSearch 도구는 없습니다.)" : ln)).join("\n");
  return rules;
}
const RULES = loadRules();
const promptFor = (inPath, outPath) => FIND
  ? `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${outPath}`
  : AUDIT
  ? `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${outPath}\n\n먼저 입력 파일을 Read 하고, 모든 술을 확인해 결과 파일을 Write 로 쓰세요. 쓴 뒤 Read 로 다시 열어 JSON 이 유효한지 확인하세요. 마지막 응답은 요약 한 줄(술 수·주장 수·판정별 개수)만 쓰세요.`
  : IMG
  ? `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${outPath}\n\n먼저 입력 파일을 Read 하고, 사진을 열어 판정해 결과 파일을 Write 로 쓰세요. 쓴 뒤 Read 로 다시 열어 JSON 이 유효한지 확인하세요. 마지막 응답은 요약 한 줄(항목 수·맞음·다름·불명·상품 아님)만 쓰세요.`
  : `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${outPath}\n\n먼저 입력 파일을 Read 하고, 모든 항목을 조사해 결과 파일을 Write 로 쓰세요. 쓴 뒤 Read 로 다시 열어 JSON 이 유효한지 확인하세요. 마지막 응답은 요약 한 줄(항목 수·상태별 개수·고친 수·뺀 수·검색 횟수)만 쓰세요.`;

// ── claude 실행 파일 ──
function findExe() {
  if (process.env.CLAUDE_EXE) return process.env.CLAUDE_EXE;
  const base = `${homedir()}/.vscode/extensions`;
  const dirs = readdirSync(base).filter((d) => d.startsWith("anthropic.claude-code-")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
  for (const d of dirs) { const p = `${base}/${d}/resources/native-binary/claude.exe`; if (existsSync(p)) return p; }
  throw new Error("claude 실행 파일을 못 찾음");
}
const EXE = findExe();

// 자식 세션에 넘기는 환경 — DB·FTP 비밀은 넘기지 않는다
const childEnv = (() => {
  const e = { ...process.env };
  for (const k of Object.keys(e)) if (/^(MONGODB|YOGIBO|FTP|NAVER|ANTHROPIC_API|OPENAI|SCRAPER|ELEVENST)/i.test(k)) delete e[k];
  delete e.CLAUDECODE; delete e.CLAUDE_CODE_ENTRYPOINT;
  return e;
})();

// ── 사용률 ──
function usage(maxAge = 8 * 60000) {
  let u = null;
  try { u = JSON.parse(readFileSync(`${UW}/usage.json`, "utf8")); } catch {}
  const age = u ? Date.now() - new Date(u.at).getTime() : Infinity;
  if (!u || age > maxAge) {
    const r = spawnSync(process.execPath, ["scripts/usage-probe.mjs", "--json"], { encoding: "utf8", timeout: 120000 });
    try { u = JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch {}
  }
  return u;
}

// ── 큐: 접두사 순서대로, 결과 파일이 없는 묶음 ──
function pending() {
  const list = [];
  for (const p of QUEUE) {
    const ins = readdirSync(IN).filter((f) => f.startsWith(`${p}-`) && /-\d+\.json$/.test(f)).sort();
    for (const f of ins) {
      const out = `${OUT}/${f}`;
      if (existsSync(out) && statSync(out).size > 10) continue;
      list.push(f);
    }
  }
  return list;
}

const state = { running: new Map(), children: new Map(), halt: false, done: 0, failed: 0, costUsd: 0, attempts: {}, startedAt: ts(), consecFail: 0 };
const writeStatus = (extra = {}) => { try { writeFileSync(STATUS, JSON.stringify({ at: ts(), lanes: LANES, effort: EFFORT, model: MODEL, queue: QUEUE, running: [...state.running.keys()], done: state.done, failed: state.failed, costUsd: +state.costUsd.toFixed(2), ...extra }, null, 1)); } catch {} };

function runBatch(file) {
  return new Promise((resolve) => {
    const inPath = `${IN}/${file}`;
    const t0 = Date.now();
    const args = [
      "-p", "--model", MODEL, "--effort", EFFORT, "--output-format", "stream-json", "--verbose", "--no-session-persistence",
      ...(IMG
        ? ["--tools", "Read,Write", "--allowedTools", "Read", "Write"]
        : FIND || AUDIT ? ["--tools", "Read,Write,WebSearch,WebFetch", "--allowedTools", "Read", "Write", "WebSearch", "WebFetch"]
        : ["--tools", "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch", "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]),
      "--permission-mode", "acceptEdits", "--permission-prompts", "none",
      "--strict-mcp-config", "--disable-slash-commands", "--max-budget-usd", String(MAX_USD),
    ];
    const child = spawn(EXE, args, { cwd: process.cwd(), env: childEnv, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    state.children.set(file, child);
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.stdin.end(promptFor(inPath.replace(/\\/g, "/"), `${OUT}/${file}`));
    const killer = setTimeout(() => { try { child.kill(); } catch {} }, 55 * 60000);       // 한 묶음 55분 상한
    child.on("close", (code) => {
      clearTimeout(killer);
      state.children.delete(file);
      // stream-json: 줄마다 사건이다. 마지막 result 가 합계이고, assistant 의 tool_use 로 도구 호출 수를 센다
      let res = null; const tools = {};
      for (const ln of stdout.split("\n")) {
        if (!ln.startsWith("{")) continue;
        let o; try { o = JSON.parse(ln); } catch { continue; }
        if (o.type === "result") res = o;
        else if (o.type === "assistant" && Array.isArray(o.message?.content)) for (const b of o.message.content) if (b.type === "tool_use") tools[b.name] = (tools[b.name] || 0) + 1;
      }
      const outPath = `${OUT}/${file}`;
      let outOk = false, entries = 0;
      try { const d = JSON.parse(readFileSync(outPath, "utf8")); entries = (Array.isArray(d) ? d : (d.entries || [])).length; outOk = entries > 0; } catch {}
      const u = res?.usage || {};
      const rec = {
        at: new Date().toISOString(), file, ok: outOk, code, entries, ms: Date.now() - t0,
        costUsd: res?.total_cost_usd ?? null, turns: res?.num_turns ?? null, isError: res?.is_error ?? null,
        input: u.input_tokens ?? null, output: u.output_tokens ?? null, cacheW: u.cache_creation_input_tokens ?? null, cacheR: u.cache_read_input_tokens ?? null,
        searches: tools.WebSearch ?? 0, fetches: tools.WebFetch ?? 0, tools, effort: EFFORT, model: MODEL,
        err: outOk ? null : String(res?.result || stderr || "").slice(0, 200),
      };
      try { appendFileSync(RUNS, JSON.stringify(rec) + "\n"); } catch {}
      resolve(rec);
    });
    child.on("error", (e) => { clearTimeout(killer); resolve({ file, ok: false, err: String(e.message), costUsd: 0 }); });
  });
}

async function lane(k, queue) {
  while (true) {
    if (state.halt) { log(`레인 ${k}: 사용률 선에 닿아 멈춤`); return; }
    if (existsSync(STOPF) || (!AUDIT && existsSync(`${UW}/RUNNER_STOP`))) { log(`레인 ${k}: 멈춤 파일(${STOPF.split("/").pop()}) — 멈춤`); return; }
    if (Date.now() > UNTIL) { log(`레인 ${k}: 시간이 다 되어 멈춤`); return; }
    // 사용률 확인
    const u = usage();
    if (u?.sevenDay != null && u.sevenDay >= WEEK_STOP) { log(`레인 ${k}: 주간 ${Math.round(u.sevenDay * 100)}% — 선에 닿아 멈춤`); return; }
    if (u?.fiveHour != null && u.fiveHour >= FIVE_PAUSE) {
      const wait = Math.min(Math.max(((u.fiveHourResetsAt || 0) * 1000 - Date.now()), 60000), 30 * 60000);
      log(`레인 ${k}: 5시간 창 ${Math.round(u.fiveHour * 100)}% — 새 묶음을 미루고 ${Math.round(wait / 60000)}분 쉼`);
      writeStatus({ paused: "five-hour" });
      await sleep(wait); continue;
    }
    if (state.consecFail >= 4) { log(`레인 ${k}: 연속 실패 ${state.consecFail}번 — 5분 쉼`); await sleep(5 * 60000); state.consecFail = 0; continue; }
    const file = queue.shift();
    if (!file) return;
    if (state.running.has(file)) continue;
    state.attempts[file] = (state.attempts[file] || 0) + 1;
    state.running.set(file, Date.now());
    writeStatus();
    log(`레인 ${k}: ${file} 시작 (시도 ${state.attempts[file]})`);
    const rec = await runBatch(file);
    state.running.delete(file);
    if (rec.costUsd) state.costUsd += rec.costUsd;
    if (rec.ok) { state.done++; state.consecFail = 0; log(`레인 ${k}: ${file} 완료 — 항목 ${rec.entries} · $${(rec.costUsd ?? 0).toFixed(2)} · ${rec.turns}턴 · ${Math.round(rec.ms / 60000)}분 · 검색 ${rec.searches ?? "?"} · 열람 ${rec.fetches ?? "?"}`); }
    else {
      state.failed++; state.consecFail++;
      log(`레인 ${k}: ${file} 실패 — ${rec.err}`);
      if (state.attempts[file] < MAX_ATTEMPTS) queue.unshift(file);       // 한 번 더 — 바로 다음 순서로 (JSON 이 깨진 묶음이 대개 다시 하면 된다)
    }
    writeStatus();
  }
}

const queue = pending();
log(`러너 시작 — 큐 ${QUEUE.join(",")} · 대기 ${queue.length}묶음 · 레인 ${LANES} · 모델 ${MODEL} · 강도 ${EFFORT} · 묶음당 상한 $${MAX_USD}`);
if (DRY) { console.log(queue.slice(0, 20).join(" ") + (queue.length > 20 ? " …" : "")); process.exit(0); }
// 도는 중에도 3분마다 주간 사용률을 다시 재고, 선에 닿으면 도는 묶음까지 끊는다 (사용자가 정한 선을 넘지 않게)
if (HARD) setInterval(() => {
  if (state.halt) return;
  const u = usage(3 * 60000);
  if (u?.sevenDay != null && u.sevenDay >= WEEK_STOP) {
    state.halt = true;
    log(`주간 ${Math.round(u.sevenDay * 100)}% — 선(${Math.round(WEEK_STOP * 100)}%)에 닿아 도는 묶음 ${state.children.size}개를 끊고 멈춤`);
    for (const c of state.children.values()) { try { c.kill(); } catch {} }
    writeStatus({ halted: "week-stop", sevenDay: u.sevenDay });
  }
}, 3 * 60000).unref();
await Promise.all(Array.from({ length: LANES }, (_, i) => lane(i + 1, queue)));
log(`러너 끝 — 완료 ${state.done} · 실패 ${state.failed} · 비용 $${state.costUsd.toFixed(2)}`);
writeStatus({ finished: true });
process.exit(0);
