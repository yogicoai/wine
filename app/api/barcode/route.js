import { NextResponse } from "next/server";
import { lookupBarcode, normalizeBarcode, isValidBarcode } from "@/lib/barcode";

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
