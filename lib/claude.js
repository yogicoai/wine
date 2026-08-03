// 분석 파이프라인 오케스트레이터
// analyze → callClaude → requestClaude(웹 검색) → 실패 시 requestClaude(지식만) 폴백
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, USER_PROMPT, userPromptByName } from "./prompts";
import { env } from "./env";
import { normalizeTasteProfile } from "./cats";

const MAX_TOKENS = 16000; // 검색 질의·adaptive thinking 이 출력 토큰을 잡아먹어 JSON이 잘리는 것 방지
const MAX_PAUSE_RETRIES = 4; // pause_turn 재요청 상한 (API 규약)

// "검색이 원인인 실패"만 구분해 폴백하기 위한 오류 클래스
export class WebSearchError extends Error {
  constructor(message, { permanent = false } = {}) {
    super(message);
    this.name = "WebSearchError";
    this.permanent = permanent; // true = 계정/모델이 web_search 미지원(400) → 세션 동안 비활성화
  }
}

// 400(미지원)이 한 번 뜨면 프로세스 살아있는 동안 검색 비활성화 (매 스캔 2배 호출 방지)
let webSearchBroken = false;

// .env 파일에서 줄바꿈이 깨지면 키 값에 다음 변수까지 딸려 들어와 HTTP 헤더 오류가 난다.
// 앞뒤 공백을 정리하고, 공백 뒤에 붙은 찌꺼기는 잘라낸 뒤 형식을 검증한다.
export function readApiKey() {
  const raw = process.env.ANTHROPIC_API_KEY;
  if (!raw) return null;
  const key = raw.trim().split(/\s+/)[0];
  if (!key.startsWith("sk-ant-")) {
    console.warn("[claude] ANTHROPIC_API_KEY 형식이 올바르지 않습니다. .env.local 을 확인하세요.");
    return null;
  }
  if (key !== raw.trim()) {
    console.warn("[claude] API 키에 불필요한 값이 붙어 있어 잘라냈습니다. .env.local 의 줄바꿈을 확인하세요.");
  }
  return key;
}

function getClient() {
  const key = readApiKey();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function hasApiKey() {
  return !!readApiKey();
}

// "최신 정보 더 찾기"(건별 웹 검색) 허용 여부.
// 스캔당 원가가 7배로 뛰므로 기본은 차단이며, DEEP_SEARCH=1 일 때만 열린다.
export function deepSearchAllowed() {
  return env("DEEP_SEARCH") === "1";
}

// 모델별 web_search 도구 버전 선택
function webSearchTool(model) {
  const version = model.includes("haiku")
    ? "web_search_20250305" // Haiku 4.5 = 기본 버전
    : "web_search_20260209"; // Sonnet 5 / Opus 4.8 = 동적 필터링 버전
  return { type: version, name: "web_search", max_uses: 3 };
}

function textOf(response) {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// 잘린 JSON 복구 — 열린 문자열/괄호를 닫아서 파싱 재시도
function repairJson(src) {
  let s = src;
  let inString = false;
  let escape = false;
  const stack = [];
  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) s += '"';
  // 끝의 콤마·미완성 키 제거
  s = s.replace(/,\s*$/, "").replace(/,\s*"[^"]*"?\s*:?\s*$/, "");
  while (stack.length) s += stack.pop();
  return JSON.parse(s);
}

// 웹 검색 인용 태그(<cite index="...">…</cite>) 등 XML 잔여물 제거
function sanitize(value) {
  if (typeof value === "string") {
    return value.replace(/<\/?cite[^>]*>/g, "").replace(/<\/?[a-z_]+[^>]*>/g, "").trim();
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  }
  return value;
}

export function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1) throw new Error("응답에서 JSON을 찾지 못했습니다.");
  const candidate = end > start ? text.slice(start, end + 1) : text.slice(start);
  let parsed;
  try {
    parsed = sanitize(JSON.parse(candidate));
  } catch {
    parsed = sanitize(repairJson(text.slice(start)));
  }

  // 맛 축은 주종마다 정해져 있는데 AI 는 이름을 조금씩 흔든다 ("타닌", "바디감",
  // "미네랄감"). 어긋난 축을 그대로 저장하면 그 술은 추천에서 통째로 빠지고
  // 레이더도 다른 모양으로 그려진다. 프롬프트로 일러 두었지만 받은 뒤에도 맞춘다.
  if (parsed?.tasteProfile) {
    parsed.tasteProfile = normalizeTasteProfile(parsed.tasteProfile, parsed.category);
  }
  return parsed;
}

// 토큰 사용량 누적 (pause_turn 루프·폴백 재시도까지 합산 → 실제 스캔당 원가 계산용)
function addUsage(acc, usage) {
  if (!usage) return acc;
  acc.inputTokens += usage.input_tokens || 0;
  acc.outputTokens += usage.output_tokens || 0;
  acc.cacheReadTokens += usage.cache_read_input_tokens || 0;
  acc.cacheWriteTokens += usage.cache_creation_input_tokens || 0;
  acc.webSearches += usage.server_tool_use?.web_search_requests || 0;
  acc.apiCalls += 1;
  return acc;
}

const emptyUsage = () => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
  apiCalls: 0,
});

// 실제 API 1회 호출 + pause_turn 루프 + 오류 분류
// input: { image } (라벨 사진) 또는 { name } (이름만 — 유사 와인 탐색)
async function requestClaude(client, model, input, useWeb, usage) {
  const content = input.image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: input.image },
        },
        { type: "text", text: USER_PROMPT },
      ]
    : [{ type: "text", text: userPromptByName(input.name) }];

  const params = {
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };
  if (useWeb) params.tools = [webSearchTool(model)];

  let response;
  try {
    response = await client.messages.create(params);
    addUsage(usage, response.usage);
  } catch (err) {
    if (useWeb && err instanceof Anthropic.BadRequestError) {
      // 계정/모델이 web_search 미지원 → 영구 폴백 트리거
      throw new WebSearchError(err.message, { permanent: true });
    }
    throw err;
  }

  // 서버 검색 루프 일시정지: 추가 user 메시지 없이 assistant 응답만 이어붙여 재요청
  let pauses = 0;
  while (response.stop_reason === "pause_turn" && pauses < MAX_PAUSE_RETRIES) {
    params.messages = [
      ...params.messages,
      { role: "assistant", content: response.content },
    ];
    response = await client.messages.create(params);
    addUsage(usage, response.usage);
    pauses++;
  }

  const text = textOf(response);
  if (useWeb) {
    if (response.stop_reason === "pause_turn" || !text.trim()) {
      throw new WebSearchError("검색 지연으로 빈 응답");
    }
    if (response.stop_reason === "max_tokens") {
      try {
        return parseJson(text); // 잘렸어도 복구 가능하면 사용
      } catch {
        throw new WebSearchError("검색 텍스트로 인한 max_tokens 잘림");
      }
    }
  }
  return parseJson(text);
}

// 오케스트레이터 — 웹 검색 시도 → 검색이 원인인 실패면 지식 기반 폴백
// input: { image } 또는 { name }
export async function callClaude(input) {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY 미설정");

  const model = env("CLAUDE_MODEL", "claude-sonnet-5");

  // 웹 검색은 기본 OFF — 검색 결과가 입력 토큰의 대부분(≈76k)을 차지해 스캔 원가가 7.5배(45원→316원),
  // 소요 시간이 6배(30초→179초)로 늘어난다. 가격은 무료인 네이버쇼핑 조회가 이미 담당하므로 중복이다.
  //
  // 요청의 { web: true }(결과 화면의 "최신 정보 더 찾기")는 DEEP_SEARCH=1 일 때만 받아들인다.
  // UI를 숨기는 것만으로는 API 직접 호출을 막을 수 없어, 서버에서 한 번 더 차단한다.
  if (input.web === true && !deepSearchAllowed()) {
    console.warn("[claude] DEEP_SEARCH가 꺼져 있어 웹 검색 요청을 무시합니다.");
  }
  const webEnabled =
    ((input.web === true && deepSearchAllowed()) || env("WEB_SEARCH") === "1") &&
    input.web !== false &&
    !webSearchBroken;
  const usage = emptyUsage();

  if (webEnabled) {
    try {
      const result = await requestClaude(client, model, input, true, usage);
      return { result, usedWeb: true, webFellBack: false, usage, model };
    } catch (err) {
      if (!(err instanceof WebSearchError)) throw err; // 401/429/529 등은 폴백 없이 그대로
      if (err.permanent) webSearchBroken = true;
      const result = await requestClaude(client, model, input, false, usage);
      return { result, usedWeb: false, webFellBack: true, webDisabled: err.permanent, usage, model };
    }
  }

  const result = await requestClaude(client, model, input, false, usage);
  return { result, usedWeb: false, webFellBack: false, usage, model };
}
