"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import WineCard from "./WineCard";
import KindRail from "./KindRail";
import { BrandMark } from "./Brand";
import { APP, kindBottle } from "@/lib/appProfile";
import { PRICE_BANDS } from "@/lib/curation";
import { t } from "@/lib/i18n";

// 홈 — 위스키 렌즈 홈(바탕화면 whisky 저장소 app/page.js)과 같은 구성(2026-10-29 클라이언트 요구: "똑같이").
//   1. 로고 + 내 정보 · "와인 N종" 알약 · 큰 제목
//   2. 벤토 — 오늘의 술(큰 칸) · 맛있는 온도 · 인기 TOP · 내 취향 찾기 · 찾기 · 페어링 사진
//   3. 계절 배너 · 종류로 둘러보기 · 인기(두 칸 바둑판) · 처음이라면 · 가격대로
// 칸에 들어가는 말 · 사진은 앱 설정(theme.light.home)에, 술 목록은 /api/browse?home=1(lib/browse.js, 읽기만).
// 술을 누르면 이름으로 연다(DB 에 있는 정식 술만 보여 주므로 분석 비용이 없다).

const H = APP.theme.light?.home || {};
const [FIRST, ...REST] = APP.nameEn.split(" ");

export default function HomeScreen({ onOpen, onBrowse, onSearch, onQuiz, onMe, meDot = false }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/browse?home=1")
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ total: 0, popular: [], easy: [], counts: {} }));
    return () => {
      alive = false;
    };
  }, []);

  const today = data?.today;
  // 4 · 5위는 칸이 높은 넓은 화면에서만 보인다(light.css)
  const top = (data?.popular || []).slice(0, 5);
  const bandLabel = (n) => PRICE_BANDS.find((b) => b.band === n)?.label;

  return (
    <div className="page-home">
      <div className="home-top">
        <span className="home-brand">
          <BrandMark size={30} />
          <span className="home-word">
            {FIRST} <b>{REST.join(" ")}</b>
          </span>
        </span>
        <button className={`home-me ${meDot ? "has-dot" : ""}`} onClick={onMe} aria-label={t("내 정보")}>
          <Icon name="user" size={22} />
        </button>
      </div>

      <button className="home-count" onClick={() => onBrowse({})}>
        <Icon name="bottle" size={16} />
        <span>
          <b>{t("{noun} {n}종", { noun: t(H.noun), n: (data?.total ?? 0).toLocaleString() })}</b>
          {t("의 정보를 한눈에 확인해요")}
        </span>
        <Icon name="arrow" size={14} />
      </button>
      <h1 className="home-title">
        {t(H.title?.[0])}
        <br />
        {t(H.title?.[1])}
      </h1>

      <div className="bento">
        {today ? (
          <button className="bt bt-today" style={{ "--liquid": today.liquidColor || "var(--gold)" }} onClick={() => onOpen(today)}>
            <span className="bt-eyebrow">{t("오늘의 {noun}", { noun: t(H.noun) })}</span>
            <span className="bt-today-shot">
              <img src={today.image || kindBottle(today)} alt="" fetchPriority="high" />
            </span>
            <span className="bt-today-copy">
              <strong className="bt-today-name">{today.name}</strong>
              <span className="bt-today-meta">
                {[today.rating && `★ ${today.rating}`, today.country && t(today.country), today.priceBand && t(bandLabel(today.priceBand))].filter(Boolean).join(" · ")}
              </span>
              {today.note && <span className="bt-today-note">{today.note}</span>}
            </span>
            <Icon name="arrow" size={20} className="bt-go" />
          </button>
        ) : (
          <div className="bt bt-today is-loading" />
        )}

        <button className="bt bt-ratio" onClick={() => onBrowse({ kind: H.temp?.term })}>
          <Icon name="thermo" size={26} className="bt-icon" />
          <span>
            <strong className="bt-big">{H.temp?.big}</strong>
            <small>{t(H.temp?.small)}</small>
          </span>
        </button>

        <div className="bt bt-golden">
          <button className="bt-head" onClick={() => onBrowse({})}>
            <Icon name="trophy" size={26} className="bt-icon" />
            {t("인기 TOP")}
          </button>
          <ol className="bt-rank">
            {top.map((w, i) => (
              <li key={w.key}>
                <button onClick={() => onOpen(w)}>
                  <b>{i + 1}</b>
                  <span>{w.name}</span>
                  <Icon name="chevron" size={16} />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <button className="bt bt-pick" onClick={onQuiz}>
          <span className="bt-pick-shot is-photo">
            {APP.theme.light?.tastePhoto && <img src={APP.theme.light.tastePhoto} alt="" loading="lazy" decoding="async" />}
          </span>
          <span className="bt-pick-copy">
            <Icon name="glass" size={22} className="bt-icon" />
            <strong>{t("내 취향 찾기")}</strong>
            <small>{t("O·X 여덟 문항, 30초면 끝나요")}</small>
          </span>
        </button>

        <button className="bt bt-search" onClick={onSearch} aria-label={t("{noun} 이름으로 찾기", { noun: t(H.noun) })}>
          <small className="bt-search-note">{t("{n}종 가운데 이름으로 찾아요", { n: (data?.total ?? 0).toLocaleString() })}</small>
          <span className="bt-search-pill">
            <Icon name="search" size={20} />
            <span>{t("{noun} 찾기", { noun: t(H.noun) })}</span>
            <Icon name="arrow" size={18} />
          </span>
        </button>

        {H.pair && (
          <button className="bt bt-jack" onClick={() => onBrowse({ kind: H.pair.term })}>
            <img src={H.pair.photo} alt="" loading="lazy" decoding="async" />
            <span className="bt-label">
              <span>
                {t(H.pair.label)}
                <small>{t(H.pair.small)}</small>
              </span>
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </div>

      {H.banner && (
        <div className="banners">
          <button className="banner tone-sky" onClick={() => onBrowse({ kind: H.banner.term })}>
            <strong>{t(H.banner.title)}</strong>
            <span>{t(H.banner.body)}</span>
            <span className="banner-go">{t("자세히")} ›</span>
          </button>
        </div>
      )}

      <KindRail counts={data?.counts} onPick={(term) => onBrowse({ kind: term })} onAll={() => onBrowse({})} />

      <section className="section">
        <div className="section-head">
          <h2 className="h2">{t("인기 {noun}", { noun: t(H.noun) })}</h2>
          <button className="link-more" onClick={() => onBrowse({})}>{t("전체")}</button>
        </div>
        <p className="note dim">{t("데일리샷 후기가 많은 순서예요.")}</p>
        <div className="wgrid wgrid-home">
          {(data?.popular || []).map((w, i) => (
            <WineCard key={w.key} item={w} rank={i + 1} onOpen={onOpen} />
          ))}
        </div>
      </section>

      {data?.easy?.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">{t("처음이라면")}</h2>
            <button className="link-more" onClick={() => onBrowse({ easy: true })}>{t("전체")}</button>
          </div>
          <p className="note dim">{t("떫지 않고 부드러워 처음 마시기 좋아요.")}</p>
          <div className="rail">
            {data.easy.map((w) => (
              <WineCard key={w.key} item={w} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="h2">{t("가격대로")}</h2>
        <div className="chips home-chips">
          {PRICE_BANDS.map((b) => (
            <button key={b.band} className="chip" onClick={() => onBrowse({ band: b.band })}>
              {t(b.label)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
