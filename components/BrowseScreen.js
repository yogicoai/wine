"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import WineCard from "./WineCard";
import { APP } from "@/lib/appProfile";
import { PRICE_BANDS } from "@/lib/curation";
import { t } from "@/lib/i18n";

// 목록 탭 — 위스키 렌즈 "위스키" 탭(app/whiskies/page.js)과 같은 구성(밝은 디자인: 와인 · 사케).
// 종류 · 처음이라면 · 가격대로 거르고 인기 · 별점 · 가격 순으로 본다. "더 보기"는 30개씩 늘린다.
// 술 목록은 /api/browse(lib/browse.js, 읽기만) — 정식 정보가 있는 술만 나온다.

const H = APP.theme.light?.home || {};
const KINDS = APP.theme.light?.kinds || [];
const SORTS = { popular: "인기순", rating: "별점순", price: "가격 낮은 순" };
const STEP = 30;

export default function BrowseScreen({ initial = {}, onOpen, onSearch }) {
  const [kind, setKind] = useState(initial.kind || null);
  const [band, setBand] = useState(initial.band || null);
  const [easy, setEasy] = useState(!!initial.easy);
  const [sort, setSort] = useState("popular");
  const [n, setN] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ sort, limit: String(STEP * n) });
    if (kind) qs.set("kind", kind);
    if (band) qs.set("band", String(band));
    if (easy) qs.set("easy", "1");
    fetch(`/api/browse?${qs}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ total: 0, items: [] }));
    return () => {
      alive = false;
    };
  }, [kind, band, easy, sort, n]);

  // 거르는 조건을 바꾸면 처음 30개부터
  const pick = (set, v) => {
    set(v);
    setN(1);
  };
  // 종류 칩 이름 중 다른 칩에 들어 있는 말("긴조" ⊂ "다이긴조")이 있어도 고른 칩 하나만 켜지게 term 으로 비교한다
  const items = data?.items || [];
  const total = data?.total ?? 0;

  return (
    <div className="page-browse">
      <h1 className="display">{t(H.noun)}</h1>
      <p className="lead">{t("{n}종 — 종류와 가격대로 골라 보세요.", { n: total.toLocaleString() })}</p>
      <button className="search-field search-link" onClick={onSearch}>
        <Icon name="search" size={22} />
        <span>{t("{noun} 이름으로 찾기", { noun: t(H.noun) })}</span>
      </button>

      <nav className="chips sticky-chips" aria-label={t("종류로 거르기")}>
        <button className={`chip ${!kind ? "is-on" : ""}`} onClick={() => pick(setKind, null)}>{t("전체")}</button>
        {KINDS.map((k) => (
          <button key={k.term} className={`chip ${kind === k.term ? "is-on" : ""}`} onClick={() => pick(setKind, k.term)}>
            {t(k.label)}
          </button>
        ))}
      </nav>

      <div className="chips" aria-label={t("가격대 · 처음이라면")}>
        <button className={`chip ${easy ? "is-on" : ""}`} onClick={() => pick(setEasy, !easy)}>{t("처음이라면")}</button>
        {PRICE_BANDS.map((b) => (
          <button key={b.band} className={`chip ${band === b.band ? "is-on" : ""}`} onClick={() => pick(setBand, band === b.band ? null : b.band)}>
            {t(b.label)}
          </button>
        ))}
      </div>

      <div className="sorts" role="group" aria-label={t("정렬")}>
        {Object.entries(SORTS).map(([key, name]) => (
          <button key={key} className={sort === key ? "is-on" : ""} onClick={() => pick(setSort, key)}>{t(name)}</button>
        ))}
      </div>

      <section className="section">
        {!data ? (
          <div className="wgrid">
            {Array.from({ length: 4 }, (_, i) => <span key={i} className="wcard-shot is-loading" />)}
          </div>
        ) : items.length ? (
          <div className="wgrid">
            {items.map((w) => (
              <WineCard key={w.key} item={w} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <p className="note dim">{t("맞는 술이 없어요. 거르는 조건을 줄여 보세요.")}</p>
        )}
        {items.length < total && (
          <button className="btn more-btn" onClick={() => setN((x) => x + 1)}>
            {t("더 보기")} ({items.length.toLocaleString()} / {total.toLocaleString()})
          </button>
        )}
      </section>
      <p className="note dim">{t("별점·후기 수는 데일리샷 기준이에요. 가격은 매장·시기마다 달라 가격대로만 적었어요.")}</p>
    </div>
  );
}
