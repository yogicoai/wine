// 라벨 1차 판독 — 저비용 모델로 "제품명"만 뽑아 카탈로그 조회에 사용한다.
// 카탈로그에 있으면 본 분석(Sonnet)을 건너뛰므로 스캔 원가가 63원 → 수 원 수준으로 떨어진다.
import Anthropic from "@anthropic-ai/sdk";
import { readApiKey } from "./claude";

const IDENTIFY_PROMPT = `이 술 라벨 사진에서 제품을 식별해 JSON 하나만 출력하세요. 설명·코드펜스 없이 JSON만.

{
  "readable": true|false,        // 라벨 글자를 읽을 수 있으면 true
  "name": "제품명 (라벨 표기 그대로, 한국에서 통용되는 표기가 있으면 그것으로. 연도 제외)",
  "vintage": "연도 4자리 또는 null",
  "confidence": 0-100            // 제품 특정에 대한 확신도
}

주의: 추측하지 마세요. 라벨이 흐리거나 브랜드를 특정할 수 없으면 readable=false, confidence를 낮게 주세요.`;

export function identifyEnabled() {
  return process.env.PRESCAN !== "0" && !!readApiKey();
}

export async function identifyLabel(base64) {
  const model = (process.env.IDENTIFY_MODEL || "claude-haiku-4-5").trim();
  const client = new Anthropic({ apiKey: readApiKey() });

  const response = await client.messages.create({
    model,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: IDENTIFY_PROMPT },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("판독 응답 파싱 실패");

  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    ...parsed,
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      model,
    },
  };
}
