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
// ── 자동으로 돌지 않는다. 반드시 미리보기로 눈으로 보고 적용한다 ──────
// 사진은 원래 네이버 쇼핑 검색 API에서 왔는데 그 API가 2026-07-31 에 내려갔다.
// 지금은 이미지 검색으로 대신하되, 받는 호스트를 네이버쇼핑 상품 사진으로 한정한다.
//
// 쇼핑 API는 상품 카테고리(주류)를 함께 줘서 술 아닌 것을 잘라 냈는데
// 이미지 검색에는 그 칸이 없다. 그래서 이름만으로 가려야 하고, 그것만으로는
// 부족하다. 실측한 정확도는 이렇다.
//
//   처음        60건 검사 → 5건 붙고 그중 2건만 맞음
//   규칙 보강 후 968건 검사 → 83건 붙고 그중 71건 맞음 (오답 12건)
//
// 보강한 규칙은 lib/naver.js 의 imageTitleMatches 에 있다. 앞머리(생산자) 일치,
// 무알콜·등급 같은 배타 표시, " : 판매자명" 이 붙은 개별 판매 목록 제외.
//
// 그래도 12건이 남았다. 남은 오답은 모두 "같은 집의 다른 술"이다 —
//   토마시 발폴리첼라 클라시코 → 토마시 아마로네 (값이 서너 배)
//   뵈브 클리코 라 그랑 담     → 뵈브 클리코 옐로우 라벨
//   산 마르짜노 탈로           → 산 마르짜노 빈도로
// 이름만 보고는 가릴 수 없는 종류라 규칙을 더 죄면 맞는 것까지 떨어진다.
//
// 그래서 이 라우트는 experimental: true 를 요구하고, 사람이 dryRun 목록을
// 눈으로 확인한 뒤 적용하는 절차를 전제로 한다.
// 사진이 없는 것보다 엉뚱한 사진이 붙는 편이 나쁘다.
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
    // 미리보기는 DB를 건드리지 않으므로 같은 항목이 계속 나온다. 전수를 훑으려면
    // 건너뛸 개수를 직접 넘겨야 한다.
    skip = 0,
  } = await request.json().catch(() => ({}));

  if (!experimental) {
    return NextResponse.json(
      {
        error: "이미지 자동 연결이 꺼져 있습니다.",
        reason:
          "네이버 쇼핑 검색 API가 내려가 상품 카테고리를 알 수 없습니다. 이름만으로 고른 사진은 968건 중 83건이 붙고 그중 12건이 다른 술이었습니다.",
        hint: "experimental: true, dryRun: true 로 목록을 받아 눈으로 확인한 뒤 적용하세요.",
      },
      { status: 409 }
    );
  }

  const filter = force ? {} : { image: { $in: [null, undefined] } };
  const targets = await db
    .collection("catalog")
    .find(filter, { projection: { name: 1, searchKeyword: 1 } })
    .sort({ _id: 1 })
    .skip(Math.max(0, Number(skip) || 0))
    .limit(limit)
    .toArray();

  let filled = 0;
  const missing = [];
  const matched = [];

  // 이름을 잘라 다시 찾지 않는다.
  //
  // 예전에는 못 찾으면 앞 3단어, 앞 2단어로 범위를 넓혀 갔다. 판매처 검색에는
  // 그것이 맞았지만 사진 고르기에는 독이다. "라 크레마 소노마 코스트 샤르도네"가
  // "라 크레마"로 줄면 화장품 "쿠지 라크레마 리퀴드 파운데이션"에 걸린다.
  // 짧은 이름은 남의 이름 안에 우연히 들어가기 쉽다.
  //
  // 사진은 한 번 붙으면 화면에 그대로 나간다. 못 찾는 것보다 엉뚱한 것이 나쁘다.
  function queryCandidates(doc) {
    const clean = (v) =>
      String(v || "")
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    // 이름과 검색어 둘 다 온전한 형태로만 시도한다
    return [...new Set([clean(doc.name), clean(doc.searchKeyword)])].filter((q) => q.length >= 4);
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
