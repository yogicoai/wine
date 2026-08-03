import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { searchProductImage, hasNaverKeys } from "@/lib/naver";

export const runtime = "nodejs";
export const maxDuration = 60;

// 카탈로그 항목에 상품 이미지를 채운다.
//
// 저작권 관점: 라벨 디자인은 제작사의 저작물이므로 이미지를 내려받아 우리 서버에
// 재배포하지 않는다. 대신 판매처가 제공하는 이미지 "주소"만 저장해 연결한다.
// (검색 결과를 노출하는 통상적인 방식이며, 원본은 판매처 서버에 그대로 있다)
//
// ── 지금은 자동으로 돌지 않는다 ──────────────────────────────────
// 사진은 네이버 쇼핑 검색 API에서 왔는데 그 API가 내려갔다. 대신 이미지 검색을
// 써 봤고, 결과는 쓸 수 없었다. 실측한 숫자는 이렇다.
//
//   병 표시(용량·도수)까지 요구했을 때  60건 중 5건만 붙고, 그 5건 중 맞는 것은 2건
//   틀린 예: 라 크레마 소노마 코스트 샤르도네 → 화장품 파운데이션 35ml
//            조쉬 셀러스 카베르네 소비뇽    → 같은 생산자의 샤르도네
//            루이 라투르 부르고뉴          → 피아노 벤치 커버
//
// 원인은 분명하다. 쇼핑 API는 상품 카테고리(주류)를 함께 줘서 술이 아닌 것을
// 잘라 냈는데, 이미지 검색에는 그 칸이 없다. 이름만으로는 와인과 그 와인
// 이름을 단 냉장고 자석을 가릴 수 없다.
//
// 사진이 없는 것보다 엉뚱한 사진이 붙는 편이 나쁘므로 기본값은 꺼 둔다.
// 다시 시도하려면 experimental: true 를 주고, 반드시 dryRun 으로 먼저 본다.
// ────────────────────────────────────────────────────────────
export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  if (!hasNaverKeys()) return NextResponse.json({ error: "네이버 API 키 필요" }, { status: 400 });

  // dryRun 이면 무엇이 붙을지만 돌려주고 DB는 건드리지 않는다.
  // 사진은 한 번 붙으면 화면에 그대로 나가므로, 엉뚱한 술 사진이 섞였는지
  // 먼저 눈으로 보고 적용한다.
  const {
    limit = 30,
    force = false,
    dryRun = false,
    experimental = false,
  } = await request.json().catch(() => ({}));

  if (!experimental) {
    return NextResponse.json(
      {
        error: "이미지 자동 연결이 꺼져 있습니다.",
        reason:
          "네이버 쇼핑 검색 API가 내려가 상품 카테고리를 알 수 없습니다. 이미지 검색만으로는 60건 중 5건이 붙고 그중 2건만 맞았습니다.",
        hint: "다시 시도하려면 experimental: true, dryRun: true 로 먼저 확인하세요.",
      },
      { status: 409 }
    );
  }

  const filter = force ? {} : { image: { $in: [null, undefined] } };
  const targets = await db
    .collection("catalog")
    .find(filter, { projection: { name: 1, searchKeyword: 1 } })
    .limit(limit)
    .toArray();

  let filled = 0;
  const missing = [];
  const matched = [];

  // 판매처 표기가 우리 이름과 달라 못 찾는 경우가 많다 (예: 까베르네/카베르네).
  // 전체 이름 → 앞 3단어 → 앞 2단어 순으로 범위를 넓혀 가며 시도한다.
  function queryCandidates(doc) {
    const base = (doc.searchKeyword || doc.name || "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const words = base.split(" ");
    return [...new Set([base, words.slice(0, 3).join(" "), words.slice(0, 2).join(" ")])].filter(
      (q) => q.length >= 2
    );
  }

  // 사진은 이제 쇼핑이 아니라 이미지 검색에서 온다. 네이버가 쇼핑 검색 API를
  // 내렸기 때문이다. 다만 받는 호스트를 네이버쇼핑 상품 사진으로 한정해,
  // 예전 쇼핑 API가 주던 것과 같은 성격의 사진만 들어온다.
  //
  // 네이버 API는 무료지만 몰아서 호출하면 일시적으로 빈 응답이 오므로
  // 간격을 두어 순차 처리한다
  for (const doc of targets) {
    try {
      let withImage = null;
      for (const q of queryCandidates(doc)) {
        await new Promise((r) => setTimeout(r, 150));
        const hit = await searchProductImage(q);
        if (hit) {
          withImage = { image: hit.image, mall: "네이버쇼핑", title: hit.title };
          break;
        }
      }
      if (!withImage) {
        missing.push(doc.name);
        if (!dryRun) {
          await db.collection("catalog").updateOne(
            { _id: doc._id },
            { $set: { imageCheckedAt: new Date() } }
          );
        }
        continue;
      }
      matched.push({ name: doc.name, title: withImage.title, image: withImage.image });
      if (!dryRun) {
        await db.collection("catalog").updateOne(
          { _id: doc._id },
          {
            $set: {
              image: withImage.image, // 판매처 이미지 주소만 보관 (재배포 아님)
              imageSource: withImage.mall,
              imageCheckedAt: new Date(),
            },
          }
        );
      }
      filled++;
    } catch {
      missing.push(doc.name);
    }
  }

  return NextResponse.json({ dryRun, checked: targets.length, filled, matched, missing });
}

// 이미지 보유 현황
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });
  const col = db.collection("catalog");
  const [total, withImage] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ image: { $exists: true, $ne: null } }),
  ]);
  return NextResponse.json({ total, withImage, without: total - withImage });
}
