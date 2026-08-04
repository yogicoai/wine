// 앱 프로필 — 엔진은 하나, 껍데기는 여섯.
//
// 스캔·분석·카탈로그·추천·셀러는 여섯 앱이 똑같이 쓴다(엔진).
// 다른 것은 껍데기다 — 색과 서체(theme), 앱이 쓰는 말(copy), 화면 구성(layout).
// 그래서 코드를 여섯으로 복사하지 않고 lib/apps/<키>.js 만 갈아끼운다.
//
// 고르는 법 — 환경변수 NEXT_PUBLIC_APP 에 아래 키를 넣고 각각 배포한다.
//   wine · sake · beer · tradition · whisky · spirits
// 값을 주지 않으면 와인으로 동작한다.

// .js 확장자 필수 — scripts/dev.mjs 가 이 파일을 번들러 없이 Node 로 직접 읽는다
import wine from "./apps/wine.js";
import sake from "./apps/sake.js";
import beer from "./apps/beer.js";
import tradition from "./apps/tradition.js";
import whisky from "./apps/whisky.js";
import spirits from "./apps/spirits.js";

export const PROFILES = { wine, sake, beer, tradition, whisky, spirits };

const KEY = (process.env.NEXT_PUBLIC_APP || "wine").trim();

/** 지금 배포된 앱의 프로필. 모르는 값이면 와인으로 떨어뜨린다. */
export const APP = PROFILES[KEY] || PROFILES.wine;

/** 이 앱의 색·서체 설정 */
export const THEME_CFG = APP.theme;

/** 이 앱이 쓰는 말 (와인 기준 문구 → 이 앱의 문구) */
export const COPY = APP.copy || {};

/** 화면 구성 */
export const LAYOUT = APP.layout || {};

// ── 범위 ────────────────────────────────────────────────

/** 이 앱이 다루는 주종인가 — 검색·추천·수확이 범위를 벗어나지 않게 한다 */
export function inScope(category) {
  return !category || APP.scope.includes(category);
}

/** DB 조회에 바로 넣는 조건. 주종이 하나면 문자열, 여럿이면 $in 을 쓴다. */
export function scopeQuery() {
  return APP.scope.length === 1 ? APP.scope[0] : { $in: APP.scope };
}

/**
 * 이 앱의 기록만 고르는 조건 — 스캔 기록·셀러처럼 사용자마다 쌓이는 것에 쓴다.
 *
 * 앱 여섯이 DB 하나를 함께 쓴다. 거르지 않으면 맥주 앱에서 와인 스캔 기록이
 * 보이고, 셀러의 와인이 맥주 취향으로 학습된다. 실제로 그랬다.
 *
 * 세 갈래로 본다.
 *   1. 주종이 이 앱 범위인 기록
 *   2. 이 앱에서 남긴 기록 (판독 실패처럼 주종이 없는 것도 남는다)
 *   3. 앱 표시가 없던 시절의 기록은 결과 안의 주종으로 가른다
 *
 * @param {string} categoryField 주종이 담긴 필드 이름 (기본 "category")
 * @param {string|null} legacyField 옛 기록에서 주종을 찾을 자리 (예: "result.category")
 */
export function ownScope(categoryField = "category", legacyField = null) {
  const or = [
    { [categoryField]: { $in: APP.scope } },
    // 이 앱에서 남겼더라도 주종을 읽어 낸 기록은 그 주종의 앱으로 간다.
    // 여기를 "이 앱에서 남긴 것 전부"로 두면, 와인 앱에서 사케를 한 번 찍었을 때
    // 그 사케가 와인 히스토리에 계속 남는다. 실제로 그랬다.
    // 주종을 못 읽은 기록(판독 실패)만 남긴 앱을 따라간다 — 그것마저 사라지면
    // 방금 찍은 것이 어디에도 없게 된다.
    { app: APP.key, [categoryField]: null },
  ];
  if (legacyField) {
    or.push({
      app: { $exists: false },
      [categoryField]: { $exists: false },
      [legacyField]: { $in: APP.scope },
    });
  }
  return { $or: or };
}

/** 기록을 남길 때 함께 찍는 표시 — 어느 앱에서 나온 것인지 남긴다 */
export function stamp(category = null) {
  return { app: APP.key, ...(category ? { category } : {}) };
}

/** 기본 주종 — 문답·안내 문구처럼 하나를 골라야 할 때 쓴다 */
export const DEFAULT_CATEGORY = APP.categories[0];

/** 이 앱이 둘러보기·추천에서 훑는 주종 전부 */
export const APP_CATEGORIES = APP.categories;

// ── 색 ──────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex, target, ratio) {
  // target: 255(밝게) 또는 0(어둡게) 쪽으로 ratio 만큼 섞는다
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const out = rgb.map((v) => Math.round(v + (target - v) * ratio));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function alpha(hex, a) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

/**
 * <style> 로 주입할 :root 변수 — 수백 곳의 var() 사용처가 한 번에 갈아입는다.
 *
 * 선(--line)은 앱 색으로 물들이지 않는다. 테두리까지 앱 색이면 무엇을 넣어도
 * 2010년대 "럭셔리 흉내"가 된다 — 선은 빛(흰색 알파), 앱 색은 강조에만.
 */
// 전통 문양 — 화면 전체에 아주 옅게 까는 반복 무늬 (data URI).
// 사진 한 장보다 이런 무늬가 "그 나라"를 조용히, 그러나 확실하게 말한다.
const PATTERNS = {
  // 세이가이하(青海波) — 겹치는 부채꼴 물결. 일본 전통 문양의 대표.
  seigaiha(color) {
    const c = encodeURIComponent(color);
    const arcs = (cx) =>
      [40, 30, 20, 10]
        .map((r) => `<path d='M${cx - r} 20a${r} ${r} 0 0 1 ${r * 2} 0'/>`)
        .join("");
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='20'>` +
      `<g fill='none' stroke='${c}' stroke-width='1.1'>${arcs(40)}${arcs(0)}${arcs(80)}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%25/g, "%")}")`;
  },
};

export function themeCss() {
  const t = APP.theme;
  const g = t.accent;
  const w = t.wineish;
  // 배경 사진을 덮는 장막 — 위는 사진이 비치고 아래로 갈수록 글자가 읽히도록 잠긴다.
  // 앱마다 배경이 달라 밝기도 다르므로 시작 농도를 앱이 정한다.
  const veil = (n) => alpha(t.bg, Math.min(0.995, t.bgVeil + n));
  const pattern = t.pattern && PATTERNS[t.pattern] ? PATTERNS[t.pattern](g) : "none";

  // 밝은 바탕이냐 어두운 바탕이냐에 따라 뒤집어야 하는 것들.
  //
  // globals.css 는 어둠을 전제하고 쓰였다. 선은 "빛"이라며 흰색 알파를 쓰고,
  // 카드 표면도 흰색을 옅게 얹는다. 바탕이 크림색이 되면 그 둘이 다 사라진다 —
  // 흰 위에 흰 선은 보이지 않는다.
  //
  // 강조색도 마찬가지다. 밝은 쪽에서는 밝은 색이 더 밝아질 자리가 없다.
  // 어두운 바탕에서 흰색으로 섞던 것을 밝은 바탕에서는 검정으로 섞는다.
  const light = t.mode === "light";
  const lineColor = (a) => (light ? `rgba(0, 0, 0, ${a})` : `rgba(255, 255, 255, ${a})`);
  // hi 는 "더 눈에 띄는 쪽", lo 는 "물러나는 쪽"이다. 어느 쪽이 밝은지가 바탕에 따라 뒤집힌다.
  const goldHi = light ? mix(g, 0, 0.22) : mix(g, 255, 0.35);
  const goldLo = light ? mix(g, 255, 0.42) : mix(g, 0, 0.32);

  return `:root{
--gold:${g};--gold-hi:${goldHi};--gold-lo:${goldLo};--gold-soft:${alpha(g, light ? 0.14 : 0.12)};
--wine:${w};--tint:${w};--wine-glow:${alpha(w, light ? 0.1 : 0.16)};--gold-glow:${alpha(g, 0.05)};
--bg:${t.bg};--bg-2:${t.bg2};--bg-3:${t.bg3};--ink:${t.ink};--ink-dim:${t.inkDim};
--line:${lineColor(light ? 0.13 : 0.11)};--line-soft:${lineColor(light ? 0.07 : 0.06)};
--surface:${lineColor(light ? 0.035 : 0.045)};--surface-2:${lineColor(light ? 0.06 : 0.07)};
--bad:${t.bad || (light ? "#a33a3a" : "#b45959")};
--radius:${t.radius};--radius-sm:${t.radiusSm};
--bg-image:url("${t.bgImage}");--grain:${t.grain};--pattern:${pattern};
--seal:${t.sealColor || "#c73e3a"};
--veil-1:${veil(0)};--veil-2:${veil(0.18)};--veil-3:${veil(0.32)};--veil-4:${veil(0.38)};
--veil-edge:${alpha(t.bg, 0.55)};
--shadow:${light ? "0 2px 10px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" : "none"};
}`.replace(/\n/g, "");
}

/** SVG·캔버스처럼 CSS 변수를 못 쓰는 곳을 위한 파생색 */
export const THEME = {
  accent: APP.theme.accent,
  accentDim: alpha(APP.theme.accent, 0.35),
  accentLine: alpha(APP.theme.accent, 0.16),
  accentFill: alpha(APP.theme.accent, 0.22),
  wineish: APP.theme.wineish,
};
