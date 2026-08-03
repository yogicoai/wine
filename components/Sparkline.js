"use client";
import { t, fmtWon } from "@/lib/i18n";

// 가격 이력을 작은 선 그래프로 보여 준다.
// 점이 하나뿐인 초기에는 아무것도 그리지 않고, 이력이 쌓이면 자연스럽게 나타난다.
export default function Sparkline({ trend, width = 132, height = 34 }) {
  if (!trend) return null;

  const { points, min, max, isLowest, diff, percent } = trend;
  const span = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : width;

  // 가격이 낮을수록 위로 올라오면 헷갈린다 — 값이 클수록 위로 그린다
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.p - min) / span) * (height - 6) - 3;
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  const tone = diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return (
    <div className={`spark tone-${tone}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path className="spark-area" d={area} />
        <path className="spark-line" d={line} />
        <circle className="spark-dot" cx={lastX} cy={lastY} r="2.6" />
      </svg>
      <div className="spark-meta">
        <b>{fmtWon(trend.last)}</b>
        <span>
          {isLowest
            ? t("관찰 이래 최저")
            : diff === 0
              ? t("변동 없음")
              : `${diff > 0 ? "▲" : "▼"} ${Math.abs(percent)}%`}
        </span>
      </div>
    </div>
  );
}
