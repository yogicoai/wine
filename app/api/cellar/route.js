import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { toCellarDoc, buildTasteProfile } from "@/lib/cellar";

export const runtime = "nodejs";

const serialize = (d) => ({ ...d, _id: d._id.toString() });

// 셀러 목록 + 취향 프로필
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ items: [], taste: null, noDb: true });

  const items = await db
    .collection("cellar")
    .find({}, { projection: { result: 0 } }) // 목록에선 전체 결과 스냅샷 제외 (용량)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    items: items.map(serialize),
    taste: buildTasteProfile(items),
  });
}

// 셀러에 담기 (같은 술이면 병 수만 증가)
export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ saved: false, noDb: true });

  const { result, thumb, status = "have" } = await request.json();
  if (!result?.name) {
    return NextResponse.json({ error: "분석 결과가 필요합니다." }, { status: 400 });
  }

  const col = db.collection("cellar");
  const existing = await col.findOne({ name: result.name, vintage: result.vintage || null });

  if (existing) {
    const bottles = status === "have" ? (existing.bottles || 0) + 1 : existing.bottles;
    await col.updateOne(
      { _id: existing._id },
      { $set: { status, bottles, updatedAt: new Date() } }
    );
    return NextResponse.json({ saved: true, id: existing._id.toString(), merged: true, bottles });
  }

  const { insertedId } = await col.insertOne(toCellarDoc(result, { thumb, status }));
  return NextResponse.json({ saved: true, id: insertedId.toString(), merged: false });
}
