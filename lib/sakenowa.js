// さけのわ(Sakenowa) — 일본 사케 공개 데이터.
//
// 무엇을 주나. 가격은 주지 않는다. 대신 우리가 못 갖고 있던 것을 준다 —
// 실제로 마신 사람들의 평가에서 뽑아낸 맛 좌표와, 일본 현지 인기 순위다.
// 지금 우리 맛 프로필은 AI 가 라벨과 등급을 보고 짐작한 값이라, 근거가 다르다.
//
//   브랜드   3,273  ·  양조장 1,746  ·  맛 좌표 1,355  ·  랭킹 100 (달마다)
//
// 열쇠도 신청도 필요 없고 요금도 없다. 출처를 밝히면 자유롭게 쓸 수 있다.
//   https://muro.sakenowa.com/sakenowa-data/
//
// ── 어떻게 우리 술과 맞추나 ─────────────────────────────────
// 저쪽은 한자·가나(獺祭, 八海山)이고 우리는 한글 음차(닷사이, 핫카이산)다.
// 다만 우리 데이터의 생산자 칸에 원어가 함께 적힌 것이 많아(八海醸造) 그것을 다리로 쓴다.
//
// 느슨하게 맞추면 안 된다. 처음에 글자가 겹치기만 하면 받았더니 "샤라쿠"가
// 泉(이즈미)에 붙었다 — 宮泉銘醸의 泉 한 글자가 겹쳤을 뿐이다. "닷사이"는
// 伊勢旭에 붙었는데, 旭酒造라는 이름의 양조장이 일본에 여럿이라 엉뚱한 곳의
// 브랜드를 집은 것이었다.
//
// 그래서 양조장과 브랜드가 우리 글에 둘 다 있을 때만 확정한다. 같은 이름의
// 양조장이 여럿이면 아예 건드리지 않는다. 208종 중 59종이 남았고, 눈으로 보니
// 조젠미즈노고토시→白瀧, 덴슈→田酒, 주욘다이→十四代 처럼 모두 맞았다.

const BASE = "https://muro.sakenowa.com/sakenowa-data/api";

// 여섯 축. 저쪽이 쓰는 말을 그대로 옮긴다 — 우리 네 축(바디·감칠맛·산도·당도)과는
// 다른 모델이라 억지로 겹치지 않고 따로 보여 준다.
export const FLAVOR_AXES = [
  { key: "f1", ko: "화려함", ja: "華やか" },
  { key: "f2", ko: "방순함", ja: "芳醇" },
  { key: "f3", ko: "중후함", ja: "重厚" },
  { key: "f4", ko: "온화함", ja: "穏やか" },
  { key: "f5", ko: "드라이", ja: "ドライ" },
  { key: "f6", ko: "경쾌함", ja: "軽快" },
];

async function get(path) {
  const res = await fetch(`${BASE}/${path}`, {
    // 달마다 바뀌는 자료다. 하루 묵혀 쓰면 충분하다.
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Sakenowa ${path} ${res.status}`);
  return res.json();
}

/** 브랜드·양조장·맛 좌표·랭킹·태그를 한 번에 받아 온다. */
export async function fetchSakenowa() {
  const [brands, breweries, charts, rankings, tags, brandTags] = await Promise.all([
    get("brands"),
    get("breweries"),
    get("flavor-charts"),
    get("rankings"),
    get("flavor-tags"),
    get("brand-flavor-tags"),
  ]);
  return {
    brands: brands.brands || [],
    breweries: breweries.breweries || [],
    charts: charts.flavorCharts || [],
    rankings: rankings.overall || [],
    tags: tags.tags || [],
    brandTags: brandTags.flavorTags || brandTags.brandFlavorTags || [],
  };
}

/**
 * 우리 술 하나를 저쪽 브랜드에 맞춘다. 확신이 없으면 null 을 준다.
 *
 * @param {string} text 우리 쪽 이름·검색어·생산자를 이어 붙인 글 (원어가 섞여 있다)
 * @param {object} idx  buildIndex 가 만든 찾아보기
 */
export function matchBrand(text, idx) {
  if (!text) return null;

  // ① 양조장을 먼저 찾는다. 이름이 길어(白瀧酒造) 우연히 겹칠 일이 적다.
  //    같은 이름이 여럿인 양조장은 어느 쪽인지 알 수 없으므로 건너뛴다.
  const brewery = idx.breweries
    .filter((b) => b.name.length >= 3 && !idx.dupBrewery.has(b.name) && text.includes(b.name))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (brewery) {
    // 그 양조장의 브랜드 중 우리 글에도 나오는 것. 둘 다 맞아야 확정이다.
    const brand = (idx.brandsByBrewery.get(brewery.id) || [])
      .filter((b) => text.includes(b.name))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (brand) return { brand, brewery, how: "양조장+브랜드" };
  }

  // ② 양조장을 못 찾으면, 브랜드 이름이 세 글자를 넘고 양조장 이름과 겹치지 않을 때만.
  //    "朝日酒造"처럼 양조장 이름이 브랜드 목록에도 있는 경우를 피한다.
  const brand = idx.brands
    .filter((b) => b.name.length >= 3 && !idx.breweryNames.has(b.name) && text.includes(b.name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (brand) {
    return { brand, brewery: idx.breweryById.get(brand.breweryId) || null, how: "브랜드" };
  }
  return null;
}

/** 맞추기를 빠르게 하려고 미리 훑어 둔다. */
export function buildIndex(data) {
  const breweryById = new Map(data.breweries.map((b) => [b.id, b]));
  const breweryNames = new Set(data.breweries.map((b) => b.name));
  const dupBrewery = new Set();
  const seen = new Set();
  for (const b of data.breweries) {
    if (seen.has(b.name)) dupBrewery.add(b.name);
    seen.add(b.name);
  }
  const brandsByBrewery = new Map();
  for (const b of data.brands) {
    if (!brandsByBrewery.has(b.breweryId)) brandsByBrewery.set(b.breweryId, []);
    brandsByBrewery.get(b.breweryId).push(b);
  }
  const chartOf = new Map(data.charts.map((c) => [c.brandId, c]));
  const rankOf = new Map(data.rankings.map((r) => [r.brandId, r]));
  const tagName = new Map(data.tags.map((t) => [t.id, t.tag]));
  const tagsOf = new Map((data.brandTags || []).map((b) => [b.brandId, b.tagIds || []]));
  return {
    brands: data.brands,
    breweries: data.breweries,
    breweryById,
    breweryNames,
    dupBrewery,
    brandsByBrewery,
    chartOf,
    rankOf,
    tagName,
    tagsOf,
  };
}

/** 우리 문서에 담을 모양으로 추린다. 맛 좌표가 없으면 담을 값어치가 없다. */
export function sakenowaFor(hit, idx) {
  if (!hit) return null;
  const chart = idx.chartOf.get(hit.brand.id);
  if (!chart) return null;
  const rank = idx.rankOf.get(hit.brand.id);
  const tagIds = idx.tagsOf.get(hit.brand.id) || [];
  return {
    brandId: hit.brand.id,
    brand: hit.brand.name,
    brewery: hit.brewery?.name || null,
    // 0~1 로 오는 값을 그대로 담는다. 화면에서 백분율로 읽는다.
    flavor: { f1: chart.f1, f2: chart.f2, f3: chart.f3, f4: chart.f4, f5: chart.f5, f6: chart.f6 },
    tags: tagIds.map((id) => idx.tagName.get(id)).filter(Boolean).slice(0, 6),
    rank: rank?.rank || null,
    matchedBy: hit.how,
  };
}
