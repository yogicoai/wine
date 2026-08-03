"use client";
import { useCallback, useEffect, useState } from "react";
import CatIcon from "./CatIcon";
import TasteQuiz from "./TasteQuiz";
import { PRICE_BANDS } from "@/lib/curation";
import Flag from "./Flag";
import { t } from "@/lib/i18n";
import { DEFAULT_CATEGORY } from "@/lib/appProfile";
import { catOf } from "@/lib/cats";

// 발견 — 사진을 찍을 상황이 아닐 때의 진입로.
// 이름으로 찾거나, 취향 문답으로 맞춤 추천을 받거나, 묶음에서 고른다.
// 전부 우리 DB만 읽으므로 AI 비용이 들지 않는다.

const MOODS = [
  { key: "taste", label: t("내 취향"), title: t("당신 취향이면 이 술") },
  { key: "beginner", label: t("입문자"), title: t("처음이라면 이 술부터") },
  { key: "browse", label: t("다 보기"), title: t("우리가 아는 와인") },
];

// 판매처 상품 이미지가 있으면 쓰고, 없으면 주종 엠블럼으로 내려간다.
// 이미지는 우리가 보관하는 것이 아니라 판매처 주소를 연결만 한 것이다.
function RowThumb({ item }) {
  const [broken, setBroken] = useState(false);

  if (item.image && !broken) {
    return (
      <span className="disc-thumb">
        <img src={item.image} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="disc-thumb is-empty" style={item.liquidColor ? { "--tint": item.liquidColor } : undefined}>
      <CatIcon category={item.category} size={22} />
    </span>
  );
}

function WineRow({ item, onOpen }) {
  return (
    <button className="disc-row" onClick={() => onOpen?.(item)}>
      <RowThumb item={item} />
      <span className="disc-body">
        <span className="disc-name">
          {item.name}
          {item.vintage && <em> {item.vintage}</em>}
        </span>
        <span className="disc-meta">
          <Flag country={item.country} width={15} />
          {[item.type, item.region || item.country].filter(Boolean).join(" · ")}
        </span>
        {item.reason && <span className="disc-reason">{item.reason}</span>}
      </span>
      <span className="disc-right">
        {item.match != null && <b>{item.match}</b>}
        {item.rating && <span className="disc-star">★ {item.rating.average.toFixed(1)}</span>}
        {item.priceBand && <span className="disc-band">{t(PRICE_BANDS[item.priceBand - 1]?.short)}</span>}
      </span>
    </button>
  );
}

export default function DiscoverScreen({ onOpen, onToast }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  const [quiz, setQuiz] = useState(false);
  const [summary, setSummary] = useState(null);
  const [answered, setAnswered] = useState(0);

  // 성격과 가격은 서로 다른 축이라 따로 고른다.
  // 한 줄에 섞어 두면 "입문자용인데 5만원 이하" 를 물을 수 없는데, 그게 가장 흔한 질문이다.
  const [mood, setMood] = useState("taste"); // taste | beginner | browse
  const [band, setBand] = useState(null); // null = 전체
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

  const loadList = useCallback(async (which, priceBand) => {
    setList({ loading: true, items: [], needsProfile: false });
    const params = new URLSearchParams({ mode: which, limit: "12" });
    if (priceBand) params.set("band", String(priceBand));
    try {
      const d = await (await fetch(`/api/recommend?${params}`)).json();
      setList({
        loading: false,
        items: d.items || [],
        needsProfile: !!d.needsProfile,
        filledWith: d.filledWith || null,
      });
    } catch {
      setList({ loading: false, items: [], needsProfile: false, filledWith: null });
    }
  }, []);

  useEffect(() => {
    loadList(mood, band);
  }, [mood, band, loadList]);

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
        // 없는 것과 못 찾은 것은 다르다 — 서버가 답을 못 주면 그렇다고 말한다
        setResults(d.error ? null : d.items || []);
        setFailed(!!d.error);
      } catch {
        setResults(null);
        setFailed(true);
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
        <div className="card-title">{t("이름으로 찾기")}</div>
        <input
          className="disc-search"
          type="search"
          value={q}
          placeholder={t("{cat} 이름 · 생산자 · 산지", { cat: t(catOf(DEFAULT_CATEGORY).label) })}
          onChange={(e) => setQ(e.target.value)}
        />
        {(results !== null || failed) && (
          <div className="disc-list">
            {searching && <div className="shop-note">{t("찾는 중…")}</div>}
            {!searching && failed && (
              <div className="shop-note err">
                {t("지금은 찾을 수 없습니다. 연결을 확인하고 잠시 후 다시 시도해 주세요.")}
              </div>
            )}
            {!searching && !failed && !results?.length && (
              <div className="shop-note">
                {t("DB에 없는 술입니다. 라벨을 촬영하면 분석해 드리고, 그 뒤로는 검색에도 나옵니다.")}
              </div>
            )}
            {(results || []).map((it) => (
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
            setMood("taste");
            loadList("taste", band);
            onToast?.(t("취향을 저장했습니다."));
          }}
        />
      ) : (
        <div className="card">
          <div className="card-title">{t("나의 취향")}</div>
          {answered ? (
            <>
              <p className="disc-summary">{summary}</p>
              <div className="shop-note">
                {t("여덟 문항 중 {n}개에 답하셨습니다. 별점 기록이 쌓이면 그쪽에 점점 더 무게가 실립니다.", { n: answered })}
              </div>
            </>
          ) : (
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5, lineHeight: 1.8 }}>
              {t("O · X 여덟 문항이면 취향에 맞는 와인을 골라 드립니다. 30초면 끝납니다.")}
            </p>
          )}
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setQuiz(true)}>
            {answered ? t("취향 다시 고르기") : t("취향 문답 시작")}
          </button>
        </div>
      )}

      {/* 추천 — 성격과 가격을 따로 고른다 */}
      <div className="card disc-filters">
        <div className="filter-row">
          <span className="filter-label">{t("어떤 술을")}</span>
          <div className="filter-chips">
            {MOODS.map((m) => (
              <button
                key={m.key}
                className={`filter-chip ${mood === m.key ? "on" : ""}`}
                onClick={() => setMood(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">{t("가격은")}</span>
          <div className="filter-chips">
            <button
              className={`filter-chip ${band === null ? "on" : ""}`}
              onClick={() => setBand(null)}
            >
              {t("전체")}
            </button>
            {PRICE_BANDS.map((b) => (
              <button
                key={b.band}
                className={`filter-chip ${band === b.band ? "on" : ""}`}
                onClick={() => setBand(band === b.band ? null : b.band)}
              >
                {t(b.short)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          {MOODS.find((m) => m.key === mood)?.title}
          {band ? ` · ${t(PRICE_BANDS[band - 1]?.label)}` : ""}
        </div>

        {list.loading && <div className="shop-note">{t("고르는 중…")}</div>}

        {/* 취향을 모를 때도 목록은 채워서 내려온다. 그래서 안내는 두 갈래다 —
            채워진 게 있으면 "이건 임시"라고 알리고, 그마저 없을 때만 빈 화면을 설명한다. */}
        {!list.loading && list.needsProfile && list.items.length > 0 && (
          <div className="shop-note">
            {t("아직 취향을 몰라 우선 입문자에게 좋은 것부터 보여 드립니다. 위에서 문답을 마치면 맞춤으로 바뀝니다.")}
          </div>
        )}

        {!list.loading && list.needsProfile && !list.items.length && (
          <div className="shop-note">
            {t("아직 취향을 알 방법이 없습니다. 위에서 문답을 마치거나, 마신 술에 별점을 남겨 주세요.")}
          </div>
        )}

        {!list.loading && !list.needsProfile && !list.items.length && (
          <div className="shop-note">{t("이 조건에 맞는 술이 아직 DB에 없습니다.")}</div>
        )}

        <div className="disc-list">
          {list.items.map((it) => (
            <WineRow key={it.key} item={it} onOpen={onOpen} />
          ))}
        </div>

        {mood === "taste" && list.items.length > 0 && (
          <div className="shop-note">
            {t("우리 DB 안에서 골랐습니다. 옆의 숫자는 취향과 얼마나 가까운지를 나타냅니다.")}
          </div>
        )}
      </div>
    </div>
  );
}
