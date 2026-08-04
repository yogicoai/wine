"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

// 요즘 많이 찾는 술.
//
// "뜬다/진다"라고 적지 않는다. 데이터랩은 기간을 어떻게 잡느냐에 따라 방향이
// 뒤집힌다 — 5~7월로 보면 사케가 오르고 2~7월로 보면 내린다. 술 검색은 겨울에
// 높고 여름에 낮기 때문이다. 그래서 순위와 여섯 달치 모양만 보이고, 오르내림의
// 해석은 보는 사람에게 맡긴다.
export default function TrendCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/trend")
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  const items = data?.items || [];
  if (!items.length) return null;
  const top = items[0].ratio || 1;

  return (
    <div className="card">
      <div className="card-title">{t("요즘 많이 찾는")}</div>
      <div className="trend-list">
        {items.map((it, i) => (
          <div className="trend-row" key={i}>
            <span className="trend-name">{it.name}</span>
            <TrendLine points={it.points} />
            <span className="trend-bar">
              <i style={{ width: `${Math.max(6, (it.ratio / top) * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
      <div className="shop-note">
        {t("네이버 검색 관심도 · 최근 6개월 · 다섯 가지를 서로 견준 상대값입니다")}
      </div>
    </div>
  );
}

// 여섯 달 모양만 보여 주는 아주 작은 선. 축도 눈금도 없다 — 흐름만 읽으면 된다.
function TrendLine({ points }) {
  if (!points || points.length < 2) return <span className="trend-spark" />;
  const w = 44;
  const h = 16;
  const max = Math.max(...points) || 1;
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - ((p - min) / span) * (h - 3) - 1.5).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="trend-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
