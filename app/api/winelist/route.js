import { NextResponse } from "next/server";
import { hasApiKey } from "@/lib/claude";
import { readWineList, enrichWineList, sortByValue } from "@/lib/wineList";
import { recordWanted } from "@/lib/wanted";

export const runtime = "nodejs";
export const maxDuration = 60;

// 와인 리스트 한 장 → 항목별 대조 결과
//
// 비용은 저비용 모델 1회뿐이다. 항목이 10개든 30개든 호출 수는 그대로다.
// 대조(카탈로그·평점)와 시세는 AI를 쓰지 않는다.
export async function POST(request) {
  try {
    const { image } = await request.json();
    if (!image) return NextResponse.json({ error: "이미지가 필요합니다." }, { status: 400 });
    if (!hasApiKey()) {
      return NextResponse.json({ error: "API 키가 설정되지 않았습니다." }, { status: 503 });
    }

    const { readable, items, usage, currency, currencyKnown } = await readWineList(image);
    console.log(
      `[winelist] ${usage.model} | in ${usage.inputTokens} / out ${usage.outputTokens} | ${items.length}개 판독`
    );

    if (!readable || !items.length) {
      return NextResponse.json({ readable: false, items: [], usage });
    }

    const enriched = await enrichWineList(items, { currency });

    // 못 찾은 항목을 기록한다 — 다음에 카탈로그에 넣을 목록이 여기서 나온다.
    // 기록 실패가 사용자 응답을 막을 이유는 없다.
    try {
      await recordWanted(
        enriched.filter((i) => !i.known).map((i) => ({ name: i.name, vintage: i.vintage, price: i.price })),
        "winelist"
      );
    } catch (err) {
      console.warn("[winelist] 미매칭 기록 실패:", err.message);
    }

    return NextResponse.json({
      readable: true,
      currency,
      currencyKnown,
      items: sortByValue(enriched),
      counts: {
        total: enriched.length,
        known: enriched.filter((i) => i.known).length,
        priced: enriched.filter((i) => i.markup).length,
      },
      usage,
    });
  } catch (err) {
    const status = err?.status;
    let message = "리스트를 읽지 못했습니다.";
    if (status === 401) message = "API 키가 올바르지 않습니다.";
    else if (status === 429) message = "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.";
    else if (err?.message) message = err.message;
    console.error("[winelist]", err);
    return NextResponse.json({ error: message }, { status: status && status >= 400 ? status : 500 });
  }
}
