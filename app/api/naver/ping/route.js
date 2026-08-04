import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { hasNaverKeys, hasApiHubKeys, searchProductImage } from "@/lib/naver";

export const runtime = "nodejs";

// 지금 어느 발급처로 검색 API를 부르고 있는지 한 번에 본다.
//
// 개발자센터는 2027-06-30 에 문을 닫는다. 그날 갑자기 이미지가 끊기지 않으려면
// 갈아탄 뒤에 "실제로 새 키로 나가고 있는지"를 눈으로 확인할 수 있어야 한다.
// 환경변수는 넣었는데 오타가 나 옛 키로 계속 나가는 경우가 가장 흔하다.
export async function GET() {
  const usingHub = hasApiHubKeys();
  const out = {
    발급처: usingHub ? "NAVER API HUB" : "개발자센터 (2027-06-30 종료 예정)",
    apihub키: hasApiHubKeys() ? "있음" : "없음",
    개발자센터키: env("NAVER_CLIENT_ID") && env("NAVER_CLIENT_SECRET") ? "있음" : "없음",
  };

  if (!hasNaverKeys()) {
    return NextResponse.json({ ...out, 결과: "키가 없어 부를 수 없습니다." }, { status: 400 });
  }

  try {
    const started = Date.now();
    const hit = await searchProductImage("닷사이 45", { display: 30 });
    out.호출 = `성공 (${Date.now() - started}ms)`;
    out.표본 = hit ? hit.title : "조건에 맞는 상품 사진 없음 (호출 자체는 정상)";
  } catch (err) {
    out.호출 = "실패";
    out.오류 = err.message;
  }
  return NextResponse.json(out);
}
