import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 외부 이미지를 같은 출처로 중계한다.
// 공유 카드는 캔버스로 그리는데, 다른 도메인 이미지는 CORS 때문에 캔버스에 올릴 수 없다.
// 여기를 거치면 우리 도메인에서 내려오므로 그릴 수 있다.
//
// 임의의 주소를 대신 불러 주면 서버가 내부망 스캐너로 악용될 수 있으므로
// 실제로 쓰는 이미지 호스트만 허용한다.
const ALLOWED = [
  /(^|\.)pstatic\.net$/i, // 네이버 상품 이미지
  /(^|\.)naver\.net$/i,
  /(^|\.)cafe24\.com$/i, // 우리 이미지 호스팅
  /(^|\.)cafe24img\.com$/i,
];

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new NextResponse("주소가 없습니다.", { status: 400 });

  let target;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("잘못된 주소입니다.", { status: 400 });
  }

  if (!/^https?:$/.test(target.protocol) || !ALLOWED.some((re) => re.test(target.hostname))) {
    return new NextResponse("허용되지 않은 주소입니다.", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0", Referer: `${target.protocol}//${target.hostname}/` },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) return new NextResponse("가져오지 못했습니다.", { status: 502 });

    const type = upstream.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return new NextResponse("이미지가 아닙니다.", { status: 415 });

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("가져오지 못했습니다.", { status: 502 });
  }
}
