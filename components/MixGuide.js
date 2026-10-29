"use client";

// 섞어 마시기 — 고른 레시피를 잔 그림으로 한 단계씩 보여 준다.
//
// 칠링·디캔팅 연출(TimerVisual)과 같은 방식이다. 몇 번째 단계인지를 받아 잔을 그리고,
// 단계가 바뀔 때마다 얼음이 떨어지고 술이 차오르는 것은 CSS 전환이 맡는다.
// 위스키 색은 그 술의 liquidColor 를 쓴다 — 같은 하이볼이라도 셰리 캐스크는 더 붉다.
// 시작은 사용자가 누를 때만 — 화면에 들어오자마자 저절로 돌면 읽기도 전에 끝난다.

import { useEffect, useState } from "react";
import { mixPlan, stepsOf, amountsOf, MIXERS, ADDINS, GARNISH, RATIOS, SHOTS } from "@/lib/mixes";
import { THEME } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

const GOLD = THEME.accent;
const GOLD_DIM = THEME.accentDim;
const STEP_MS = 2200; // 한 단계를 읽고 그림이 따라오는 데 걸리는 시간

// 잔 안쪽에서 술이 차는 자리 (viewBox 110×140)
const BOTTOM = 119;
const TOP = 38;

const ICE = [[37, 104], [53, 101], [41, 88], [56, 84], [45, 71], [59, 67]];
const BUBBLES = [
  [42, 113, 0], [50, 109, 0.6], [61, 115, 1.2], [69, 110, 0.3],
  [46, 101, 1.6], [65, 104, 0.9], [55, 116, 2], [71, 99, 1.4],
];

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 두 색을 r 만큼 섞는다 — 다 저은 뒤의 술 색 */
function mixHex(a, b, r) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  const out = x.map((v, i) => Math.round(v + (y[i] - v) * r));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function MixVisual({ recipe, steps, stage, amounts, whiskyColor }) {
  const mixer = MIXERS[recipe.mixer];
  const add = recipe.addin ? ADDINS[recipe.addin] : null;
  // 그 동작까지 왔는가 — 그림은 지나온 단계를 모두 쌓아 그린다
  const at = (act) => {
    const i = steps.findIndex((s) => s.act === act);
    return i >= 0 && i <= stage;
  };
  const now = steps[stage]?.act || null;

  // 층의 높이는 부피에 비례한다 — 청·시럽은 무거워 바닥에 깔리고 위스키가 그 위에 뜬다
  const full = BOTTOM - TOP;
  const total = amounts.whisky + (amounts.addin?.ml || 0) + amounts.mixer.ml;
  const aH = add && at("addin") ? (full * amounts.addin.ml) / total : 0;
  const wH = at("whisky") ? (full * amounts.whisky) / total : 0;
  const mH = at("mixer") ? (full * amounts.mixer.ml) / total : 0;
  const surface = BOTTOM - aH - wH - mH;

  // 맑은 믹서는 위스키 색이 옅어지고, 콜라·진저에일은 믹서 색 쪽으로 간다
  const mixed = at("lift");
  let blend = mixHex(whiskyColor, mixer.tint, mixer.clear ? 0.45 : 0.75);
  if (add) blend = mixHex(blend, add.tint, 0.18);
  const garnish = recipe.garnish !== "none" && at("garnish") ? GARNISH[recipe.garnish] : null;
  const pourColor =
    now === "whisky" ? whiskyColor : now === "addin" ? add?.tint : mixer.clear ? "#d8ecf1" : mixer.tint;

  const layer = (y, h, fill, opacity, slow) => ({
    y,
    height: h,
    style: {
      fill: mixed ? blend : fill,
      opacity: mixed ? 0.85 : opacity,
      transition: `y ${slow}s ease, height ${slow}s ease, fill 1.2s ease, opacity 1.2s ease`,
    },
  });

  return (
    <svg viewBox="0 0 110 140" className="tv-svg" aria-hidden="true">
      <defs>
        <clipPath id="mx-glass">
          <path d="M34 20L35.8 119H74.2L76 20Z" />
        </clipPath>
      </defs>

      {/* 붓는 줄기 — 술 뒤로 바닥까지 내려 차오르는 수면 아래로 잠기게 한다.
          수면에서 끊으면 수면이 아직 차오르는 동안 줄기와 술 사이가 떠 보인다 */}
      {(now === "whisky" || now === "addin" || now === "mixer") && (
        <rect key={now} x="54" y="0" width="2.4" height={BOTTOM} rx="1.2"
          fill={pourColor} opacity="0.9" className="mx-pour" />
      )}

      <g clipPath="url(#mx-glass)">
        {/* 맛 더하기 — 바닥에 깔린다 */}
        {add && <rect x="30" width="50" {...layer(BOTTOM - aH, aH, add.tint, 0.9, 1)} />}
        {/* 위스키 */}
        <rect x="30" width="50" {...layer(BOTTOM - aH - wH, wH, whiskyColor, 0.85, 1.2)} />
        {/* 믹서 — 위스키 위로 */}
        <rect x="30" width="50" {...layer(surface, mH, mixer.tint, mixer.opacity, 1.4)} />
        {/* 수면 */}
        {aH + wH + mH > 0 && (
          <rect x="30" y={surface} width="50" height="1.4" fill={GOLD} opacity="0.45"
            style={{ transition: "y 1.4s ease" }} />
        )}

        {/* 얼음 — 위에서 떨어져 쌓인다 */}
        {ICE.map(([x, y], i) => (
          <rect
            key={i} x={x} y={y} width="14" height="13" rx="3"
            fill="#eef6f8" fillOpacity="0.16" stroke="#eef6f8" strokeOpacity="0.55" strokeWidth="1"
            style={{
              transform: at("ice") ? "translateY(0)" : "translateY(-90px)",
              opacity: at("ice") ? 1 : 0,
              transition: `transform .55s cubic-bezier(.3,1.35,.6,1) ${i * 0.09}s, opacity .25s ${i * 0.09}s`,
            }}
          />
        ))}

        {/* 탄산 */}
        {mixer.fizzy && at("mixer") &&
          BUBBLES.map(([x, y, d], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 1.1 : 1.6} fill="#f4fbfc"
              className="mx-bubble" style={{ animationDelay: `${d}s` }} />
          ))}
      </g>

      {/* 바스푼 — 젓기는 좌우로, 들어 올리기는 위아래로 */}
      {(now === "chill" || now === "stir" || now === "lift") && (
        <g className={`mx-spoon ${now === "lift" ? "lift" : "stir"}`}>
          <path d="M62 4L57 114" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="57" cy="115" r="2.2" fill={GOLD} />
        </g>
      )}

      {/* 잔 — 곧게 선 하이볼 잔 */}
      <path d="M32 18L34.5 124Q35 128 39 128H71Q75 128 75.5 124L78 18" fill="none" stroke={GOLD} strokeWidth="2" />
      <path d="M36 121H74" stroke={GOLD_DIM} strokeWidth="2" strokeLinecap="round" />

      {/* 가니시 — 잔 테두리에 건 레몬·라임 */}
      {garnish && (
        <g className="mx-garnish">
          <circle cx="76" cy="22" r="8.5" fill={garnish.color} stroke={garnish.rind} strokeWidth="1.6" />
          <path d="M76 14.5V29.5M69.5 18.3L82.5 25.7M69.5 25.7L82.5 18.3" stroke={garnish.rind} strokeWidth="0.8" opacity="0.7" />
        </g>
      )}
    </svg>
  );
}

export default function MixGuide({ result }) {
  const plan = mixPlan(result);
  const [key, setKey] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [shot, setShot] = useState(45);
  const [more, setMore] = useState(false); // 추천 밖의 레시피를 펼쳤는가
  const [stage, setStage] = useState(-1); // -1 시작 전 · 0… 진행 중 · steps.length 끝

  const recipe = plan.recipes.find((r) => r.key === key) || plan.recipes[0];
  const steps = recipe ? stepsOf(recipe) : [];
  const playing = stage >= 0 && stage < steps.length;

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setStage((s) => s + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, stage]);

  if (!recipe) return null;

  const rt = ratio ?? plan.ratio;
  const amounts = amountsOf(recipe, { shot, ratio: rt, abv: plan.abv });
  const vars = {
    w: amounts.whisky,
    a: amounts.addin?.ml,
    m: amounts.mixer.ml,
    mixer: t(amounts.mixer.name),
  };
  const whiskyColor = hexToRgb(result.liquidColor) ? result.liquidColor : "#c08a3e";
  const cells = [
    { n: amounts.whisky, unit: "ml", label: "위스키" },
    amounts.addin && { n: amounts.addin.ml, unit: "ml", label: amounts.addin.name },
    { n: amounts.mixer.ml, unit: "ml", label: amounts.mixer.name },
    { n: amounts.abv, unit: "%", label: "완성 도수" },
  ].filter(Boolean);

  // 추천 밖의 것을 골라 둔 채 접어도 고른 것은 보이게 둔다
  const shown = plan.recipes.filter((r, i) => more || i < plan.picks || r.key === recipe.key);
  const hidden = plan.recipes.length - shown.length;

  // 고른 것을 바꾸면 처음으로 — 반쯤 붓던 잔이 다른 비율로 바뀌면 안 된다
  const choose = (set, v) => {
    set(v);
    setStage(-1);
  };

  return (
    <div className="card">
      <div className="card-title">{t("섞어 마시기")}</div>
      {plan.styleNote && <div className="mix-lead">{t(plan.styleNote)}</div>}

      <div className="filter-chips mix-recipes" role="group" aria-label={t("레시피")}>
        {shown.map((r) => (
          <button
            key={r.key}
            className={`filter-chip ${r.key === recipe.key ? "on" : ""}`}
            aria-pressed={r.key === recipe.key}
            onClick={() => choose(setKey, r.key)}
          >
            {t(r.name)}
          </button>
        ))}
        {hidden > 0 && (
          <button className="filter-chip mix-more" onClick={() => setMore(true)}>
            {t("다른 레시피 {n}", { n: hidden })}
          </button>
        )}
      </div>
      <div className="mix-why">{t(recipe.why)}</div>

      <div className="mix-body">
        <div className="mix-stage">
          {/* 시작 전에는 완성된 잔을 미리 보여 준다 */}
          <MixVisual
            recipe={recipe}
            steps={steps}
            stage={stage < 0 ? steps.length : stage}
            amounts={amounts}
            whiskyColor={whiskyColor}
          />
        </div>

        <div className="mix-spec">
          <div className="mix-row">
            <span>{t("농도")}</span>
            <div className="filter-chips">
              {RATIOS.map((o) => (
                <button
                  key={o.ratio}
                  className={`filter-chip ${o.ratio === rt ? "on" : ""}`}
                  aria-pressed={o.ratio === rt}
                  onClick={() => choose(setRatio, o.ratio)}
                >
                  {t(o.label)} {o.hint}
                </button>
              ))}
            </div>
          </div>
          <div className="mix-row">
            <span>{t("위스키")}</span>
            <div className="filter-chips">
              {SHOTS.map((o) => (
                <button
                  key={o.ml}
                  className={`filter-chip ${o.ml === shot ? "on" : ""}`}
                  aria-pressed={o.ml === shot}
                  onClick={() => choose(setShot, o.ml)}
                >
                  {t(o.label)} {o.ml}ml
                </button>
              ))}
            </div>
          </div>
          <div className="mix-amounts" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
            {cells.map((c) => (
              <div key={c.label}>
                <b>{c.n}<small>{c.unit}</small></b>
                <em>{t(c.label)}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ol className="mix-steps">
        {steps.map((s, i) => (
          <li key={i} className={i === stage ? "now" : i < stage ? "done" : ""}>
            {t(s.text, vars)}
          </li>
        ))}
      </ol>

      <button className="btn primary timer-start" disabled={playing} onClick={() => setStage(0)}>
        {playing
          ? t("만드는 중 · {n}/{total}", { n: stage + 1, total: steps.length })
          : stage >= steps.length
            ? t("다시 보기")
            : t("만드는 과정 보기")}
      </button>

      {recipe.tip && <div className="tip-line">✦ {t(recipe.tip)}</div>}
      {plan.notes.map((n) => (
        <div className="shop-note" key={n}>{t(n)}</div>
      ))}
      <div className="shop-note">
        {plan.abvGuessed && `${t("도수 정보가 없어 40%로 계산했습니다.")} `}
        {t("완성 도수는 얼음이 녹기 전 기준입니다 · 녹을수록 조금 더 낮아집니다")}
      </div>
    </div>
  );
}
