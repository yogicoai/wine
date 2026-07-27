import { NextResponse } from "next/server";
import { callClaude, hasApiKey, deepSearchAllowed } from "@/lib/claude";
import { lookupCatalog, saveCatalog } from "@/lib/catalog";
import { identifyEnabled, identifyLabel } from "@/lib/identify";
import { DEMOS } from "@/lib/demos";

// Vercel 무료(Hobby) 플랜의 서버리스 함수 상한이 60초다.
// 웹 검색 OFF 기본 설정에서는 스캔이 ~30초라 여유가 있지만,
// "최신 정보 더 찾기"(약 3분)는 Pro 플랜(최대 300초)이 필요하다.
export const maxDuration = 60;
export const runtime = "nodejs";

let demoCursor = 0;

// 분석 파이프라인
//   1) 이름으로 요청  → 카탈로그 조회 → 있으면 즉시 응답 (AI 호출 0)
//   2) 사진으로 요청  → 저비용 모델로 제품명 판독 → 카탈로그 조회 → 있으면 즉시 응답
//   3) 카탈로그에 없으면 본 분석(Sonnet) 후 카탈로그에 적재 → 다음부터는 무료
export async function POST(request) {
  try {
    // image: base64 (data URL prefix 제거) / name: 이름으로 분석 / web: 웹 검색 강제
    // fresh: true → 캐시 무시하고 재분석
    const { image, name, web, fresh } = await request.json();
    if (!image && !name && hasApiKey()) {
      return NextResponse.json({ error: "이미지 또는 이름이 필요합니다." }, { status: 400 });
    }

    // 키 없으면 데모 모드 — 샘플 순환
    if (!hasApiKey()) {
      const result = DEMOS[demoCursor % DEMOS.length];
      demoCursor++;
      return NextResponse.json({ demo: true, result, usedWeb: false });
    }

    // 웹 검색을 실제로 수행할 때만 캐시를 건너뛴다.
    // (차단된 상태에서 web:true 가 들어오면 캐시를 그대로 쓰는 게 맞다 — 괜한 재분석 비용 방지)
    const willSearchWeb = web === true && deepSearchAllowed();
    const useCache = !fresh && !willSearchWeb;
    let identified = null;
    let identifyUsage = null;

    // ── 1) 이름 요청: 바로 카탈로그 조회
    if (name && useCache) {
      const hit = await lookupCatalog(name, null);
      if (hit) return NextResponse.json({ demo: false, cached: true, ...hit });
    }

    // ── 2) 사진 요청: 저비용 판독으로 제품명을 얻어 카탈로그 조회
    if (image && useCache && identifyEnabled()) {
      try {
        identified = await identifyLabel(image);
        identifyUsage = identified.usage;
        if (identified.readable && identified.name && (identified.confidence ?? 0) >= 70) {
          const hit = await lookupCatalog(identified.name, identified.vintage);
          if (hit) {
            console.log(
              `[analyze] 카탈로그 적중: ${identified.name} (판독 ${identifyUsage.inputTokens}+${identifyUsage.outputTokens} 토큰)`
            );
            return NextResponse.json({
              demo: false,
              cached: true,
              identifyUsage,
              ...hit,
            });
          }
        }
      } catch (err) {
        console.warn("[analyze] 라벨 판독 건너뜀:", err.message); // 판독 실패해도 본 분석으로 진행
      }
    }

    // ── 3) 카탈로그에 없음 → 본 분석
    const { result, usedWeb, webFellBack, webDisabled, usage, model } = await callClaude(
      image ? { image, web } : { name, web }
    );

    console.log(
      `[analyze] ${model} | in ${usage.inputTokens} / out ${usage.outputTokens} | 검색 ${usage.webSearches}회 | API ${usage.apiCalls}콜`
    );

    // 다음 사람부터는 AI 호출 없이 응답되도록 적재
    await saveCatalog(result, { usedWeb, model, source: "scan" });

    return NextResponse.json({
      demo: false,
      cached: false,
      result,
      usedWeb,
      webFellBack,
      webDisabled,
      usage,
      identifyUsage,
    });
  } catch (err) {
    const status = err?.status;
    let message = "분석 중 오류가 발생했습니다.";
    if (status === 401) message = "API 키가 올바르지 않습니다. .env.local 의 ANTHROPIC_API_KEY 를 확인하세요.";
    else if (status === 429) message = "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.";
    else if (status === 529 || status >= 500) message = "Anthropic 서버가 혼잡합니다. 잠시 후 다시 시도하세요.";
    else if (err?.message) message = err.message;
    console.error("[analyze]", err);
    return NextResponse.json({ error: message }, { status: status && status >= 400 ? status : 500 });
  }
}
