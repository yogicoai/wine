"use client";
import { useEffect, useMemo, useState } from "react";
import Radar from "./Radar";
import { catOf } from "@/lib/cats";
import { STATUSES, drinkWindowState } from "@/lib/cellar";

const TABS = [
  { key: "have", label: "보유" },
  { key: "wish", label: "위시" },
  { key: "drunk", label: "마신 술" },
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

  const grouped = useMemo(() => {
    const g = { have: [], wish: [], drunk: [] };
    for (const it of items) (g[it.status] || g.have).push(it);
    return g;
  }, [items]);

  const totalBottles = grouped.have.reduce((s, it) => s + (it.bottles || 0), 0);
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
    else onToast?.("저장에 실패했습니다.", true);
  }

  async function remove(id) {
    await fetch(`/api/cellar/${id}`, { method: "DELETE" });
    onReload?.();
  }

  if (noDb) {
    return (
      <div className="notfound">
        <div className="big">🗄️</div>
        <h2>셀러를 쓸 수 없습니다</h2>
        <p>MONGODB_URI가 설정되지 않았습니다. .env.local을 확인해 주세요.</p>
      </div>
    );
  }

  const list = grouped[tab];

  return (
    <div className="result">
      {/* 특가 알림 */}
      {deals.length > 0 && (
        <div className="card deal-card">
          <div className="card-title">특가 알림</div>
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
                    ? `목표가 ${d.target?.toLocaleString("ko-KR")}원 도달`
                    : `역대 최저가 대비 하락`}
                  {d.mall ? ` · ${d.mall}` : ""}
                </span>
              </div>
              <em>{d.price.toLocaleString("ko-KR")}원</em>
            </a>
          ))}
        </div>
      )}

      {/* 요약 */}
      <div className="card">
        <div className="card-title">나의 셀러</div>
        <div className="cellar-summary">
          <div>
            <b>{totalBottles}</b>
            <span>보유 병</span>
          </div>
          <div>
            <b>{grouped.drunk.length}</b>
            <span>마신 술</span>
          </div>
          <div>
            <b>{grouped.wish.length}</b>
            <span>위시</span>
          </div>
        </div>
        {readyNow.length > 0 && (
          <div className="tip-line">
            ✦ 지금 마시기 좋은 술이 {readyNow.length}병 있습니다 — {readyNow.map((r) => r.name).slice(0, 2).join(", ")}
            {readyNow.length > 2 ? " 외" : ""}
          </div>
        )}
        {checking && <div className="shop-note">최저가를 확인하는 중…</div>}
      </div>

      {/* 취향 프로필 */}
      {taste ? (
        <div className="card">
          <div className="card-title">나의 취향</div>
          <Radar profile={taste.axes} />
          {taste.summary && <p style={{ textAlign: "center", marginTop: 6 }}>{taste.summary}</p>}
          <div className="shop-note" style={{ textAlign: "center" }}>
            별점을 남긴 {taste.sampleSize}개 기록을 분석했습니다
            {taste.topCategory ? ` · 가장 즐겨 마신 주종은 ${catOf(taste.topCategory).label}` : ""}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">나의 취향</div>
          <p style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>
            별점을 남긴 기록이 2개 이상 쌓이면, 선호하는 맛의 축을 분석해 보여드립니다.
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
        <div className="drawer-empty">
          {tab === "have" && "보유 중인 술이 없습니다. 스캔 후 '보유 중'으로 담아보세요."}
          {tab === "wish" && "위시리스트가 비어 있습니다. 담아두면 특가를 알려드립니다."}
          {tab === "drunk" && "아직 기록한 술이 없습니다."}
        </div>
      )}

      {list.map((it) => {
        const cat = catOf(it.category);
        const win = drinkWindowState(it);
        return (
          <div className="cellar-item" key={it._id}>
            <button className="cellar-main" onClick={() => onOpen?.(it._id)}>
              {it.thumb ? (
                <img className="hist-thumb" src={it.thumb} alt="" />
              ) : (
                <div className="hist-thumb">{cat.icon}</div>
              )}
              <div className="cellar-info">
                <div className="hist-name">{it.name}</div>
                <div className="hist-meta">
                  {[cat.label, it.vintage, it.region].filter(Boolean).join(" · ")}
                </div>
                <div className="cellar-badges">
                  {win && <span className={`badge tone-${win.tone}`}>{win.label}</span>}
                  {it.rating && <span className="badge gold">{"★".repeat(it.rating)}</span>}
                  {it.notes?.length > 0 && <span className="badge">노트 {it.notes.length}</span>}
                  {it.priceLast && (
                    <span className="badge">최저 {it.priceLast.toLocaleString("ko-KR")}원</span>
                  )}
                </div>
              </div>
            </button>

            <div className="cellar-controls">
              {tab === "have" && (
                <div className="stepper">
                  <button onClick={() => patch(it._id, { bottles: (it.bottles || 0) - 1 })}>−</button>
                  <b>{it.bottles || 0}병</b>
                  <button onClick={() => patch(it._id, { bottles: (it.bottles || 0) + 1 })}>+</button>
                </div>
              )}

              {editing === it._id ? (
                <div className="target-edit">
                  <input
                    type="number"
                    value={targetInput}
                    placeholder="목표가"
                    onChange={(e) => setTargetInput(e.target.value)}
                  />
                  <button
                    onClick={async () => {
                      await patch(it._id, { priceTarget: targetInput });
                      setEditing(null);
                    }}
                  >
                    저장
                  </button>
                </div>
              ) : (
                <button
                  className="mini-btn"
                  onClick={() => {
                    setEditing(it._id);
                    setTargetInput(it.priceTarget || "");
                  }}
                >
                  {it.priceTarget
                    ? `목표 ${it.priceTarget.toLocaleString("ko-KR")}원`
                    : "목표가 설정"}
                </button>
              )}

              <button className="mini-btn danger" onClick={() => remove(it._id)}>삭제</button>
            </div>

            {/* 테이스팅 노트 히스토리 */}
            {it.notes?.length > 0 && (
              <div className="note-history">
                {it.notes.slice(-3).reverse().map((n, i) => (
                  <div className="note-item" key={i}>
                    <div className="note-head">
                      <span>{n.date}</span>
                      {n.rating && <b>{"★".repeat(n.rating)}</b>}
                    </div>
                    {n.aroma?.length > 0 && <div className="note-aroma">{n.aroma.join(" · ")}</div>}
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
