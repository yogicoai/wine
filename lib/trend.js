// 네이버 데이터랩 검색어 트렌드 — 사람들이 요즘 무엇을 찾는지.
//
// 쇼핑 검색 API가 내려간 자리에서 쓸 수 있는 몇 안 되는 무료 통로다.
// 쇼핑인사이트(주종별 판매 순위)는 401 이라 못 쓰고, 검색어 트렌드만 열린다.
//
// 이 API의 성질을 알고 써야 한다.
//
//   ① 한 번에 다섯 낱말까지다.
//   ② 돌려주는 값은 절대 검색량이 아니라 그 요청 안에서의 상대값이다.
//      가장 큰 것이 100 이 되고 나머지가 그에 눌린다. 그래서 두 번 나눠 부른
//      결과를 나란히 놓고 비교할 수 없다. 다섯 개를 한 번에 물어야 한다.
//   ③ 기간을 어떻게 잡느냐에 따라 방향이 뒤집힌다. 5~7월로 보면 사케가
//      77 → 100 으로 오르고, 2~7월로 보면 100 → 58 로 내린다. 술 검색은
//      겨울에 높고 여름에 낮다. 그래서 화면에서 "뜬다/진다"를 단정하지 않고
//      최근 관심도 순위와 여섯 달치 모양만 보여 준다. 판단은 보는 사람 몫이다.
//
// 낱말은 앱마다 손으로 골랐다. 카탈로그 조회수 상위를 쓰면 자동으로 유지되지만,
// 검색량이 없는 이름이 섞여 0 으로 눌린다 — 실제로 하쿠츠루·죠젠미즈노고토시·
// 카시예로 델 디아블로가 그랬다. 신호가 잡히는 것만 남겼다.

import { env } from "./env";
import { APP } from "./appProfile";

// [표시 이름, 실제로 물어볼 낱말들]
// 표기가 갈리는 것은 함께 묶는다 — "맥캘란"과 "맥켈란"은 같은 술이다.
const KEYWORDS = {
  wine: [
    ["몬테스 알파", ["몬테스 알파"]],
    ["1865", ["1865 와인"]],
    ["옐로우테일", ["옐로우테일"]],
    ["빌라 엠", ["빌라엠", "빌라 엠"]],
    ["샤또 딸보", ["샤또 딸보"]],
  ],
  sake: [
    ["닷사이", ["닷사이"]],
    ["쿠보타", ["쿠보타"]],
    ["월계관", ["월계관"]],
    ["간바레 오또상", ["간바레오또상"]],
    ["오제키", ["오제키"]],
  ],
  beer: [
    ["기네스", ["기네스"]],
    ["아사히 생맥주", ["아사히 생맥주"]],
    ["칭따오", ["칭따오"]],
    ["하이네켄", ["하이네켄"]],
    ["곰표 맥주", ["곰표 맥주"]],
  ],
  whisky: [
    ["발렌타인", ["발렌타인"]],
    ["조니워커", ["조니워커"]],
    ["맥캘란", ["맥캘란", "맥켈란"]],
    ["글렌피딕", ["글렌피딕"]],
    ["산토리 가쿠빈", ["산토리 가쿠빈"]],
  ],
  tradition: [
    ["화요", ["화요"]],
    ["안동소주", ["안동소주"]],
    ["복순도가", ["복순도가"]],
    ["지평막걸리", ["지평막걸리"]],
    ["느린마을막걸리", ["느린마을막걸리"]],
  ],
  spirits: [
    ["예거마이스터", ["예거마이스터"]],
    ["앱솔루트", ["앱솔루트"]],
    ["바카디", ["바카디"]],
    ["깔루아", ["깔루아", "칼루아"]],
    ["봄베이 사파이어", ["봄베이 사파이어"]],
  ],
};

/**
 * 오늘 기준 지난 여섯 달. 데이터랩은 이번 달 자료를 아직 안 주므로 지난달까지 본다.
 *
 * 날짜를 toISOString 으로 적으면 안 된다. 그것은 UTC 로 옮겨 적으므로 한국에서
 * 7월 31일이 7월 30일이 되고, 그 하루 때문에 범위가 일곱 달로 늘어난다.
 * 실제로 그랬다 — 2026-01-31 ~ 2026-07-30 이 나와 점이 일곱 개 찍혔다.
 */
function window6() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // 지난달 마지막 날
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: ymd(start), endDate: ymd(end) };
}

/**
 * 이 앱의 술 다섯 가지가 요즘 얼마나 검색되는지.
 * @returns {Promise<null | {items: {name, ratio, points: number[]}[], from, to}>}
 */
export async function searchTrend() {
  const id = env("NAVER_CLIENT_ID");
  const secret = env("NAVER_CLIENT_SECRET");
  const set = KEYWORDS[APP.key];
  if (!id || !secret || !set) return null;

  const { startDate, endDate } = window6();
  const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": id,
      "X-Naver-Client-Secret": secret,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: "month",
      keywordGroups: set.map(([name, keywords]) => ({ groupName: name, keywords })),
    }),
    // 한 달에 한 번만 바뀌는 값이다. 하루 묵혀 쓴다.
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const items = (data?.results || [])
    .map((r) => {
      const points = (r.data || []).map((d) => d.ratio);
      return {
        name: r.title,
        ratio: points.length ? points[points.length - 1] : 0,
        points,
      };
    })
    // 신호가 거의 없는 것은 빼는 편이 낫다. 0 짜리 막대가 줄지어 있으면
    // 관심이 없다는 뜻이 아니라 옆에 압도적인 것이 있다는 뜻인데, 그렇게 읽히지 않는다.
    .filter((it) => it.ratio >= 3)
    .sort((a, b) => b.ratio - a.ratio);

  if (items.length < 2) return null;
  return { items, from: startDate, to: endDate };
}
