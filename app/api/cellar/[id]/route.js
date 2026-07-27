import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

async function collection() {
  const db = await getDb();
  return db ? db.collection("cellar") : null;
}

function oid(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// 상세 (결과 스냅샷 포함)
export async function GET(_request, { params }) {
  const { id } = await params;
  const col = await collection();
  if (!col) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const _id = oid(id);
  if (!_id) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });

  const item = await col.findOne({ _id });
  if (!item) return NextResponse.json({ error: "없음" }, { status: 404 });
  return NextResponse.json({ item: { ...item, _id: item._id.toString() } });
}

// 수정 — 병 수/상태/목표가, 그리고 테이스팅 노트 추가
export async function PATCH(request, { params }) {
  const { id } = await params;
  const col = await collection();
  if (!col) return NextResponse.json({ saved: false, noDb: true });
  const _id = oid(id);
  if (!_id) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });

  const body = await request.json();
  const set = { updatedAt: new Date() };
  const ops = { $set: set };

  if (typeof body.bottles === "number") set.bottles = Math.max(0, body.bottles);
  if (body.status) set.status = body.status;
  if ("priceTarget" in body) set.priceTarget = body.priceTarget ? Number(body.priceTarget) : null;

  // 테이스팅 노트 — 마신 날짜·별점·느낀 향·메모
  if (body.note) {
    const note = {
      date: body.note.date || new Date().toISOString().slice(0, 10),
      rating: Number(body.note.rating) || null,
      aroma: Array.isArray(body.note.aroma) ? body.note.aroma.slice(0, 8) : [],
      text: (body.note.text || "").slice(0, 1000),
      createdAt: new Date(),
    };
    ops.$push = { notes: note };
    if (note.rating) set.rating = note.rating; // 최신 별점을 대표값으로 (취향 프로필 재료)
    // 마셨으면 재고 1병 차감, 0이 되면 '마신 술'로 이동
    if (body.note.consumed) {
      const cur = await col.findOne({ _id }, { projection: { bottles: 1 } });
      const left = Math.max(0, (cur?.bottles || 0) - 1);
      set.bottles = left;
      if (!left) set.status = "drunk";
    }
  }

  await col.updateOne({ _id }, ops);
  const updated = await col.findOne({ _id }, { projection: { result: 0 } });
  return NextResponse.json({ saved: true, item: { ...updated, _id: updated._id.toString() } });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const col = await collection();
  if (!col) return NextResponse.json({ deleted: false, noDb: true });
  const _id = oid(id);
  if (!_id) return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  await col.deleteOne({ _id });
  return NextResponse.json({ deleted: true });
}
