"use client";
import { useState } from "react";
import CatIcon from "./CatIcon";
import Flag from "./Flag";

// 메뉴가 ÷ 시중 최저가 = 배수. 와인은 통상 2~3배가 관행이다.
// (표시 전용이라 이 파일에 둔다 — 서버 모듈을 import하면 DB 드라이버가 브라우저 번들로 딸려온다)
function markupLabel(markup) {
  if (!markup) return null;
  if (markup <= 1.6) return { text: "매우 좋은 값", tone: "gold" };
  if (markup <= 2.2) return { text: "합리적", tone: "ok" };
  if (markup <= 3) return { text: "보통", tone: "dim" };
  return { text: "비싼 편", tone: "warn" };
}

const SORTS = [
  { key: "value", label: "가성비 순" },
  { key: "rating", label: "평점 순" },
  { key: "price", label: "가격 순" },
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
  const { items = [], counts, readable } = data || {};

  if (!readable || !items.length) {
    return (
      <div className="notfound">
        <div className="big">📜</div>
        <h2>리스트를 읽지 못했습니다</h2>
        <p>
          글자가 잘 보이도록 정면에서, 조금 더 가까이 찍어보세요.
          <br />
          조명이 어두우면 인식률이 크게 떨어집니다.
        </p>
        <button className="btn primary" onClick={onRescan} style={{ marginTop: 22 }}>
          다시 촬영
        </button>
      </div>
    );
  }

  const list = reorder(items, sort);

  return (
    <div className="result">
      <div className="card">
        <div className="card-title">와인 리스트</div>
        <div className="cellar-summary">
          <div>
            <b>{counts?.total ?? items.length}</b>
            <span>인식 항목</span>
          </div>
          <div>
            <b>{counts?.known ?? 0}</b>
            <span>DB 보유</span>
          </div>
          <div>
            <b>{counts?.priced ?? 0}</b>
            <span>시세 비교</span>
          </div>
        </div>
        <div className="shop-note">
          메뉴 가격을 온라인 최저가와 견주어 배수를 냅니다. 와인은 통상 시중가의 2~3배가
          관행이라, 2배 아래면 값이 좋은 편입니다.
        </div>
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
                  {it.glass && <span className="badge">잔</span>}
                </div>

                {/* 다른 표기로 이었으면 밝힌다 — 잘못 이었을 때 알아챌 수 있어야 한다 */}
                {it.matchedName && <div className="wl-matched">{it.matchedName} 으로 인식</div>}
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
                    <span className="wl-dim">평점 없음</span>
                  ) : (
                    <span className="wl-dim">DB에 없음</span>
                  )}
                  {it.market && (
                    <span className="wl-dim">시중 {it.market.toLocaleString("ko-KR")}원</span>
                  )}
                </div>
              </div>

              <div className="wl-right">
                {it.price && <b>{it.price.toLocaleString("ko-KR")}원</b>}
                {mark && <span className={`badge tone-${mark.tone}`}>{it.markup}배 · {mark.text}</span>}
                {it.known && (
                  <button className="mini-btn" onClick={() => onOpen?.(it)}>
                    자세히
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="result-actions">
        <button className="btn primary" onClick={onRescan}>
          다시 촬영
        </button>
      </div>
    </div>
  );
}
