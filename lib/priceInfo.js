// 시세 — "이 술이 대략 얼마짜리인가".
//
// 네이버 쇼핑 검색 API가 2026-07-31 에 문을 닫으면서 실시간 판매가가 끊겼다.
// 그런데 사람들이 라벨을 찍고 정말 묻는 것은 "지금 어디서 얼마에 파나"가 아니라
// "이거 비싼 술인가"다. 그 답은 실시간 값이 아니어도 낼 수 있다.
//
// 그래서 판매처를 잇는 대신 시장가 범위를 우리 데이터로 갖는다.
// 외부 API가 또 닫혀도 이 값은 남는다 — 빌려 온 것이 아니라 우리 것이기 때문이다.
//
// 정확성을 위해 지키는 것들
//   ① 한 숫자로 단정하지 않는다. 시세는 판매처·시기마다 다르므로 범위로 말한다.
//   ② 무엇을 기준으로 한 값인지 함께 적는다 (용량·판매 경로).
//   ③ 언제 조사한 값인지 적는다. 오래된 값은 화면에서 그렇게 보이게 한다.
//   ④ 해외가는 참고로만 둔다 — 관세·주세 때문에 국내가와 직접 비교되지 않는다.

/** 시세 데이터 한 벌의 모양 (문서 최상단 priceInfo 에 담긴다) */
// {
//   krwLow: 35000, krwHigh: 45000,   // 국내 시장가 범위 (원)
//   volume: "750ml",                  // 어느 용량 기준인가
//   basis: "백화점·와인샵 시중가",     // 어디서 본 값인가
//   usdLow: 22, usdHigh: 30,          // 해외 소매가 범위 (달러, 참고)
//   asOf: "2026-08",                  // 언제 조사한 값인가
//   confidence: 85,                   // 0~100
// }

/** 원화를 사람이 읽는 말로 — 35000 → "3만 5천원" */
export function won(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 100_000_000) {
    const eok = v / 100_000_000;
    return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억원`;
  }
  if (v >= 10_000) {
    const man = Math.floor(v / 10_000);
    const rest = Math.round((v % 10_000) / 1000);
    return rest ? `${man}만 ${rest}천원` : `${man}만원`;
  }
  return `${v.toLocaleString()}원`;
}

/**
 * 화면에 크게 띄울 한 줄. 범위가 좁으면 한 값으로 접어 말한다 —
 * "4만원 ~ 4만 2천원"은 범위가 아니라 잡음이다.
 */
export function priceLabel(info) {
  if (!info) return null;
  const lo = Number(info.krwLow);
  const hi = Number(info.krwHigh);
  if (!lo && !hi) return null;
  if (!hi || lo === hi) return won(lo);
  if (!lo) return `${won(hi)} 안팎`;
  // 차이가 15% 안쪽이면 가운데 값 하나로 말한다
  if (hi / lo < 1.15) return `${won(Math.round((lo + hi) / 2 / 1000) * 1000)} 안팎`;
  return `${won(lo)} ~ ${won(hi)}`;
}

/** 해외 참고가 — 있을 때만, 그리고 "참고"라는 것이 드러나게 */
export function globalLabel(info) {
  const lo = Number(info?.usdLow);
  const hi = Number(info?.usdHigh);
  if (!lo && !hi) return null;
  if (!hi || lo === hi) return `$${lo || hi}`;
  if (!lo) return `$${hi}`;
  return `$${lo}~${hi}`;
}

/**
 * 값의 나이. 시세는 늙는다 — 2년 전 값을 오늘 값인 척 보여 주면 안 된다.
 * @returns {"fresh"|"aging"|"stale"|null}
 */
export function priceAge(info, now = new Date()) {
  const m = String(info?.asOf || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const months =
    (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2]));
  if (months <= 12) return "fresh";
  if (months <= 24) return "aging";
  return "stale";
}

/** 조사 시점을 사람 말로 — "2026-08" → "2026년 8월 기준" */
export function asOfLabel(info) {
  const m = String(info?.asOf || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}년 ${Number(m[2])}월 기준`;
}

/**
 * 이 값을 얼마나 믿을 수 있나.
 *
 * 국내에 정식 유통되지 않는 술은 판매처가 몇 곳뿐이거나 아예 없어서,
 * 정직하게 조사해도 범위가 넓고 확신이 낮게 나온다. 그것을 감추고
 * 다른 값과 똑같이 보여 주면 사용자를 속이는 셈이다.
 * @returns {"solid"|"rough"|null}
 */
export function priceTrust(info) {
  const c = Number(info?.confidence);
  if (!Number.isFinite(c)) return null;
  return c >= 65 ? "solid" : "rough";
}

/**
 * 가격대(1~5)와 조사한 시세가 서로 어긋나는지 본다.
 * 어긋나면 둘 중 하나가 틀린 것이므로 점검 대상으로 올린다.
 * @returns {number|null} 시세로 계산한 대역
 */
export function bandFromPrice(info) {
  const lo = Number(info?.krwLow);
  const hi = Number(info?.krwHigh);
  const mid = lo && hi ? (lo + hi) / 2 : lo || hi;
  if (!mid) return null;
  if (mid < 20_000) return 1;
  if (mid < 50_000) return 2;
  if (mid < 100_000) return 3;
  if (mid < 300_000) return 4;
  return 5;
}
