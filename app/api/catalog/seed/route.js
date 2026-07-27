import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/mongodb";
import { catalogKey, saveCatalog } from "@/lib/catalog";
import { buildSeedList } from "@/lib/seedList";
import { SYSTEM_PROMPT, userPromptByName } from "@/lib/prompts";
import { parseJson } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 상한. 배치 생성 자체는 수 초면 끝난다.

// 배치 API는 일반 요청의 50% 가격 — 선적재처럼 급하지 않은 대량 작업에 적합
const BATCH_DISCOUNT = 0.5;
const IN_RATE = 3.0; // USD / 1M tokens (Sonnet 5)
const OUT_RATE = 15.0;
const EST_IN = 2500; // 이름 기반 분석 1건 평균 입력 토큰 (실측 기반)
const EST_OUT = 2400; // 평균 출력 토큰
const FX = 1450;

function estimate(count) {
  const usd = ((EST_IN / 1e6) * IN_RATE + (EST_OUT / 1e6) * OUT_RATE) * BATCH_DISCOUNT * count;
  return { usd: Number(usd.toFixed(2)), krw: Math.round(usd * FX), perItemKrw: Math.round((usd / (count || 1)) * FX) };
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * POST /api/catalog/seed
 * body: { names?, categories?, perQuery?, limit?, confirm? }
 *
 * confirm 없이는 견적만 반환한다 (비용이 발생하지 않음).
 * confirm: true 를 보내야 실제 배치가 생성된다.
 */
export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정" }, { status: 400 });
  }
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const {
    names,
    categories,
    perQuery = 20,
    limit = 100,
    confirm = false,
  } = await request.json().catch(() => ({}));

  // 1) 후보 목록 확보 — 직접 준 이름이 없으면 네이버 인기 상품에서 추출(무료)
  let candidates;
  if (Array.isArray(names) && names.length) {
    candidates = names.map((n) => ({ name: String(n).trim(), category: null })).filter((n) => n.name);
  } else {
    candidates = (await buildSeedList({ categories, perQuery })) || [];
  }

  // 2) 이미 카탈로그에 있는 것은 제외 — 중복 비용 방지
  const existing = new Set(
    (await db.collection("catalog").find({}, { projection: { key: 1 } }).toArray()).map((d) => d.key)
  );
  const notInCatalog = candidates.filter((c) => !existing.has(catalogKey(c.name, null)));
  const fresh = notInCatalog.slice(0, limit);

  const cost = estimate(fresh.length);

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      candidates: candidates.length,
      alreadyInCatalog: candidates.length - notInCatalog.length,
      skippedByLimit: notInCatalog.length - fresh.length,
      willAnalyze: fresh.length,
      estimate: cost,
      sample: fresh.slice(0, 15).map((f) => f.name),
      note: "실제로 실행하려면 같은 요청에 confirm: true 를 추가하세요.",
    });
  }

  if (!fresh.length) {
    return NextResponse.json({ created: false, reason: "새로 분석할 항목이 없습니다." });
  }

  // 3) 배치 생성 — 웹 검색 없이 이름 기반 분석
  const batch = await client().messages.batches.create({
    requests: fresh.map((item, i) => ({
      custom_id: `seed-${i}`,
      params: {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPromptByName(item.name) }],
      },
    })),
  });

  // 어떤 custom_id가 어떤 이름인지 기억해둬야 결과 수집 때 대조할 수 있다
  await db.collection("seed_batches").insertOne({
    batchId: batch.id,
    items: fresh.map((f, i) => ({ customId: `seed-${i}`, name: f.name, category: f.category })),
    count: fresh.length,
    estimate: cost,
    status: batch.processing_status,
    createdAt: new Date(),
  });

  return NextResponse.json({
    created: true,
    batchId: batch.id,
    count: fresh.length,
    estimate: cost,
    note: "GET /api/catalog/seed?batchId=... 로 진행 상황을 확인하고 결과를 적재하세요. 보통 1시간 내 완료됩니다.",
  });
}

/**
 * GET /api/catalog/seed             → 진행 중인 배치 목록
 * GET /api/catalog/seed?batchId=... → 상태 확인, 완료됐으면 카탈로그에 적재
 */
export async function GET(request) {
  const batchId = new URL(request.url).searchParams.get("batchId");
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  if (!batchId) {
    const batches = await db
      .collection("seed_batches")
      .find({}, { projection: { items: 0 } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return NextResponse.json({ batches: batches.map((b) => ({ ...b, _id: b._id.toString() })) });
  }

  const record = await db.collection("seed_batches").findOne({ batchId });
  const batch = await client().messages.batches.retrieve(batchId);

  if (batch.processing_status !== "ended") {
    await db
      .collection("seed_batches")
      .updateOne({ batchId }, { $set: { status: batch.processing_status } });
    return NextResponse.json({
      batchId,
      status: batch.processing_status,
      counts: batch.request_counts,
      note: "아직 처리 중입니다. 잠시 후 다시 확인하세요.",
    });
  }

  // 완료 → 결과를 카탈로그에 적재
  const nameByCustomId = new Map((record?.items || []).map((i) => [i.customId, i.name]));
  let ingested = 0;
  let failed = 0;

  for await (const row of await client().messages.batches.results(batchId)) {
    if (row.result?.type !== "succeeded") {
      failed++;
      continue;
    }
    try {
      const text = row.result.message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const result = parseJson(text);
      if (result?.found === false) {
        failed++;
        continue;
      }
      // AI가 이름을 다르게 적었을 수 있으므로 원본 검색어를 보존
      result.seedName = nameByCustomId.get(row.custom_id) || null;
      const ok = await saveCatalog(result, {
        usedWeb: false,
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
        source: "seed",
      });
      ok ? ingested++ : failed++;
    } catch {
      failed++;
    }
  }

  await db
    .collection("seed_batches")
    .updateOne({ batchId }, { $set: { status: "ingested", ingested, failed, ingestedAt: new Date() } });

  return NextResponse.json({ batchId, status: "ingested", ingested, failed });
}
