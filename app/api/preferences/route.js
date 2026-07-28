import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { profileFromAnswers, QUESTIONS, describe } from "@/lib/taste";

export const runtime = "nodejs";

// 취향 문답 답변 보관.
// 로그인이 아직 없어 사용자 구분이 되지 않으므로 기기당 하나로 본다.
// (클라이언트가 보내는 owner 값 = 브라우저에 저장된 임의 식별자)
const DEFAULT_OWNER = "local";

export async function GET(request) {
  const owner = new URL(request.url).searchParams.get("owner") || DEFAULT_OWNER;
  const db = await getDb();
  if (!db) return NextResponse.json({ questions: QUESTIONS, answers: null, noDb: true });

  const doc = await db.collection("preferences").findOne({ owner });
  const profile = doc?.answers ? profileFromAnswers(doc.answers) : null;

  return NextResponse.json({
    questions: QUESTIONS,
    answers: doc?.answers || null,
    profile,
    summary: describe(profile),
  });
}

export async function PUT(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ saved: false, noDb: true });

  const body = await request.json().catch(() => ({}));
  const owner = body.owner || DEFAULT_OWNER;

  // 아는 문항의 O/X만 받는다
  const valid = {};
  for (const q of QUESTIONS) {
    const pick = body.answers?.[q.id];
    if (pick === "yes" || pick === "no") valid[q.id] = pick;
  }

  await db.collection("preferences").updateOne(
    { owner },
    { $set: { owner, answers: valid, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  const profile = profileFromAnswers(valid);
  return NextResponse.json({ saved: true, answers: valid, profile, summary: describe(profile) });
}
