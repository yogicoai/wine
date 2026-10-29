import { NextResponse } from "next/server";
import { browse, homeData, SORTS } from "@/lib/browse";
import { PRICE_BANDS } from "@/lib/curation";

export const runtime = "nodejs";

// 둘러보기 — 홈(?home=1)과 목록 탭(종류 · 가격대 · 처음이라면 · 정렬). 읽기만 한다(lib/browse.js).
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  try {
    if (sp.get("home") === "1") return NextResponse.json(await homeData());
    const band = PRICE_BANDS.some((b) => b.band === Number(sp.get("band"))) ? Number(sp.get("band")) : null;
    const sort = Object.hasOwn(SORTS, sp.get("sort")) ? sp.get("sort") : "popular";
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 30, 1), 600);
    const kind = (sp.get("kind") || "").slice(0, 20) || null;
    return NextResponse.json(await browse({ kind, band, easy: sp.get("easy") === "1", sort, limit }));
  } catch (err) {
    console.error("[browse]", err.message);
    return NextResponse.json({ total: 0, items: [], error: true }, { status: 503 });
  }
}
