"use client";
import { PRICE_BANDS } from "@/lib/curation";
import { APP, kindBottle } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

// 술 카드 — 위스키 렌즈 WhiskyCard 와 같은 모양(밝은 디자인: 와인 · 사케).
// 그 술 색이 옅게 깔린 판 위에 병, 아래에 이름 · 종류 · 가격대 · 별점(데일리샷).
// 판매처 사진은 흰 바탕이라 곱하기로 판 색에 녹인다. 사진이 없으면 종류 대표 병(배경 없음).
// item 은 lib/browse.js 모양. rank 를 주면 왼쪽 위에 순위.

const KINDS = APP.theme.light?.kinds || [];
const kindOf = (item) => KINDS.find((k) => new RegExp(k.term).test(`${item.type || ""} ${item.name}`));
const kindLabel = (item) => kindOf(item)?.label;
const bandLabel = (n) => PRICE_BANDS.find((b) => b.band === n)?.label;

// 판에 깔 색 — 술 색이 DB 에 없으면(와인 대부분) 종류 카드 색으로. 앱 색으로 채우면 화이트 와인까지 분홍 판이 된다
export const liquidOf = (item) => item.liquidColor || kindOf(item)?.color || "#ece8e1";

export default function WineCard({ item, rank = null, onOpen }) {
  const bottle = item.image ? null : kindBottle(item);
  return (
    <button className="wcard" onClick={() => onOpen?.(item)}>
      <span className={`wcard-shot ${bottle ? "is-cut" : ""}`} style={{ "--liquid": liquidOf(item) }}>
        {(item.image || bottle) && <img src={item.image || bottle} alt="" loading="lazy" decoding="async" />}
        {rank && <span className="wcard-rank">{rank}</span>}
      </span>
      <strong className="wcard-name">{item.name}</strong>
      <span className="wcard-meta">{[kindLabel(item) && t(kindLabel(item)), item.priceBand && t(bandLabel(item.priceBand))].filter(Boolean).join(" · ")}</span>
      {item.rating ? (
        <span className="wcard-rate">
          ★ {item.rating}
          <small> · {t("후기 {n}", { n: item.reviews.toLocaleString() })}</small>
        </span>
      ) : null}
    </button>
  );
}
