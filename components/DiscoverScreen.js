"use client";
import { useCallback, useEffect, useState } from "react";
import TasteQuiz from "./TasteQuiz";
import { PRICE_BANDS } from "@/lib/curation";

// 발견 — 사진을 찍을 상황이 아닐 때의 진입로.
// 이름으로 찾거나, 취향 문답으로 맞춤 추천을 받거나, 묶음에서 고른다.
// 전부 우리 DB만 읽으므로 AI 비용이 들지 않는다.

function WineRow({ item, onOpen }) {
  return (
    <button className="disc-row" onClick={() => onOpen?.(item)}>
      <span className="disc-mark" style={item.liquidColor ? { background: item.liquidColor } : undefined} />
      <span className="disc-body">
        <span className="disc-name">
          {item.name}
          {item.vintage && <em> {item.vintage}</em>}
        </span>
        <span className="disc-meta">
          {[item.type, item.region || item.country].filter(Boolean).join(" · ")}
        </span>
        {item.reason && <span className="disc-reason">{item.reason}</span>}
      </span>
      <span className="disc-right">
        {item.match != null && <b>{item.match}</b>}
        {item.rating && <span className="disc-star">★ {item.rating.average.toFixed(1)}</span>}
        {item.priceBand && <span className="disc-band">{PRICE_BANDS[item.priceBand - 1]?.short}</span>}
      </span>
    </button>
  );
}

export default function DiscoverScreen({ onOpen, onToast }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const [quiz, setQuiz] = useState(false);
  const [summary, setSummary] = useState(null);
  const [answered, setAnswered] = useState(0);

  const [tab, setTab] = useState("taste"); // taste | beginner | 1..5
  const [list, setList] = useState({ loading: true, items: [], needsProfile: false });

  // 저장된 취향 요약
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary || null);
        setAnswered(d.profile?.answered || 0);
      })
      .catch(() => {});
  }, []);

  const loadList = useCallback(async (which) => {
    setList({ loading: true, items: [], needsProfile: false });
    const url =
      which === "taste"
        ? "/api/recommend?mode=taste&limit=10"
        : which === "beginner"
          ? "/api/recommend?mode=beginner&limit=10"
          : `/api/recommend?mode=price&band=${which}&limit=10`;
    try {
      const d = await (await fetch(url)).json();
      setList({ loading: false, items: d.items || [], needsProfile: !!d.needsProfile });
    } catch {
      setList({ loading: false, items: [], needsProfile: false });
    }
  }, []);

  useEffect(() => {
    loadList(tab);
  }, [tab, loadList]);

  // 검색 — 입력이 멈춘 뒤에 부른다
  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const d = await (await fetch(`/api/search?q=${encodeURIComponent(term)}`)).json();
        setResults(d.items || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="result">
      {/* 검색 */}
      <div className="card">
        <div className="card-title">이름으로 찾기</div>
        <input
          className="disc-search"
          type="search"
          value={q}
          placeholder="와인 이름 · 생산자 · 산지 (예: 샤또, 칠레, 샤르도네)"
          onChange={(e) => setQ(e.target.value)}
        />
        {results !== null && (
          <div className="disc-list">
            {searching && <div className="shop-note">찾는 중…</div>}
            {!searching && !results.length && (
              <div className="shop-note">
                DB에 없는 술입니다. 라벨을 촬영하면 분석해 드리고, 그 뒤로는 검색에도 나옵니다.
              </div>
            )}
            {results.map((it) => (
              <WineRow key={it.key} item={it} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>

      {/* 취향 문답 */}
      {quiz ? (
        <TasteQuiz
          onToast={onToast}
          onDone={(d) => {
            setQuiz(false);
            setSummary(d.summary);
            setAnswered(d.profile?.answered || 0);
            setTab("taste");
            loadList("taste");
            onToast?.("취향을 저장했습니다.");
          }}
        />
      ) : (
        <div className="card">
          <div className="card-title">나의 취향</div>
          {answered ? (
            <>
              <p className="disc-summary">{summary}</p>
              <div className="shop-note">
                여덟 문항 중 {answered}개에 답하셨습니다. 별점 기록이 쌓이면 그쪽에 점점 더 무게가 실립니다.
              </div>
            </>
          ) : (
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5, lineHeight: 1.8 }}>
              O · X 여덟 문항이면 취향에 맞는 와인을 골라 드립니다. 30초면 끝납니다.
            </p>
          )}
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setQuiz(true)}>
            {answered ? "취향 다시 고르기" : "취향 문답 시작"}
          </button>
        </div>
      )}

      {/* 추천 묶음 */}
      <div className="disc-tabs">
        <button className={`disc-tab ${tab === "taste" ? "on" : ""}`} onClick={() => setTab("taste")}>
          맞춤
        </button>
        <button className={`disc-tab ${tab === "beginner" ? "on" : ""}`} onClick={() => setTab("beginner")}>
          입문자
        </button>
        {PRICE_BANDS.map((b) => (
          <button
            key={b.band}
            className={`disc-tab ${tab === b.band ? "on" : ""}`}
            onClick={() => setTab(b.band)}
          >
            {b.short}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          {tab === "taste"
            ? "당신 취향이면 이 술"
            : tab === "beginner"
              ? "처음이라면 이 술부터"
              : `${PRICE_BANDS[tab - 1]?.label} · ${PRICE_BANDS[tab - 1]?.note}`}
        </div>

        {list.loading && <div className="shop-note">고르는 중…</div>}

        {!list.loading && list.needsProfile && (
          <div className="shop-note">
            아직 취향을 알 방법이 없습니다. 위에서 문답을 마치거나, 마신 술에 별점을 남겨 주세요.
          </div>
        )}

        {!list.loading && !list.needsProfile && !list.items.length && (
          <div className="shop-note">이 조건에 맞는 술이 아직 DB에 없습니다.</div>
        )}

        <div className="disc-list">
          {list.items.map((it) => (
            <WineRow key={it.key} item={it} onOpen={onOpen} />
          ))}
        </div>

        {tab === "taste" && list.items.length > 0 && (
          <div className="shop-note">
            우리 DB 안에서 골랐습니다. 옆의 숫자는 취향과 얼마나 가까운지를 나타냅니다.
          </div>
        )}
      </div>
    </div>
  );
}
