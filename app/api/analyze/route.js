import { NextResponse } from "next/server";
import { callClaude, hasApiKey, deepSearchAllowed } from "@/lib/claude";
import { lookupCatalog, saveCatalog, catalogNameIndex } from "@/lib/catalog";
import { findLooseMatch } from "@/lib/match";
import { identifyEnabled, identifyLabel } from "@/lib/identify";
import { linkBarcode, normalizeBarcode, isValidBarcode } from "@/lib/barcode";
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
    // barcode: 바코드로는 못 찾아 라벨을 찍은 경우 — 분석 후 그 번호를 연결해 둔다
    const { image, name, web, fresh, barcode } = await request.json();
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
          let hit = await lookupCatalog(identified.name, identified.vintage);

          // 판독된 표기가 DB 표기와 조금 다를 때 — 토큰 겹침으로 한 번 더 찾는다.
          // (결과 화면을 채워야 하므로 뼈대(stub)는 제외)
          if (!hit) {
            const index = (await catalogNameIndex()).filter((d) => d.tier !== "stub");
            const loose = findLooseMatch(identified.name, index);
            if (loose) hit = await lookupCatalog(loose.candidate.name, loose.candidate.vintage);
          }

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

    // 이름으로 물었는데 AI가 못 알아본 경우 — 그래도 우리가 아는 것은 있다.
    //
    // 검색 결과에는 수확으로 들어온 뼈대도 섞여 나온다. 뼈대는 이름·주종·가격대·
    // 사진까지 있지만 스토리가 없어 분석 대상에서 빠지고, 그래서 AI에게 다시 묻게
    // 된다. 그런데 "준마이 북극곰의 눈물"처럼 판매처가 붙인 별명은 AI도 알 수 없다.
    // 이때 빈손으로 돌려보내면 "라벨을 읽지 못했습니다"가 뜬다 — 사진을 찍은 적도
    // 없는 사람에게 촬영 요령을 일러 주는 셈이다.
    //
    // 아는 만큼이라도 보여 준다. 실제로 팔리고 있는 술이고, 이름과 값은 사실이다.
    if (name && result?.found === false) {
      const stub = await lookupCatalog(name, null, { allowStub: true });
      if (stub) {
        return NextResponse.json({
          demo: false,
          cached: true,
          partial: true, // 스토리는 아직 없다는 표시 — 화면이 이걸 보고 안내를 바꾼다
          identifyUsage,
          ...stub,
        });
      }
    }

    // 다음 사람부터는 AI 호출 없이 응답되도록 적재
    await saveCatalog(result, { usedWeb, model, source: "scan" });

    // 바코드를 읽고 온 요청이면 번호를 연결해 둔다 (같은 병은 다음부터 무료·즉시)
    if (barcode) {
      const code = normalizeBarcode(barcode);
      if (code && isValidBarcode(code)) await linkBarcode(code, result);
    }

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
    // 앨범에서 아무 사진이나 고를 수 있게 되면서, 분석기가 거절하는 사진도 들어온다.
    // 이때 "오류"라고만 하면 사용자는 앱이 고장 난 줄 알고 같은 사진을 계속 올린다.
    // 사진 문제임을 분명히 알려 다른 사진을 고르게 한다.
    if (status === 400 && /image|이미지|invalid|unsupported/i.test(err?.message || "")) {
      return NextResponse.json(
        { error: "이 사진은 분석할 수 없습니다. 술병 라벨이 잘 보이는 사진으로 다시 시도해 주세요." },
        { status: 400 }
      );
    }
    if (status === 401) message = "API 키가 올바르지 않습니다. .env.local 의 ANTHROPIC_API_KEY 를 확인하세요.";
    else if (status === 429) message = "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.";
    else if (status === 529 || status >= 500) message = "Anthropic 서버가 혼잡합니다. 잠시 후 다시 시도하세요.";
    else if (err?.message) message = err.message;
    console.error("[analyze]", err);
    return NextResponse.json({ error: message }, { status: status && status >= 400 ? status : 500 });
  }
}
