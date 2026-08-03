"use client";
import { useEffect, useState } from "react";
import { t, fmtWon } from "@/lib/i18n";
import { LIVE_PRICE } from "@/lib/features";

// 같은 술의 빈티지별 최저가 비교 — 애호가가 "어느 해를 살까" 판단할 때 쓰는 카드
export default function VintageCompare({ name, keyword, currentVintage }) {
  const query = keyword || name;
  const [list, setList] = useState(null);

  // 빈티지별 가격은 판매 중인 상품에서 뽑는다 — 그 목록이 없으면 낼 수 없다
  const enabled = LIVE_PRICE;

  useEffect(() => {
    if (!query) return;
    let alive = true;
    if (!enabled) return;
    fetch(`/api/vintages?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => alive && setList(d.vintages || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [query]);

  if (!list || list.length < 2) return null;

  const max = Math.max(...list.map((v) => v.price));
  const cheapest = Math.min(...list.map((v) => v.price));

  return (
    <div className="card">
      <div className="card-title">{t("빈티지별 가격")}</div>
      <div className="vintage-list">
        {list.map((v) => {
          const isCurrent = currentVintage && String(currentVintage) === v.year;
          return (
            <a
              key={v.year}
              className={`vintage-row ${isCurrent ? "vintage-now" : ""}`}
              href={v.direct ? v.link : `https://www.coupang.com/np/search?q=${encodeURIComponent(query + " " + v.year)}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="vintage-year">
                {v.year}
                {isCurrent && <em>{t("스캔한 빈티지")}</em>}
              </span>
              <span className="vintage-bar">
                <i style={{ width: `${Math.max(8, (v.price / max) * 100)}%` }} />
              </span>
              <span className={`vintage-price ${v.price === cheapest ? "best" : ""}`}>
                {fmtWon(v.price)}
              </span>
            </a>
          );
        })}
      </div>
      <div className="shop-note">
        {t("판매 중인 상품명에서 추출한 빈티지별 최저가입니다. 작황에 따라 같은 와인도 해마다 평가가 달라집니다.")}
      </div>
    </div>
  );
}
