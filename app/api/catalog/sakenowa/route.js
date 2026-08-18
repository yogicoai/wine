import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { fetchSakenowa, buildIndex, matchBrand, sakenowaFor } from "@/lib/sakenowa";
import { koTags } from "@/lib/sakeTags";

export const runtime = "nodejs";
export const maxDuration = 120;

// 사케에 일본 현지 맛 좌표와 인기 순위를 붙인다 (출처: さけのわ).
//
// 저쪽 자료는 달마다 바뀌므로 이따금 다시 돌린다. 무료이고 열쇠도 없다.
//   GET  ?dryRun=1   무엇이 붙을지만 본다
//   POST             실제로 적용
//
// 느슨하게 맞추면 엉뚱한 술의 맛이 붙는다. 그래서 양조장과 브랜드가 둘 다
// 우리 글에 있을 때만 확정한다 (lib/sakenowa.js 에 왜 그런지 적어 두었다).
async function run({ dryRun }) {
  const db = await getDb();
  if (!db) return { error: "DB 미설정" };

  const data = await fetchSakenowa();
  const idx = buildIndex(data);
  const col = db.collection("catalog");

  const ours = await col
    .find({ category: "sake" }, { projection: { name: 1, searchKeyword: 1, producer: 1, result: 1 } })
    .toArray();

  const matched = [];
  const missed = [];
  for (const o of ours) {
    // 원어가 어디에 적혀 있을지 모르므로 이름·검색어·생산자를 모두 이어 본다
    const text = [o.name, o.searchKeyword, o.result?.searchKeyword, o.producer, o.result?.producer]
      .filter(Boolean)
      .join(" ");
    const info = sakenowaFor(matchBrand(text, idx), idx);
    if (!info) {
      missed.push(o.name);
      continue;
    }
    // 태그는 담을 때 우리말로 바꿔 둔다 — 화면마다 옮기면 같은 일을 여러 번 한다
    const row = { ...info, tags: koTags(info.tags) };
    matched.push({ name: o.name, brand: row.brand, brewery: row.brewery, rank: row.rank, tags: row.tags });
    if (!dryRun) {
      await col.updateOne({ _id: o._id }, { $set: { sakenowa: { ...row, at: new Date() } } });
    }
  }

  return {
    dryRun: !!dryRun,
    총: ours.length,
    붙음: matched.length,
    못붙음: missed.length,
    랭킹권: matched.filter((m) => m.rank).length,
    matched,
    missed: missed.slice(0, 20),
  };
}

export async function GET(request) {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  return NextResponse.json(await run({ dryRun }));
}

export async function POST() {
  return NextResponse.json(await run({ dryRun: false }));
}
