import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { toCellarDoc, buildTasteProfile } from "@/lib/cellar";
import { ownScope, stamp } from "@/lib/appProfile";

export const runtime = "nodejs";

const serialize = (d) => ({ ...d, _id: d._id.toString() });

// 셀러도 앱마다 따로 본다 — 와인 셀러가 맥주 앱의 취향으로 학습되면 안 된다
const MINE = () => ownScope("category");

// 셀러 목록 + 취향 프로필
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ items: [], taste: null, noDb: true });

  const items = await db
    .collection("cellar")
    .find(MINE(), { projection: { result: 0 } }) // 목록에선 전체 결과 스냅샷 제외 (용량)
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
  // 같은 술이라도 다른 앱의 항목과 합치지 않는다
  const existing = await col.findOne({
    name: result.name,
    vintage: result.vintage || null,
    ...MINE(),
  });

  if (existing) {
    const bottles = status === "have" ? (existing.bottles || 0) + 1 : existing.bottles;
    await col.updateOne(
      { _id: existing._id },
      { $set: { status, bottles, updatedAt: new Date() } }
    );
    return NextResponse.json({ saved: true, id: existing._id.toString(), merged: true, bottles });
  }

  const { insertedId } = await col.insertOne({
    ...toCellarDoc(result, { thumb, status }),
    ...stamp(),
  });
  return NextResponse.json({ saved: true, id: insertedId.toString(), merged: false });
}
