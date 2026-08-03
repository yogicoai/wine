"use client";
import { useState } from "react";
import CatIcon from "./CatIcon";
import Flag from "./Flag";
import { t, fmtWon } from "@/lib/i18n";
import { DEFAULT_CATEGORY } from "@/lib/appProfile";
import { catOf } from "@/lib/cats";

// 메뉴가 ÷ 시중 최저가 = 배수. 와인은 통상 2~3배가 관행이다.
// (표시 전용이라 이 파일에 둔다 — 서버 모듈을 import하면 DB 드라이버가 브라우저 번들로 딸려온다)
// 메뉴에 적힌 통화 그대로 보여 준다. 환율로 바꿔 주면 친절해 보이지만,
// 계산해 준 원화가 실제 결제액과 어긋나면 그게 더 나쁘다.
const CURRENCY_MARK = {
  KRW: null, // fmtWon 이 앱 언어에 맞게 처리한다
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
  TWD: "NT$",
  HKD: "HK$",
};

const CURRENCY_NAME = {
  JPY: "일본 엔",
  USD: "미국 달러",
  EUR: "유로",
  GBP: "영국 파운드",
  CNY: "중국 위안",
  TWD: "대만 달러",
  HKD: "홍콩 달러",
};

function fmtPrice(n, currency) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  if (!currency || currency === "KRW") return fmtWon(num);
  const mark = CURRENCY_MARK[currency] || "";
  return `${mark}${num.toLocaleString("en-US")}`;
}

function markupLabel(markup) {
  if (!markup) return null;
  if (markup <= 1.6) return { text: "매우 좋은 값", tone: "gold" };
  if (markup <= 2.2) return { text: "합리적", tone: "ok" };
  if (markup <= 3) return { text: "보통", tone: "dim" };
  return { text: "비싼 편", tone: "warn" };
}

const SORTS = [
  { key: "value", label: t("가성비 순") },
  { key: "rating", label: t("평점 순") },
  { key: "price", label: t("가격 순") },
];

function reorder(items, key) {
  if (key === "value") return items; // 서버가 이미 가성비 순으로 준다
  const copy = [...items];
  if (key === "rating") {
    copy.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
  } else {
    copy.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  }
  return copy;
}

export default function WineListScreen({ data, onOpen, onRescan }) {
  const [sort, setSort] = useState("value");
  const { items = [], counts, readable, currency = "KRW", currencyKnown } = data || {};

  if (!readable || !items.length) {
    return (
      <div className="notfound">
        <div className="big">📜</div>
        <h2>{t("리스트를 읽지 못했습니다")}</h2>
        <p>
          {t("글자가 잘 보이도록 정면에서, 조금 더 가까이 찍어보세요.")}
          <br />
          {t("조명이 어두우면 인식률이 크게 떨어집니다.")}
        </p>
        <button className="btn primary" onClick={onRescan} style={{ marginTop: 22 }}>
          {t("다시 촬영")}
        </button>
      </div>
    );
  }

  const list = reorder(items, sort);

  return (
    <div className="result">
      <div className="card">
        <div className="card-title">{t("{cat} 리스트", { cat: t(catOf(DEFAULT_CATEGORY).label) })}</div>
        <div className="cellar-summary">
          <div>
            <b>{counts?.total ?? items.length}</b>
            <span>{t("인식 항목")}</span>
          </div>
          <div>
            <b>{counts?.known ?? 0}</b>
            <span>{t("DB 보유")}</span>
          </div>
          <div>
            <b>{counts?.priced ?? 0}</b>
            <span>{t("시세 비교")}</span>
          </div>
        </div>
        {/* 해외 메뉴판이면 배수를 낼 수 없다. 우리 시세는 국내 판매가라
            엔·유로와는 나눌 수 없다. 없는 이유를 적어 두지 않으면 고장으로 보인다. */}
        {currency !== "KRW" ? (
          <div className="shop-note">
            {t("{c} 메뉴로 읽었습니다. 국내 시세와 통화가 달라 배수는 내지 않고, 이름만 한국어로 옮겨 정리했습니다.", {
              c: CURRENCY_NAME[currency] || currency,
            })}
          </div>
        ) : (
          <div className="shop-note">
            {t("메뉴 가격을 온라인 최저가와 견주어 배수를 냅니다. 와인은 통상 시중가의 2~3배가 관행이라, 2배 아래면 값이 좋은 편입니다.")}
          </div>
        )}
      </div>

      <div className="cellar-tabs">
        {SORTS.map((s) => (
          <button
            key={s.key}
            className={`cellar-tab ${sort === s.key ? "on" : ""}`}
            onClick={() => setSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="wl-list">
        {list.map((it, i) => {
          const mark = markupLabel(it.markup);
          return (
            <div className={`wl-row ${it.known ? "" : "is-unknown"}`} key={`${it.name}-${i}`}>
              <div className="wl-rank">{i + 1}</div>

              <div className="wl-body">
                <div className="wl-name">
                  {it.name}
                  {it.vintage && <em> {it.vintage}</em>}
                  {it.glass && <span className="badge">{t("잔")}</span>}
                </div>

                {/* 메뉴판에 인쇄된 그대로 — 손님이 그 줄을 다시 찾을 수 있어야 한다 */}
                {it.original && <div className="wl-original" lang="auto">{it.original}</div>}

                {/* 다른 표기로 이었으면 밝힌다 — 잘못 이었을 때 알아챌 수 있어야 한다 */}
                {it.matchedName && <div className="wl-matched">{t("{name} 으로 인식", { name: it.matchedName })}</div>}
                <div className="wl-meta">
                  <Flag country={it.country} width={15} />
                  {it.category && (
                    <span className="wl-cat">
                      <CatIcon category={it.category} size={13} />
                    </span>
                  )}
                  {it.rating ? (
                    <span className="wl-star">
                      ★ {it.rating.average.toFixed(1)}
                      <i>({it.rating.count})</i>
                    </span>
                  ) : it.known ? (
                    <span className="wl-dim">{t("평점 없음")}</span>
                  ) : (
                    <span className="wl-dim">{t("DB에 없음")}</span>
                  )}
                  {it.market && (
                    <span className="wl-dim">{t("시중 {n}", { n: fmtWon(it.market) })}</span>
                  )}
                </div>
              </div>

              <div className="wl-right">
                {it.price && <b>{fmtPrice(it.price, currency)}</b>}
                {mark && <span className={`badge tone-${mark.tone}`}>{t("{n}배", { n: it.markup })} · {t(mark.text)}</span>}
                {it.known && (
                  <button className="mini-btn" onClick={() => onOpen?.(it)}>
                    {t("자세히")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="result-actions">
        <button className="btn primary" onClick={onRescan}>
          {t("다시 촬영")}
        </button>
      </div>
    </div>
  );
}
