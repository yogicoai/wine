import { NextResponse } from "next/server";
import { buildSeedList } from "@/lib/seedList";
import { saveCatalog, catalogKey, catalogNameIndex } from "@/lib/catalog";
import { findLooseMatch, isSpecificName } from "@/lib/match";
import { resolveWanted } from "@/lib/wanted";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한 — 카테고리를 나눠 여러 번 부른다

// 네이버 인기 상품 수확 — "실제로 팔리는 술"을 뼈대(stub)로 적재한다.
//
// 내가 아는 유명 와인을 넣는 것보다 이쪽이 적중률이 높다. 사람들이 찍는 술은
// 결국 지금 팔리는 술이기 때문이다. 네이버 API는 무료라 비용도 없다.
//
// 기본은 dry-run: 무엇이 새로 들어올지만 보여 준다.
// confirm:true 를 줘야 실제로 적재한다. (쓰레기 이름이 섞일 수 있으므로
// 처음에는 미리보기로 목록을 훑어보는 것이 안전하다)
//
// POST { categories?: ["wine"], perQuery?: 20, confirm?: false }

// 검색어 → 타입 짐작. 확실한 것만 적고 나머지는 비워 둔다.
const QUERY_TYPE = {
  레드와인: "레드 와인",
  화이트와인: "화이트 와인",
  로제와인: "로제 와인",
  샴페인: "스파클링 와인 · 샴페인",
  "스파클링 와인": "스파클링 와인",
  프로세코: "스파클링 와인 · 프로세코",
  "카바 와인": "스파클링 와인 · 카바",
  포트와인: "디저트 와인 · 포트",
  아이스와인: "디저트 와인 · 아이스와인",
  "디저트 와인": "디저트 와인",
  "보르도 와인": "레드 와인",
  "카베르네 소비뇽 와인": "레드 와인 · 카베르네 소비뇽",
  "피노누아 와인": "레드 와인 · 피노 누아",
  "메를로 와인": "레드 와인 · 메를로",
  "쉬라즈 와인": "레드 와인 · 쉬라즈",
  "말벡 와인": "레드 와인 · 말벡",
  "진판델 와인": "레드 와인 · 진판델",
  "샤르도네 와인": "화이트 와인 · 샤르도네",
  "소비뇽블랑 와인": "화이트 와인 · 소비뇽 블랑",
  "리슬링 와인": "화이트 와인 · 리슬링",
  "모스카토 와인": "화이트 와인 · 모스카토",
  "부르고뉴 와인": null, // 레드·화이트가 섞여 있어 단정할 수 없다
};

// 판매가 → 가격대. 큐레이션과 같은 구간을 쓴다.
function bandFromPrice(price) {
  if (!price) return null;
  if (price < 20000) return 1;
  if (price < 50000) return 2;
  if (price < 100000) return 3;
  if (price < 300000) return 4;
  return 5;
}

export async function POST(request) {
  // 대량 쓰기라 아무나 부르면 곤란하다
  const secret = env("CRON_SECRET");
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const { categories = ["wine"], perQuery = 20, pages = 1, confirm = false } = await request
    .json()
    .catch(() => ({}));

  const collected = await buildSeedList({ categories, perQuery, pages });
  if (!collected) return NextResponse.json({ error: "네이버 API 키 필요" }, { status: 400 });

  // 이미 있는 것은 거른다 — 정확 키뿐 아니라 느슨한 매칭으로도.
  // "몬테스 알파 카베르네 소비뇽 기프트"를 이미 있는 몬테스 알파 옆에 또 넣으면 안 된다.
  const index = await catalogNameIndex();
  const existingKeys = new Set(index.map((d) => catalogKey(d.name, d.vintage)));

  const fresh = [];
  for (const item of collected) {
    // 산지·품종뿐인 이름("보르도", "부르고뉴 와인")은 어느 술인지 알 수 없다
    if (!isSpecificName(item.name)) continue;
    if (existingKeys.has(catalogKey(item.name, null))) continue;
    if (findLooseMatch(item.name, index)) continue;
    // 이번 수확 안에서의 중복도 같은 기준으로 거른다
    if (findLooseMatch(item.name, fresh)) continue;
    fresh.push({ ...item, tokens: undefined });
  }

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      collected: collected.length,
      new: fresh.length,
      preview: fresh.map((f) => ({ name: f.name, category: f.category, price: f.price || null })),
      note: "confirm:true 를 주면 위 목록이 stub 으로 적재됩니다.",
    });
  }

  let inserted = 0;
  const failed = [];
  for (const item of fresh) {
    const ok = await saveCatalog(
      {
        found: true,
        tier: "stub",
        name: item.name,
        category: item.category,
        type: QUERY_TYPE[item.query] ?? null,
        priceBand: bandFromPrice(item.price),
        image: item.image || null,
      },
      { usedWeb: false, model: null, source: "harvest" }
    );
    ok ? inserted++ : failed.push(item.name);
  }

  // 수확으로 채워진 이름은 "못 찾은 목록"에서 지운다
  const resolved = await resolveWanted(fresh.map((f) => f.name));

  return NextResponse.json({ collected: collected.length, inserted, resolved, failed });
}
