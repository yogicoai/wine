import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { dailyshotFor, refreshItems } from "@/lib/dailyshot";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 값 갱신 — Vercel Cron이 매일 새벽에 부른다. 특가 점검(01:00)보다 먼저 돌려
// 그날의 판단이 어제 값이 아니라 오늘 값 위에서 이뤄지게 한다.
//
// 전량(24,776건)은 158분이 걸려 여기 담을 수 없고, 담을 필요도 없다.
// 사람이 지켜보고 있는 술만 새로 받으면 된다 — 알림이 걸린 자리가 거기뿐이다.
// 나머지는 화면에 값을 보여 주는 용도라, 전량 수집을 이따금 돌리는 것으로 족하다.
// (scripts/dailyshot-index.mjs --refresh)
//
// 보안: 아무나 호출해 남의 서버를 두드리게 하지 않는다.
async function run(request) {
  const secret = env("CRON_SECRET");
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "권한 없음" }, { status: 401 });
    }
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ skipped: "noDb" });

  // 셀러·위시리스트에 담긴 술.
  //
  // 앱 범위로 거르지 않는다. 크론은 배포마다 한 번씩 도는데 여섯 앱이 DB 하나를
  // 함께 쓰므로, 여기서 앱을 가르면 같은 술을 여섯 번 받게 된다. 값은 앱과
  // 상관없이 같은 값이다.
  const watched = await db
    .collection("cellar")
    .find(
      { status: { $in: ["have", "wish"] } },
      { projection: { name: 1, searchKeyword: 1, category: 1, dsId: 1, dsItemId: 1 } }
    )
    .limit(400)
    .toArray();

  // 담을 때 상품 번호를 적어 두지 않았을 수 있다. 그때는 색인에서 다시 찾는다 —
  // DB 조회라 값이 들지 않는다. 찾은 번호는 적어 두어 다음부터 건너뛴다.
  const rows = [];
  const learned = [];
  for (const doc of watched) {
    if (doc.dsItemId) {
      rows.push({ id: doc.dsId, itemId: doc.dsItemId });
      continue;
    }
    const hit = await dailyshotFor(doc.searchKeyword || doc.name, { category: doc.category });
    if (hit?.itemId) {
      rows.push({ id: hit.id, itemId: hit.itemId });
      learned.push({ _id: doc._id, dsId: hit.id, dsItemId: hit.itemId });
    }
  }

  if (learned.length) {
    await db.collection("cellar").bulkWrite(
      learned.map((l) => ({
        updateOne: { filter: { _id: l._id }, update: { $set: { dsId: l.dsId, dsItemId: l.dsItemId } } },
      })),
      { ordered: false }
    );
  }

  const { updated, failed } = await refreshItems(rows);
  return NextResponse.json({ watched: watched.length, matched: rows.length, updated, failed });
}

export async function GET(request) {
  return run(request);
}

// 수동 실행·테스트용
export async function POST(request) {
  return run(request);
}
