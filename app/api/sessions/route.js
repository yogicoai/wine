import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

const MAX_SESSIONS = 40; // 최근 40개만 유지 (원본 wl_sessions 규약)

// 최근 세션 목록
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ sessions: [], noDb: true });
  const sessions = await db
    .collection("sessions")
    .find({}, { projection: { "result.history": 0, "result.story": 0 } })
    .sort({ createdAt: -1 })
    .limit(MAX_SESSIONS)
    .toArray();
  return NextResponse.json({
    sessions: sessions.map((s) => ({ ...s, _id: s._id.toString() })),
  });
}

// 세션 저장
export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ saved: false, noDb: true });
  const { result, thumb, demo } = await request.json();
  const doc = { result, thumb: thumb || null, demo: !!demo, createdAt: new Date() };
  const { insertedId } = await db.collection("sessions").insertOne(doc);

  // 상한 초과분 정리
  const excess = await db
    .collection("sessions")
    .find({}, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS)
    .toArray();
  if (excess.length) {
    await db.collection("sessions").deleteMany({ _id: { $in: excess.map((d) => d._id) } });
  }

  return NextResponse.json({ saved: true, id: insertedId.toString() });
}
