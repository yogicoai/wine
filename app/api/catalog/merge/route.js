import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { catalogKey, clearNameIndexCache } from "@/lib/catalog";
import { splitName } from "@/lib/nameClean";

export const runtime = "nodejs";
export const maxDuration = 60;

// 같은 술이 표기만 달라 두 칸을 차지한 것을 합친다.
//   "샤또 뒤크뤼 보카이유 (Château Ducru-Beaucaillou)"  ==  "샤또 뒤크뤼 보카이유"
//   "샤또 랭슈 바쥬"  ==  "샤또 랭슈 바주"
//
// GET  → 합칠 목록만 보여 준다
// POST { confirm: true } → 실제로 합친다

// 한국어 표기가 자주 갈리는 자리를 눌러 같은 것으로 본다
const SOFTEN = [
  [/쥬/g, "주"], [/쥐/g, "지"], [/쉬/g, "시"], [/져/g, "저"],
  [/떼/g, "테"], [/꼬/g, "코"], [/까/g, "카"], [/뽀/g, "포"],
  [/삐/g, "피"], [/똘/g, "톨"], [/씨/g, "시"], [/쌩/g, "생"],
  [/쉐/g, "셰"], [/뀌/g, "퀴"], [/뤼/g, "루"], [/쏘/g, "소"],
  // 일본 술은 여기가 갈린다. 다이긴죠/다이긴조가 서로 못 만나면
  // 사케는 같은 술이 두 칸을 차지한 채 영영 합쳐지지 않는다.
  [/죠/g, "조"], [/쥰/g, "준"], [/쯔/g, "츠"], [/쵸/g, "초"],
  [/챠/g, "차"], [/쨔/g, "자"], [/쿄/g, "교"], [/뉴/g, "누"],
  [/베이/g, "베에"],   // 하치베이 = 하치베에 (八兵衛)
];

// 낱말 하나가 통째로 갈리는 경우 — 뜻이 같은 표기를 한쪽으로 맞춘다
const SYNONYM = [
  [/니혼사케\s*/g, ""],   // 판매처가 붙이는 머리말이지 술 이름이 아니다
  [/도쿠베츠/g, "특별"],
  [/카라구치/g, "카라쿠치"],
  [/(준마이|다이긴조|긴조|혼조조)\s*슈/g, "$1"],  // "준마이 슈" 는 "준마이" 다
];

function normalizeName(raw) {
  let x = splitName(raw).name.toLowerCase();
  for (const [re, to] of SOFTEN) x = x.replace(re, to);
  for (const [re, to] of SYNONYM) x = x.replace(re, to);
  return x;
}

function squash(raw) {
  return normalizeName(raw).replace(/[^가-힣a-z0-9]/gi, "");
}

// "노턴 리제르바 말벡"과 "노턴 말벡 리제르바"는 같은 술이다.
// 낱말을 가나다순으로 세워 비교하면 어순이 뒤바뀐 것도 한 칸에 모인다.
// 낱말이 하나뿐이면 짧은 이름끼리 엉뚱하게 묶일 수 있어 두 개 이상일 때만 쓴다.
function squashSorted(raw) {
  const words = normalizeName(raw)
    .split(/[^가-힣a-z0-9]+/i)
    .filter(Boolean);
  if (words.length < 2) return null;
  return words.sort().join("");
}

// 어느 쪽을 남길지.
// 손으로 쓴 것(manual)을 가장 앞에 둔다 — 표기가 표준에 맞고 내용을 검토했다.
// 그다음이 스캔본, 마지막이 수확 뼈대다.
// 정식 분석 여부가 가장 세다 — 뼈대는 손으로 넣었더라도 내용이 열 줄뿐이다.
const SOURCE_RANK = { manual: 3000, scan: 1000, harvest: 0 };

function richness(d) {
  const r = d.result || {};
  const fields = Object.keys(r).length;
  const depth = (r.story ? 5 : 0) + (r.history?.length || 0) + (r.foodPairing?.length || 0);
  return (
    (d.tier !== "stub" ? 100000 : 0) +
    (SOURCE_RANK[d.source] ?? 500) +
    fields +
    depth * 2 +
    Math.min(50, d.hits || 0)
  );
}

async function findGroups(db) {
  const rows = await db
    .collection("catalog")
    .find({}, { projection: { name: 1, category: 1, tier: 1, hits: 1, result: 1, image: 1, source: 1, vintage: 1 } })
    .toArray();

  // 붙여 쓴 형태로 한 번, 낱말을 세운 형태로 한 번 — 두 기준을 합쳐 묶는다
  const map = new Map();
  for (const d of rows) {
    for (const k of [squash(d.name), squashSorted(d.name)]) {
      if (!k) continue;
      const bucket = map.get(k) || map.set(k, new Map()).get(k);
      bucket.set(String(d._id), d);
    }
  }

  // 한 술이 두 기준 모두에 걸리므로 이미 처리한 것은 건너뛴다
  const done = new Set();
  const groups = [];
  for (const bucket of map.values()) {
    const docs = [...bucket.values()].filter((d) => !done.has(String(d._id)));
    if (docs.length < 2) continue;
    docs.forEach((d) => done.add(String(d._id)));
    const sorted = docs.sort((a, b) => richness(b) - richness(a));
    groups.push({ keep: sorted[0], drop: sorted.slice(1) });
  }
  return groups;
}

export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "DB 미설정" }, { status: 503 });

  const groups = await findGroups(db);
  return NextResponse.json({
    groups: groups.length,
    willDelete: groups.reduce((n, g) => n + g.drop.length, 0),
    items: groups.map((g) => ({
      keep: `${g.keep.name} [${g.keep.tier || "full"}]`,
      drop: g.drop.map((d) => `${d.name} [${d.tier || "full"}]`),
    })),
    note: "POST { confirm: true } 로 합칩니다.",
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
  const groups = await findGroups(db);
  let deleted = 0;
  let renamed = 0;

  for (const { keep, drop } of groups) {
    // 남길 쪽 이름에 괄호가 붙어 있으면 떼고, 원어는 검색어로 옮긴다
    const { name, original } = splitName(keep.name);
    const hits = [keep, ...drop].reduce((n, d) => n + (d.hits || 0), 0);
    const set = { hits };
    if (name !== keep.name) {
      set.name = name;
      set.key = catalogKey(name, keep.vintage);
      set.searchKeyword = [name, original].filter(Boolean).join(" ");
      set["result.name"] = name;
      renamed++;
    }
    // 지울 쪽에만 있던 사진은 살려 둔다
    if (!keep.image) {
      const withImage = drop.find((d) => d.image);
      if (withImage) set.image = withImage.image;
    }
    await col.updateOne({ _id: keep._id }, { $set: set });

    const { deletedCount } = await col.deleteMany({ _id: { $in: drop.map((d) => d._id) } });
    deleted += deletedCount;
  }

  clearNameIndexCache();

  return NextResponse.json({ groups: groups.length, deleted, renamed });
}
