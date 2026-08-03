"use client";
import { useEffect, useMemo, useState } from "react";
import Radar from "./Radar";
import PushToggle from "./PushToggle";
import CatIcon from "./CatIcon";
import Sparkline from "./Sparkline";
import { catOf } from "@/lib/cats";
import Flag from "./Flag";
import { drinkWindowState, cellarValue, priceTrend, priceStats, targetSuggestions } from "@/lib/cellar";
import { t, fmtWon } from "@/lib/i18n";
import { LIVE_PRICE } from "@/lib/features";

const TABS = [
  { key: "have", label: t("보유") },
  { key: "wish", label: t("위시") },
  { key: "drunk", label: t("마신 술") },
];

export default function CellarScreen({ data, onOpen, onReload, onToast }) {
  const { items = [], taste = null, noDb } = data || {};
  const [tab, setTab] = useState("have");
  const [deals, setDeals] = useState([]);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(null); // 목표가 입력 중인 항목 id
  const [targetInput, setTargetInput] = useState("");

  // 화면 진입 시 특가 확인 (오래된 항목만 조회하므로 API 부담 적음)
  useEffect(() => {
    if (noDb || !items.length) return;
    let alive = true;
    setChecking(true);
    fetch("/api/cellar/deals", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setDeals(d.deals || []);
        if (d.deals?.length) onReload?.();
      })
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noDb, items.length]);

  // 시세 갱신 — 스테일 여부를 무시하고 전부 다시 확인한다.
  // 판매처 API는 무료지만 항목 수만큼 시간이 걸리므로 사용자가 누를 때만 돈다.
  async function refreshPrices() {
    setChecking(true);
    try {
      const res = await fetch("/api/cellar/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const d = await res.json();
      if (d.noApi) {
        onToast?.(t("판매처 API 키가 설정되지 않아 시세를 확인할 수 없습니다."), true);
        return;
      }
      // 방금 돌렸으면 같은 값을 다시 긁을 뿐이다
      if (d.cooldown) {
        onToast?.(t("방금 갱신했습니다. {n}분 뒤에 다시 확인할 수 있습니다.", { n: Math.ceil(d.cooldown / 60) }));
        return;
      }
      setDeals(d.deals || []);
      onReload?.();
      onToast?.(t("{n}개 항목의 시세를 갱신했습니다.", { n: d.checked ?? 0 }));
    } catch {
      onToast?.(t("시세를 갱신하지 못했습니다."), true);
    } finally {
      setChecking(false);
    }
  }

  const grouped = useMemo(() => {
    const g = { have: [], wish: [], drunk: [] };
    for (const it of items) (g[it.status] || g.have).push(it);
    return g;
  }, [items]);

  const totalBottles = grouped.have.reduce((s, it) => s + (it.bottles || 0), 0);
  const value = useMemo(() => cellarValue(items), [items]);
  const readyNow = grouped.have.filter((it) => {
    const w = drinkWindowState(it);
    return w && (w.key === "peak" || w.key === "soon");
  });

  async function patch(id, body) {
    const res = await fetch(`/api/cellar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.saved) onReload?.();
    else onToast?.(t("저장에 실패했습니다."), true);
  }

  async function remove(id) {
    await fetch(`/api/cellar/${id}`, { method: "DELETE" });
    onReload?.();
  }

  if (noDb) {
    return (
      <div className="notfound">
        <div className="big">🗄️</div>
        <h2>{t("셀러를 쓸 수 없습니다")}</h2>
        <p>{t("MONGODB_URI가 설정되지 않았습니다. .env.local을 확인해 주세요.")}</p>
      </div>
    );
  }

  const list = grouped[tab];

  return (
    <div className="result">
      {/* 특가 알림 */}
      {deals.length > 0 && (
        <div className="card deal-card">
          <div className="card-title">{t("특가 알림")}</div>
          {deals.map((d) => (
            <a
              key={d.id}
              className="deal-row"
              href={d.link || "#"}
              target="_blank"
              rel="noreferrer"
            >
              {d.thumb && <img src={d.thumb} alt="" />}
              <div>
                <b>{d.name}</b>
                <span>
                  {d.reason === "target"
                    ? t("목표가 {n} 도달", { n: fmtWon(d.target) })
                    : t("역대 최저가 대비 하락")}
                  {d.mall ? ` · ${d.mall}` : ""}
                </span>
              </div>
              <em>{fmtWon(d.price)}</em>
            </a>
          ))}
        </div>
      )}

      {/* 요약 */}
      <div className="card">
        <div className="card-title">{t("나의 셀러")}</div>
        <div className="cellar-summary">
          <div>
            <b>{totalBottles}</b>
            <span>{t("보유 병")}</span>
          </div>
          <div>
            <b>{grouped.drunk.length}</b>
            <span>{t("마신 술")}</span>
          </div>
          <div>
            <b>{grouped.wish.length}</b>
            <span>{t("위시")}</span>
          </div>
        </div>
        {readyNow.length > 0 && (
          <div className="tip-line">
            {t("✦ 지금 마시기 좋은 술이 {n}병 있습니다 — ", { n: readyNow.length })}
            {readyNow.map((r) => r.name).slice(0, 2).join(", ")}
            {readyNow.length > 2 ? t(" 외") : ""}
          </div>
        )}
        {checking && <div className="shop-note">{t("최저가를 확인하는 중…")}</div>}
        <PushToggle onToast={onToast} />
      </div>

      {/* 셀러 가치 — 실시간 시세가 있어야 성립한다 (lib/features.js 참고).
          값을 못 가져오는 동안 "–" 만 띄워 두면 고장으로 보인다. */}
      {LIVE_PRICE && value && (
        <div className="card">
          <div className="card-title">{t("셀러 가치")}</div>

          {value.priced ? (
            <>
              <div className="value-total">
                <b>{value.total.toLocaleString("ko-KR")}</b>
                <span>{t("원")}</span>
              </div>
              <div className="value-sub">
                {t("현재 최저가 기준 · {n}병 평가 · 평균 {avg}", { n: value.priced, avg: fmtWon(value.average) })}
              </div>
            </>
          ) : (
            <>
              <div className="value-total is-empty">
                <b>–</b>
              </div>
              <div className="value-sub">
                {t("보유 {n}병 · 아직 시세를 확인하지 않았습니다", { n: value.bottles })}
              </div>
            </>
          )}

          {value.gain > 0 && (
            <div className="tip-line">
              {t("✦ 관찰된 최고가 대비 {n} 낮은 값으로 채워진 셀러입니다", { n: fmtWon(value.gain) })}
            </div>
          )}

          <button className="btn value-refresh" onClick={refreshPrices} disabled={checking}>
            {checking ? t("확인하는 중…") : t("시세 갱신")}
          </button>

          <div className="shop-note">
            {value.unpriced > 0
              ? t("{n}병은 아직 시세를 확인하지 못했습니다. 매일 자동으로 다시 확인하며, 지금 바로 채우려면 위 버튼을 누르세요.", { n: value.unpriced })
              : t("판매처 최저가를 매일 확인해 반영합니다. 실제 거래가와는 다를 수 있습니다.")}
            {" "}{t("판매처 조회는 무료라 갱신에 분석 비용이 들지 않습니다.")}
          </div>
        </div>
      )}

      {/* 취향 프로필 */}
      {taste ? (
        <div className="card">
          <div className="card-title">{t("나의 취향")}</div>
          <Radar profile={taste.axes} />
          {taste.summary && <p style={{ textAlign: "center", marginTop: 6 }}>{taste.summary}</p>}
          <div className="shop-note" style={{ textAlign: "center" }}>
            {t("별점을 남긴 {n}개 기록을 분석했습니다", { n: taste.sampleSize })}
            {taste.topCategory ? t(" · 가장 즐겨 마신 주종은 {cat}", { cat: t(catOf(taste.topCategory).label) }) : ""}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">{t("나의 취향")}</div>
          <p style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>
            {t("별점을 남긴 기록이 2개 이상 쌓이면, 선호하는 맛의 축을 분석해 보여드립니다.")}
          </p>
        </div>
      )}

      {/* 탭 */}
      <div className="cellar-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`cellar-tab ${tab === t.key ? "on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} <em>{grouped[t.key].length}</em>
          </button>
        ))}
      </div>

      {/* 목록 */}
      {!list.length && (
        <div className="empty-state">
          <img src={`/icons/cat/${tab === "wish" ? "sake" : tab === "drunk" ? "brandy" : "wine"}.png`} alt="" />
          <b>
            {tab === "have" && t("보유 중인 술이 없습니다")}
            {tab === "wish" && t("위시리스트가 비어 있습니다")}
            {tab === "drunk" && t("아직 기록한 술이 없습니다")}
          </b>
          <span>
            {tab === "have" && t("스캔한 뒤 ‘보유 중’으로 담아보세요.")}
            {tab === "wish" && t("담아두면 값이 내렸을 때 알려드립니다.")}
            {tab === "drunk" && t("‘마셨어요’로 별점과 향을 남겨보세요.")}
          </span>
        </div>
      )}

      {list.map((it) => {
        const cat = catOf(it.category);
        const win = drinkWindowState(it);
        const trend = priceTrend(it);
        const stats = priceStats(it); // 최근 6개월
        return (
          <div className="cellar-item" key={it._id}>
            <button className="cellar-main" onClick={() => onOpen?.(it._id)}>
              {it.thumb ? (
                <img className="hist-thumb" src={it.thumb} alt="" />
              ) : (
                <div className="hist-thumb">
                  <CatIcon category={it.category} size={26} />
                </div>
              )}
              <div className="cellar-info">
                <div className="hist-name">{it.name}</div>
                <div className="hist-meta">
                  <Flag country={it.country} width={15} />
                  {[t(cat.label), it.vintage, it.region].filter(Boolean).join(" · ")}
                </div>
                <div className="cellar-badges">
                  {win && (
                    <span className={`badge tone-${win.tone}`}>
                      {win.key === "early" ? t("{n}년부터", { n: parseInt(win.label) }) : t(win.label)}
                    </span>
                  )}
                  {it.rating && <span className="badge gold">{"★".repeat(it.rating)}</span>}
                  {it.notes?.length > 0 && <span className="badge">{t("노트 {n}", { n: it.notes.length })}</span>}
                  {it.priceLast && (
                    <span className="badge">{t("최저 {n}", { n: fmtWon(it.priceLast) })}</span>
                  )}
                </div>
              </div>
            </button>

            <div className="cellar-controls">
              {tab === "have" && (
                <div className="stepper">
                  <button onClick={() => patch(it._id, { bottles: (it.bottles || 0) - 1 })}>−</button>
                  <b>{t("{n}병", { n: it.bottles || 0 })}</b>
                  <button onClick={() => patch(it._id, { bottles: (it.bottles || 0) + 1 })}>+</button>
                </div>
              )}

              {editing === it._id ? (
                <div className="target-box">
                  <div className="target-edit">
                    <input
                      type="number"
                      value={targetInput}
                      placeholder={t("목표가")}
                      onChange={(e) => setTargetInput(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        await patch(it._id, { priceTarget: targetInput });
                        setEditing(null);
                      }}
                    >
                      {t("저장")}
                    </button>
                  </div>
                  {/* 빈칸에 숫자를 넣으라고만 하면 얼마를 적어야 할지 알 수 없다.
                      관찰된 최저가를 기준으로 후보를 준다. */}
                  {targetSuggestions(stats).length > 0 && (
                    <div className="target-hints">
                      {targetSuggestions(stats).map((s) => (
                        <button
                          key={s.label}
                          className="target-hint"
                          onClick={() => setTargetInput(String(s.value))}
                        >
                          {t(s.label)}
                          <em>{fmtWon(s.value)}</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 목표가는 값을 매일 확인할 수 있어야 뜻이 있다 (lib/features.js) */
                LIVE_PRICE && (
                  <button
                    className="mini-btn"
                    onClick={() => {
                      setEditing(it._id);
                      setTargetInput(it.priceTarget || "");
                    }}
                  >
                    {it.priceTarget
                      ? t("목표 {n}", { n: fmtWon(it.priceTarget) })
                      : t("목표가 설정")}
                  </button>
                )
              )}

              <button className="mini-btn danger" onClick={() => remove(it._id)}>{t("삭제")}</button>
            </div>

            {/* 가격 — 지금 값만으로는 싼지 알 수 없으므로 6개월 최저·최고를 함께 둔다.
                시세를 받을 창구가 없으면 이 칸은 영영 비어 있으므로 통째로 감춘다. */}
            {LIVE_PRICE && stats && (
              <div className="price-track">
                <div className="price-facts">
                  <div className="pf now">
                    <b>{fmtWon(stats.last)}</b>
                    <span>{t("지금 최저가")}</span>
                  </div>
                  <div className="pf">
                    <b>{fmtWon(stats.low)}</b>
                    <span>{t("6개월 최저")}</span>
                  </div>
                  {stats.high && (
                    <div className="pf">
                      <b>{fmtWon(stats.high)}</b>
                      <span>{t("6개월 최고")}</span>
                    </div>
                  )}
                </div>

                {stats.days > 0 && (
                  <div className="price-verdict">
                    {stats.isLowest
                      ? t("✦ 6개월 중 가장 쌉니다 · {n}일 관찰", { n: stats.days })
                      : t("6개월 최저보다 {p}% 높습니다 · {n}일 관찰", { p: stats.overLow, n: stats.days })}
                  </div>
                )}
                {stats.days === 0 && (
                  <div className="price-verdict dim">
                    {t("관찰을 막 시작했습니다. 내일부터 최저·최고가 쌓입니다.")}
                  </div>
                )}

                {/* 목표가까지 얼마나 남았는지 */}
                {it.priceTarget && (
                  <div className="target-gap">
                    {stats.last <= it.priceTarget ? (
                      <b className="hit">{t("목표가 도달 · 지금이 살 때입니다")}</b>
                    ) : (
                      <>
                        <i style={{ width: `${Math.min(100, (it.priceTarget / stats.last) * 100)}%` }} />
                        <span>
                          {t("목표 {target}까지 {gap}", { target: fmtWon(it.priceTarget), gap: fmtWon(stats.last - it.priceTarget) })}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {trend && <Sparkline trend={trend} />}
              </div>
            )}

            {/* 테이스팅 노트 히스토리 */}
            {it.notes?.length > 0 && (
              <div className="note-history">
                {it.notes.slice(-3).reverse().map((n, i) => (
                  <div className="note-item" key={i}>
                    <div className="note-head">
                      <span>{n.date}</span>
                      {n.rating && <b>{"★".repeat(n.rating)}</b>}
                    </div>
                    {n.aroma?.length > 0 && <div className="note-aroma">{n.aroma.map((a) => t(a)).join(" · ")}</div>}
                    {n.text && <p>{n.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
