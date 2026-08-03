import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { profileFromAnswers, questionsFor, describe } from "@/lib/taste";
import { DEFAULT_CATEGORY } from "@/lib/appProfile";

export const runtime = "nodejs";

// 취향 문답 답변 보관.
// 로그인이 아직 없어 사용자 구분이 되지 않으므로 기기당 하나로 본다.
// (클라이언트가 보내는 owner 값 = 브라우저에 저장된 임의 식별자)
//
// 답변은 주종별로 따로 둔다 — 네 앱이 DB 하나를 함께 쓰므로,
// 맥주 앱의 답이 와인 앱의 답을 덮어쓰면 안 된다.
const DEFAULT_OWNER = "local";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const owner = params.get("owner") || DEFAULT_OWNER;
  const category = params.get("category") || DEFAULT_CATEGORY;
  const questions = questionsFor(category);

  const db = await getDb();
  if (!db) return NextResponse.json({ questions, answers: null, noDb: true });

  const doc = await db.collection("preferences").findOne({ owner, category });
  const profile = doc?.answers ? profileFromAnswers(doc.answers, category) : null;

  return NextResponse.json({
    questions,
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
  const category = body.category || DEFAULT_CATEGORY;

  // 아는 문항의 O/X만 받는다
  const valid = {};
  for (const q of questionsFor(category)) {
    const pick = body.answers?.[q.id];
    if (pick === "yes" || pick === "no") valid[q.id] = pick;
  }

  await db.collection("preferences").updateOne(
    { owner, category },
    {
      $set: { owner, category, answers: valid, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const profile = profileFromAnswers(valid, category);
  return NextResponse.json({ saved: true, answers: valid, profile, summary: describe(profile) });
}
