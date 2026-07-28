// 와인 리스트(메뉴판) 통째 읽기.
//
// 식당에서 와인 리스트를 받았을 때 "뭘 시켜야 하나"가 진짜 문제다.
// 한 장을 찍으면 항목을 모두 뽑아 우리 DB와 대조하고, 시중가와 비교해 가성비 순으로 세운다.
//
// 판독은 저비용 모델 한 번이면 끝난다(항목 수와 무관하게 1회).
// 대조는 우리 카탈로그를 읽는 것이라 무료, 시세는 판매처 무료 API를 쓴다.
import Anthropic from "@anthropic-ai/sdk";
import { readApiKey } from "./claude";
import { lookupCatalog } from "./catalog";
import { getRating } from "./ratings";
import { searchShop, lowestPrice, hasNaverKeys } from "./naver";

const MAX_ITEMS = 40; // 판독할 최대 항목 수
const MAX_PRICED = 12; // 시세를 조회할 최대 항목 수 (조회는 느리므로 상위만)

const LIST_PROMPT = `이 사진은 음식점·바의 와인(주류) 리스트입니다. 적힌 항목을 그대로 뽑아 JSON 하나만 출력하세요. 설명·코드펜스 없이 JSON만.

{
  "readable": true|false,
  "items": [
    {
      "name": "표기된 술 이름 (연도 제외, 한국에서 통용되는 표기가 있으면 그것으로)",
      "vintage": "연도 4자리 또는 null",
      "price": 숫자 또는 null,      // 메뉴에 적힌 판매가(원). "8.5"처럼 만원 단위 축약이면 85000으로 환산
      "glass": true|false          // 잔 단위 판매면 true, 병이면 false
    }
  ]
}

규칙
- 사진에 적힌 것만 뽑으세요. 없는 항목을 지어내지 마세요.
- 카테고리 제목(레드/화이트 등), 안주, 주류가 아닌 항목은 제외하세요.
- 글자가 잘리거나 흐려 이름을 특정할 수 없는 줄은 건너뛰세요.
- 리스트로 보이지 않으면 readable=false, items=[] 로 응답하세요.
- 최대 ${MAX_ITEMS}개까지만.`;

function parseItems(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("리스트 판독 응답 파싱 실패");

  const parsed = JSON.parse(text.slice(start, end + 1));
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return {
    readable: parsed.readable !== false && items.length > 0,
    items: items
      .filter((it) => it?.name && String(it.name).trim().length > 1)
      .slice(0, MAX_ITEMS)
      .map((it) => ({
        name: String(it.name).trim(),
        vintage: /^(19|20)\d{2}$/.test(String(it.vintage)) ? String(it.vintage) : null,
        price: Number.isFinite(Number(it.price)) && Number(it.price) > 0 ? Math.round(Number(it.price)) : null,
        glass: it.glass === true,
      })),
  };
}

/** 사진 한 장 → 메뉴 항목 배열 (저비용 모델 1회 호출) */
export async function readWineList(base64) {
  const model = (process.env.IDENTIFY_MODEL || "claude-haiku-4-5").trim();
  const client = new Anthropic({ apiKey: readApiKey() });

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: LIST_PROMPT },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    ...parseItems(text),
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      model,
    },
  };
}

/**
 * 메뉴 항목을 우리 DB·시세와 대조한다.
 * 카탈로그 조회는 무료, 시세 조회는 무료 API. AI는 부르지 않는다.
 */
export async function enrichWineList(items) {
  // 1) 카탈로그·집단 평점 대조 (전부, 무료)
  const enriched = [];
  for (const it of items) {
    const hit =
      (await lookupCatalog(it.name, it.vintage)) ||
      (it.vintage ? await lookupCatalog(it.name, null) : null);

    enriched.push({
      ...it,
      known: !!hit,
      result: hit?.result || null,
      image: hit?.image || null,
      category: hit?.result?.category || null,
      rating: hit ? await getRating(it.name, it.vintage) : null,
      market: null,
      markup: null,
    });
  }

  // 2) 시세 조회 — 느리므로 메뉴가가 있고 우리 DB에 있는 것 위주로 상위 몇 개만
  if (hasNaverKeys()) {
    const targets = enriched
      .map((it, index) => ({ it, index }))
      .filter(({ it }) => it.price && !it.glass)
      .sort((a, b) => (b.it.known ? 1 : 0) - (a.it.known ? 1 : 0))
      .slice(0, MAX_PRICED);

    for (const { it, index } of targets) {
      try {
        const keyword = it.result?.searchKeyword || it.name;
        const products = (await searchShop(keyword, "liquor", { display: 10 })) || [];
        const market = lowestPrice(products);
        if (!market) continue;

        enriched[index].market = market;
        // 식당가가 시중가의 몇 배인가 — 와인은 통상 2~3배가 관행이다
        enriched[index].markup = Math.round((it.price / market) * 10) / 10;
      } catch {
        /* 개별 실패는 넘어간다 */
      }
      await new Promise((r) => setTimeout(r, 120)); // 연속 호출 간격
    }
  }

  return enriched;
}

/**
 * 가성비 순 정렬.
 * 배수가 낮을수록 좋고, 배수를 모르면 평점으로, 그것도 없으면 원래 순서를 지킨다.
 */
export function sortByValue(items) {
  return [...items]
    .map((it, i) => ({ ...it, order: i }))
    .sort((a, b) => {
      if (a.markup && b.markup) return a.markup - b.markup;
      if (a.markup) return -1;
      if (b.markup) return 1;

      const ra = a.rating?.average || 0;
      const rb = b.rating?.average || 0;
      if (ra !== rb) return rb - ra;

      if (a.known !== b.known) return a.known ? -1 : 1;
      return a.order - b.order;
    });
}
