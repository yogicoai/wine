import { NextResponse } from "next/server";
import { lookupBarcode, linkBarcode, normalizeBarcode, isValidBarcode } from "@/lib/barcode";
import { lookupCatalog } from "@/lib/catalog";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// 바코드 조회 — AI를 부르지 않으므로 항상 무료다.
// 찾지 못하면 found:false 를 돌려주고, 화면에서 라벨 촬영으로 넘어간다.
export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("code");
  const code = normalizeBarcode(raw);

  if (!code || !isValidBarcode(code)) {
    return NextResponse.json({ found: false, reason: "invalid" });
  }

  const hit = await lookupBarcode(code);
  if (!hit) return NextResponse.json({ found: false, code, reason: "unknown" });

  return NextResponse.json({
    found: true,
    code,
    via: hit.via,
    cached: true,
    source: hit.source,
    image: hit.image || null,
    result: hit.result,
    cost: 0,
  });
}

// 바코드를 카탈로그 항목에 직접 연결한다.
//
// 평소에는 라벨을 찍으면 자동으로 연결되지만, 손으로 이어 두어야 할 때가 있다.
// (이미 아는 제품의 바코드를 미리 넣어 두거나, 잘못 연결된 것을 바로잡을 때)
//
// 카탈로그를 함께 쓰는 데이터라 아무나 고치면 곤란하다.
// CRON_SECRET 이 설정된 환경에서는 그 값을 요구한다.
export async function POST(request) {
  const secret = env("CRON_SECRET");
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const { code: raw, name, vintage = null } = await request.json().catch(() => ({}));
  const code = normalizeBarcode(raw);

  if (!code || !isValidBarcode(code)) {
    return NextResponse.json({ error: "바코드가 올바르지 않습니다." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name 이 필요합니다." }, { status: 400 });

  // 카탈로그에 없는 이름에 붙이면 조회해도 아무것도 나오지 않는다
  const hit = (await lookupCatalog(name, vintage)) || (vintage ? await lookupCatalog(name, null) : null);
  if (!hit) {
    return NextResponse.json({ error: `카탈로그에 "${name}" 이 없습니다.` }, { status: 404 });
  }

  await linkBarcode(code, hit.result);
  return NextResponse.json({ linked: true, code, name: hit.result.name });
}
