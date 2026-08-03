"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

// 사용자들이 남긴 별점의 평균.
// 아직 표가 없으면 카드 자체를 숨긴다 — 빈 평점은 없느니만 못하다.
export default function CommunityRating({ name, vintage }) {
  const [rating, setRating] = useState(null);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    const query = new URLSearchParams({ name, ...(vintage ? { vintage } : {}) });
    fetch(`/api/rating?${query}`)
      .then((r) => r.json())
      .then((d) => alive && setRating(d.rating || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name, vintage]);

  if (!rating) return null;

  const { average, count, distribution } = rating;
  const max = Math.max(...distribution, 1);

  return (
    <div className="card">
      <div className="card-title">{t("사용자 평점")}</div>
      <div className="crate">
        <div className="crate-score">
          <b>{average.toFixed(1)}</b>
          <div className="crate-stars" aria-label={t("5점 만점에 {n}점", { n: average })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= Math.round(average) ? "on" : ""}>
                ★
              </span>
            ))}
          </div>
          <span className="crate-count">{t("{n}명 참여", { n: count })}</span>
        </div>

        <div className="crate-bars">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = distribution[star - 1];
            return (
              <div className="crate-bar" key={star}>
                <em>{star}</em>
                <i>
                  <span style={{ width: `${(n / max) * 100}%` }} />
                </i>
                <b>{n}</b>
              </div>
            );
          })}
        </div>
      </div>
      <div className="shop-note">
        {t("셀러에서 테이스팅 노트를 남기면 이 점수에 반영됩니다.")}
      </div>
    </div>
  );
}
