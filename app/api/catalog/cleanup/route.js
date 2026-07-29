import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { isNotDrink, notDrinkReason } from "@/lib/notDrink";
import { recategorize } from "@/lib/recategorize";
import { clearNameIndexCache } from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

// 수확 필터가 생기기 전에 들어온 술 아닌 상품(잔·오프너·식초 등)을 걷어낸다.
// GET  /api/catalog/cleanup → 지울 목록만 보여 준다 (지우지 않음)
// POST /api/catalog/cleanup { confirm: true } → 실제로 지운다
async function findJunk(db) {
  const rows = await db
    .collection("catalog")
    .find({}, { projection: { _id: 1, name: 1, category: 1, tier: 1 } })
    .toArray();
  return rows.filter((d) => isNotDrink(d.name));
}

// 수확은 검색어로 주종을 정한다. "와인" 검색에 딸려 온 막걸리가 wine 으로 앉아
// 와인 추천에 섞여 나오므로, 이름에 분명한 신호가 있으면 바로잡는다.
async function findMiscategorized(db) {
  const rows = await db
    .collection("catalog")
    .find({ tier: "stub" }, { projection: { _id: 1, name: 1, category: 1 } })
    .toArray();
  return rows
    .map((d) => ({ ...d, to: recategorize(d.name) }))
    .filter((d) => d.to && d.to !== d.category);
}

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const [junk, wrongCat] = await Promise.all([findJunk(db), findMiscategorized(db)]);
  // 분석을 마친 항목이 걸렸다면 규칙이 과한 것이다. 지우기 전에 눈으로 확인해야 한다.
  const full = junk.filter((d) => d.tier !== "stub");

  return NextResponse.json({
    junk: {
      total: junk.length,
      full: full.length,
      warning: full.length ? "정식 분석 항목이 걸렸습니다. 규칙을 확인하세요." : null,
      items: junk.slice(0, 400).map((d) => ({
        name: d.name,
        category: d.category,
        tier: d.tier || "full",
        reason: notDrinkReason(d.name),
      })),
    },
    recategorize: {
      total: wrongCat.length,
      items: wrongCat.slice(0, 200).map((d) => ({ name: d.name, from: d.category, to: d.to })),
    },
    note: "POST { confirm: true } 로 삭제·주종 교정을 함께 실행합니다.",
  });
}

export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  if (!body.confirm) {
    return NextResponse.json({ error: "confirm:true 가 필요합니다." }, { status: 400 });
  }

  const col = db.collection("catalog");
  const junk = await findJunk(db);
  // 정식 분석은 사람이 쓴 것이라 규칙만 믿고 지우지 않는다
  const targets = junk.filter((d) => d.tier === "stub");
  const kept = junk.length - targets.length;

  let deleted = 0;
  if (targets.length) {
    ({ deletedCount: deleted } = await col.deleteMany({ _id: { $in: targets.map((d) => d._id) } }));
  }

  // 주종 교정 — 지우고 난 뒤에 남은 것만 대상으로 한다
  const wrongCat = await findMiscategorized(db);
  const moved = {};
  for (const d of wrongCat) {
    await col.updateOne({ _id: d._id }, { $set: { category: d.to } });
    moved[`${d.category}→${d.to}`] = (moved[`${d.category}→${d.to}`] || 0) + 1;
  }

  clearNameIndexCache(); // 이름 색인 캐시가 지운 항목을 계속 들고 있지 않게

  return NextResponse.json({
    deleted,
    kept,
    keptNote: kept ? "정식 분석 항목은 남겼습니다. 직접 확인하세요." : null,
    recategorized: wrongCat.length,
    moved,
  });
}
