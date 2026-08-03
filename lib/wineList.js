// 와인 리스트(메뉴판) 통째 읽기.
//
// 식당에서 와인 리스트를 받았을 때 "뭘 시켜야 하나"가 진짜 문제다.
// 한 장을 찍으면 항목을 모두 뽑아 우리 DB와 대조하고, 시중가와 비교해 가성비 순으로 세운다.
//
// 판독은 저비용 모델 한 번이면 끝난다(항목 수와 무관하게 1회).
// 대조는 우리 카탈로그를 읽는 것이라 무료, 시세는 판매처 무료 API를 쓴다.
import Anthropic from "@anthropic-ai/sdk";
import { readApiKey } from "./claude";
import { lookupCatalog, catalogNameIndex } from "./catalog";
import { findLooseMatch } from "./match";
import { getRating } from "./ratings";
import { searchShop, lowestPrice, hasNaverKeys } from "./naver";
import { APP } from "./appProfile";

const MAX_ITEMS = 40; // 판독할 최대 항목 수
const MAX_PRICED = 12; // 시세를 조회할 최대 항목 수 (조회는 느리므로 상위만)

// 해외에서 찍는 경우가 실제로 있다 — 일본 이자카야의 사케 리스트, 파리 비스트로의
// 와인 리스트. 메뉴에 적힌 숫자를 원화로 착각하면 1,200엔짜리가 1,200원이 된다.
const CURRENCIES = ["KRW", "JPY", "USD", "EUR", "GBP", "CNY", "TWD", "HKD"];

// 화면 언어가 곧 읽는 사람의 언어다. 한국 앱은 한국어로, 전통술 앱은 영어로 옮긴다.
const LIST_LANG =
  APP.locale === "en"
    ? `- "name" must be ENGLISH (or the common Latin spelling). If the menu is in Korean or Japanese, use the brand's actual reading, not a character-by-character gloss (獺祭 → Dassai, 而今 → Jikon).`
    : `- "name" 은 반드시 한국어 표기로 옮기세요. 메뉴가 일본어·프랑스어·영어 등 무엇으로 적혀 있든, 한국 주류 시장에서 통용되는 한글 표기로 바꿉니다.
- **한자를 음독하지 마세요.** 일본 술 이름은 일본어 읽기를 한글로 옮깁니다. 한국 한자음으로 읽으면 전혀 다른 이름이 됩니다.
    獺祭→닷사이 · 田酒→덴슈 · 而今→지콘 · 十四代→주욘다이 · 黒龍→고쿠류
    磯自慢→이소지만 · 新政→아라마사 · 鍋島→나베시마 · 八海山→핫카이산
    久保田→쿠보타 · 剣菱→켄비시 · 菊正宗→기쿠마사무네 · 出羽桜→데와자쿠라
    醸し人九平次→카모시비토 쿠헤이지 · 風の森→카제노모리 · 飛露喜→히로키
- 등급·제법 표기도 일본어 읽기로 옮깁니다.
    純米大吟醸→준마이 다이긴조 · 純米吟醸→준마이긴조 · 純米→준마이 · 本醸造→혼조조
    本丸→혼마루 · 特別純米→도쿠베츠 준마이 · 生酛→키모토 · 山廃→야마하이 · 無濾過→무로카
- 프랑스·이탈리아 와인도 국내 통용 표기를 씁니다. Château→샤또, Domaine→도멘, Tenuta→테누타.
- 잔·병 단위 표기(グラス·一合·by the glass·Verre)는 glass 값으로만 담고 name 에서는 빼세요.`;

const LIST_PROMPT = `이 사진은 음식점·바의 와인(주류) 리스트입니다. 적힌 항목을 뽑아 JSON 하나만 출력하세요. 설명·코드펜스 없이 JSON만.

{
  "readable": true|false,
  "currency": "KRW|JPY|USD|EUR|GBP|CNY|TWD|HKD|null",
  "items": [
    {
      "name": "술 이름 (연도 제외)",
      "original": "메뉴에 인쇄된 그대로의 표기. 옮기지 말 것. name 과 같으면 null",
      "vintage": "연도 4자리 또는 null",
      "price": 숫자 또는 null,      // 메뉴에 적힌 숫자 그대로. 환율을 계산하지 마세요
      "glass": true|false          // 잔 단위 판매면 true, 병이면 false
    }
  ]
}

규칙
- 사진에 적힌 것만 뽑으세요. 없는 항목을 지어내지 마세요.
${LIST_LANG}
- "original" 은 손님이 메뉴판에서 그 줄을 다시 찾을 수 있게 하는 값입니다. 한자·가나·악센트를 그대로 두세요.
- **통화**: 메뉴에 적힌 통화를 판별해 currency 에 적으세요. 円·¥ 는 JPY, $ 는 USD, € 는 EUR, 원·₩ 는 KRW 입니다.
  통화 표시가 없으면 메뉴의 언어와 가격 자릿수로 판단하고, 그래도 모르겠으면 null 로 두세요.
- **price 는 환산하지 마세요.** 메뉴에 1,200 이라 적혀 있으면 1200 입니다.
  단 한국 메뉴에서 "8.5"처럼 만원 단위로 축약한 경우만 85000 으로 폅니다.
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
  const currency = CURRENCIES.includes(parsed.currency) ? parsed.currency : null;

  return {
    readable: parsed.readable !== false && items.length > 0,
    // 통화를 못 읽었으면 원화로 본다 — 국내에서 찍는 경우가 압도적으로 많다
    currency: currency || "KRW",
    currencyKnown: !!currency,
    items: items
      .filter((it) => it?.name && String(it.name).trim().length > 1)
      .slice(0, MAX_ITEMS)
      .map((it) => {
        const name = String(it.name).trim();
        const original = it.original ? String(it.original).trim() : null;
        return {
          name,
          // 메뉴판에서 그 줄을 다시 찾으려면 인쇄된 표기가 필요하다.
          // 옮긴 이름과 같으면 두 번 보여 줄 이유가 없다.
          original: original && original !== name ? original : null,
          vintage: /^(19|20)\d{2}$/.test(String(it.vintage)) ? String(it.vintage) : null,
          price:
            Number.isFinite(Number(it.price)) && Number(it.price) > 0
              ? Math.round(Number(it.price))
              : null,
          glass: it.glass === true,
        };
      }),
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

// 한자·가나만 남긴다. 띄어쓰기와 숫자를 떼어 내야 "獺祭 純米大吟醸 45" 와
// 검색어 "獺祭 純米大吟醸" 이 같은 줄로 만난다.
const onlyCjk = (s) => String(s || "").replace(/[^぀-ヿ一-鿿]/g, "");

function findByOriginal(original, index) {
  const q = onlyCjk(original);
  // 두 글자로는 엉뚱한 술에 붙는다 — 브랜드를 특정하려면 세 글자는 있어야 한다
  if (q.length < 3) return null;
  return (
    index.find((d) => {
      const k = onlyCjk(d.searchKeyword);
      return k.length >= 3 && (k.includes(q) || q.includes(k));
    }) || null
  );
}

/**
 * 메뉴 항목을 우리 DB·시세와 대조한다.
 * 카탈로그 조회는 무료, 시세 조회는 무료 API. AI는 부르지 않는다.
 */
export async function enrichWineList(items, { currency = "KRW" } = {}) {
  // 느슨한 매칭용 색인 — 메뉴판 표기는 DB 표기와 늘 조금씩 다르므로
  // 정확 일치에 실패하면 토큰 겹침으로 한 번 더 찾는다.
  const index = await catalogNameIndex();

  // 1) 카탈로그·집단 평점 대조 (전부, 무료)
  const enriched = [];
  for (const it of items) {
    // 리스트 대조에는 뼈대만 있어도 충분하다.
    // 이름·산지·품종과 시세 비교가 목적이지 결과 화면을 채우려는 것이 아니다.
    const opts = { allowStub: true };
    let matchedName = null;
    let hit =
      (await lookupCatalog(it.name, it.vintage, opts)) ||
      (it.vintage ? await lookupCatalog(it.name, null, opts) : null);

    if (!hit) {
      const loose = findLooseMatch(it.name, index);
      if (loose) {
        hit = await lookupCatalog(loose.candidate.name, loose.candidate.vintage, opts);
        // 다른 이름으로 이었다는 것을 화면에 밝힌다 — 잘못 이었을 때 알아챌 수 있어야 한다
        if (hit && hit.result.name !== it.name) matchedName = hit.result.name;
      }
    }

    // 옮긴 이름이 한 글자 어긋나면(닷사이/닛사이) 위에서 못 찾는다.
    // 메뉴에 인쇄된 원어는 그대로이므로, 검색어에 원어를 적어 둔 술은 여기서 붙는다.
    if (!hit && it.original) {
      const byOriginal = findByOriginal(it.original, index);
      if (byOriginal) {
        hit = await lookupCatalog(byOriginal.name, byOriginal.vintage, opts);
        if (hit && hit.result.name !== it.name) matchedName = hit.result.name;
      }
    }

    enriched.push({
      ...it,
      known: !!hit,
      matchedName,
      result: hit?.result || null,
      image: hit?.image || null,
      category: hit?.result?.category || null,
      country: hit?.result?.country || null,
      rating: hit ? await getRating(hit.result.name, it.vintage) : null,
      market: null,
      markup: null,
    });
  }

  // 2) 시세 조회 — 느리므로 메뉴가가 있고 우리 DB에 있는 것 위주로 상위 몇 개만
  //
  // 우리 시세는 국내 판매가(원)다. 메뉴가 엔이나 유로면 두 숫자를 나눌 수 없다.
  // 환율을 끌어와 억지로 맞추면 "3.2배" 같은 수치가 환율 변동에 따라 흔들리는데,
  // 그 숫자를 보고 주문을 정하므로 틀린 값을 보여 주느니 내보내지 않는다.
  if (hasNaverKeys() && currency === "KRW") {
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
