import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { catalogKey } from "@/lib/catalog";

export const runtime = "nodejs";

// 추천 목록 중 "이미 카탈로그에 있는 것"만 골라준다.
// 카탈로그에 없는 술을 누르면 새로 분석되어 비용이 발생하므로, 있는 것만 눌리게 하기 위함.
//
// GET /api/catalog/similar?names=A|B|C&category=wine&exclude=현재술이름
//   → { matched: [...],  fromCatalog: [...] }
//     matched     : AI가 추천한 이름 중 카탈로그에 있는 것
//     fromCatalog : 부족한 만큼 같은 주종에서 채운 추천 (역시 카탈로그 보유분)
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const names = (params.get("names") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const category = params.get("category");
  const exclude = params.get("exclude") || "";
  const want = Number(params.get("limit")) || 4;

  const db = await getDb();
  if (!db) return NextResponse.json({ matched: [], fromCatalog: [] });

  const col = db.collection("catalog");
  const excludeKey = catalogKey(exclude, null);
  const projection = { name: 1, category: 1, producer: 1, vintage: 1, key: 1 };

  // 1) 추천 이름이 카탈로그에 있는지 (빈티지 무시하고 이름 키로 대조)
  const keys = names.map((n) => catalogKey(n, null));
  const found = keys.length
    ? await col.find({ key: { $in: keys } }, { projection }).toArray()
    : [];
  const matched = found
    .filter((d) => d.key !== excludeKey)
    .map((d) => ({ name: d.name, category: d.category, producer: d.producer }));

  // 2) 모자라면 같은 주종에서 채운다 (많이 조회된 것 우선)
  let fromCatalog = [];
  const shortfall = want - matched.length;
  if (shortfall > 0 && category) {
    const seen = new Set([excludeKey, ...matched.map((m) => catalogKey(m.name, null))]);
    const extra = await col
      .find({ category, key: { $nin: [...seen] } }, { projection })
      .sort({ hits: -1, updatedAt: -1 })
      .limit(shortfall)
      .toArray();
    fromCatalog = extra.map((d) => ({ name: d.name, category: d.category, producer: d.producer }));
  }

  return NextResponse.json({ matched, fromCatalog });
}
