import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { saveCatalog, catalogKey } from "@/lib/catalog";
import { resolveWanted } from "@/lib/wanted";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 120;

const DATA_DIR = path.join(process.cwd(), "data");

// data/ 안의 seed-*.json 을 모두 읽어 하나로 합친다 (주종별로 파일을 나눠 관리하기 위함)
async function readSeedFiles() {
  const files = (await readdir(DATA_DIR))
    .filter((f) => f.startsWith("seed-") && f.endsWith(".json"))
    .sort();
  const all = [];
  for (const f of files) {
    const parsed = JSON.parse(await readFile(path.join(DATA_DIR, f), "utf-8"));
    if (Array.isArray(parsed)) all.push(...parsed);
  }
  return all;
}

// 큐레이션 값(가격대·초보자 점수·태그)은 술 정보와 성격이 달라 파일을 나눠 두었다.
// 술 정보는 잘 바뀌지 않지만 큐레이션은 우리 판단이라 자주 손보게 된다.
async function readCuration() {
  try {
    const parsed = JSON.parse(await readFile(path.join(DATA_DIR, "curation.json"), "utf-8"));
    return new Map(parsed.map((c) => [c.name, c]));
  } catch {
    return new Map(); // 없어도 적재는 진행한다
  }
}

// 직접 작성한 카탈로그 데이터를 적재한다 (AI 호출 없음 = 비용 0원)
// POST /api/catalog/import              → data/seed-*.json 을 모두 읽어 적재
// POST /api/catalog/import { items:[…] } → 본문으로 받은 항목을 적재
export async function POST(request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  let items;
  try {
    const body = await request.json().catch(() => ({}));
    items = Array.isArray(body.items) ? body.items : null;
    if (!items) items = await readSeedFiles();
  } catch (err) {
    return NextResponse.json(
      { error: `데이터를 읽지 못했습니다: ${err.message}` },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: "적재할 항목이 없습니다." }, { status: 400 });
  }

  const existing = new Set(
    (await db.collection("catalog").find({}, { projection: { key: 1 } }).toArray()).map((d) => d.key)
  );

  const curation = await readCuration();
  let inserted = 0;
  let updated = 0;
  let curated = 0;
  let skipped = 0; // 이미 분석된 술을 뼈대로 덮어쓰지 않고 넘긴 수
  const failed = [];

  for (const item of items) {
    if (!item?.name || !item?.category) {
      failed.push({ name: item?.name || "(이름 없음)", reason: "name/category 누락" });
      continue;
    }
    // 이미 분석을 마친 술을 뼈대로 덮어쓰면 정보가 사라진다
    if (item.tier === "stub" && existing.has(catalogKey(item.name, item.vintage))) {
      const cur = await db
        .collection("catalog")
        .findOne({ key: catalogKey(item.name, item.vintage) }, { projection: { tier: 1 } });
      if (cur && cur.tier !== "stub") {
        skipped++;
        continue;
      }
    }
    const isNew = !existing.has(catalogKey(item.name, item.vintage));
    const extra = curation.get(item.name);
    if (extra) curated++;
    const ok = await saveCatalog(
      { found: true, ...item, ...(extra || {}) },
      { usedWeb: false, model: null, source: "manual" }
    );
    if (!ok) {
      failed.push({ name: item.name, reason: "저장 실패" });
      continue;
    }
    isNew ? inserted++ : updated++;
  }

  // 이번에 채워 넣은 이름은 "못 찾은 목록"에서 지운다
  const resolved = await resolveWanted(items.map((i) => i?.name).filter(Boolean));

  return NextResponse.json({ total: items.length, inserted, updated, curated, skipped, resolved, failed });
}
