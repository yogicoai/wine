import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { catalogImagesByName } from "@/lib/catalog";

export const runtime = "nodejs";

// 세션 단건 조회 (히스토리에서 다시 열기)
export async function GET(_request, { params }) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  let session;
  try {
    session = await db.collection("sessions").findOne({ _id: new ObjectId(id) });
  } catch {
    return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  }
  if (!session) return NextResponse.json({ error: "없음" }, { status: 404 });
  // 사진 없이 저장된 기록이면 지금 카탈로그 사진으로 채워 연다
  let thumb = session.thumb;
  if (!thumb && session.result?.name) thumb = (await catalogImagesByName([session.result.name])).get(session.result.name) || null;
  return NextResponse.json({ session: { ...session, thumb, _id: session._id.toString() } });
}

// 세션 삭제
export async function DELETE(_request, { params }) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return NextResponse.json({ deleted: false, noDb: true });
  try {
    await db.collection("sessions").deleteOne({ _id: new ObjectId(id) });
  } catch {
    return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  }
  return NextResponse.json({ deleted: true });
}
