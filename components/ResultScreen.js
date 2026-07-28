"use client";
import { useEffect, useState } from "react";
import { catOf } from "@/lib/cats";
import { servingPlan } from "@/lib/serving";
import Radar from "./Radar";
import CatIcon from "./CatIcon";
import CellarActions from "./CellarActions";
import TimerVisual from "./TimerVisual";
import ScrollTop from "./ScrollTop";
import ShareCard from "./ShareCard";
import VintageCompare from "./VintageCompare";
import CommunityRating from "./CommunityRating";

// 판매처 조회 — 히어로의 대표 이미지와 구매 정보 카드가 같은 결과를 쓴다.
// 두 곳에서 따로 부르면 같은 요청이 두 번 나가고, 화면마다 다른 상품이 잡힐 수 있다.
function useShopItems(name, keyword) {
  const cleaned = (name || "").replace(/\s*\([^)]*\)\s*/g, " ").trim(); // 괄호 병기 제거
  const noYear = cleaned.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  // AI가 준 국내 통용 표기 → 이름 → 연도 제거 이름 순으로 시도
  const candidates = [...new Set([keyword, cleaned, noYear].filter(Boolean))];
  const [state, setState] = useState({ loading: true, items: null, noApi: false });

  useEffect(() => {
    if (!candidates.length) return setState({ loading: false, items: [], noApi: false });
    let alive = true;
    setState({ loading: true, items: null, noApi: false });
    (async () => {
      for (const q of candidates) {
        try {
          const d = await fetch(`/api/shop?q=${encodeURIComponent(q)}`).then((r) => r.json());
          if (!alive) return;
          if (d.noApi) return setState({ loading: false, items: null, noApi: true });
          if (d.items?.length) {
            return setState({
              loading: false,
              items: d.items,
              noApi: false,
              reference: d.reference || null,
              sampled: d.sampled || d.items.length,
            });
          }
        } catch {
          /* 다음 후보 시도 */
        }
      }
      if (alive) setState({ loading: false, items: [], noApi: false });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.join("|")]);

  return { ...state, query: candidates[0] || "" };
}

// 구매 정보 — 네이버쇼핑 API(실제 제품 이미지·가격·구매 링크) + 검색 딥링크 폴백
function PurchaseCard({ shop }) {
  const state = shop;
  const query = shop.query;
  if (!query) return null;
  const naverLink = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`;
  const wsLink = `https://www.wine-searcher.com/find/${encodeURIComponent(query)}`;

  return (
    <div className="card">
      <div className="card-title">구매 정보</div>
      {state.loading && (
        <div className="shop-list" aria-label="판매처를 찾는 중">
          {[0, 1, 2].map((i) => (
            <div className="shop-item skel" key={i}>
              <span className="sk sk-img" />
              <span className="sk-lines">
                <span className="sk sk-line" />
                <span className="sk sk-line short" />
              </span>
              <span className="sk sk-price" />
            </div>
          ))}
        </div>
      )}
      {/* 기준 최저가 — 셀러 가치·가격 이력·특가 알림이 쓰는 것과 같은 값.
          아래 목록은 바로 살 수 있는 판매처를 앞세운 순서라 가격순이 아니므로,
          "얼마짜리 술인가"는 여기서 따로 알려 준다. */}
      {!state.loading && state.reference && (
        <div className="shop-ref">
          <div>
            <b>{state.reference.toLocaleString("ko-KR")}원</b>
            <span>기준 최저가</span>
          </div>
          <em>판매 중인 {state.sampled}건 기준 · 소용량·미끼 상품 제외</em>
        </div>
      )}

      {!state.loading && state.items?.length > 0 && (
        <div className="shop-list">
          {state.items.map((it, i) => (
            <a className="shop-item" key={i} href={it.link} target="_blank" rel="noreferrer">
              {it.image && <img className="shop-img" src={it.image} alt="" />}
              <div>
                <div className="shop-name">{it.title}</div>
                <div className="shop-mall">{it.mall}</div>
              </div>
              {it.price && (
                <div className="shop-price">
                  {it.price.toLocaleString("ko-KR")}원<small>판매가</small>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
      {!state.loading && !state.items?.length && state.noApi && (
        <div className="shop-note">
          네이버쇼핑 API 키(NAVER_CLIENT_ID/SECRET)를 설정하면 실제 제품 이미지와 최저가가 여기 표시됩니다.
        </div>
      )}
      <div className="shop-note">
        아래 목록은 가격순이 아니라, 로그인 없이 바로 구매 가능한 판매처를 앞세운 순서입니다.
        일반 주류는 온라인 주문 후 매장 픽업(스마트오더) 방식으로 구매할 수 있습니다. 가격은 판매처 사정에 따라 달라질 수 있습니다.
        {" · "}
        <a className="shop-more" href={naverLink} target="_blank" rel="noreferrer">네이버쇼핑에서 더 보기</a>
        {" · "}
        <a className="shop-more" href={wsLink} target="_blank" rel="noreferrer">Wine-Searcher</a>
      </div>
    </div>
  );
}

// 페어링 음식 → 실제 구매 가능한 상품 조회 ("오늘의 안주" 차별화 기능)
function usePairingProducts(pairs) {
  const keywords = (pairs || []).map((p) => p.shopKeyword || p.food).filter(Boolean);
  const key = keywords.join("|");
  const [map, setMap] = useState(null); // { 키워드: item|null }

  useEffect(() => {
    setMap(null);
    if (keywords.length < 2) return;
    let alive = true;
    const qs = keywords.map((k) => `q=${encodeURIComponent(k)}`).join("&");
    fetch(`/api/shop?type=food&${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.results) {
          setMap(Object.fromEntries(d.results.map((r) => [r.q, r.item])));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const found = map ? keywords.map((k) => map[k]).filter(Boolean) : [];
  return {
    map,
    total: found.reduce((sum, it) => sum + (it.price || 0), 0),
    count: found.length,
  };
}

function PairingCard({ pairs, tip, avoid }) {
  const { map, total, count } = usePairingProducts(pairs);

  return (
    <div className="card">
      <div className="card-title">푸드 페어링</div>
      <div className="pair-list">
        {pairs.map((p, i) => (
          <div className="pair" key={i}>
            <div className="emo">{p.emoji}</div>
            <div className="pair-body">
              <b>{p.food}</b>
              <span>{p.why}</span>
              {map && (
                <PairingBuy
                  item={map[p.shopKeyword || p.food]}
                  keyword={p.shopKeyword || p.food}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {count >= 2 && (
        <div className="pair-total">
          <span>안주 {count}종 함께 담으면</span>
          <b>{total.toLocaleString("ko-KR")}원</b>
        </div>
      )}
      {tip && <div className="tip-line">✦ {tip}</div>}
      {avoid && <div className="avoid-line">✕ {avoid}</div>}
    </div>
  );
}

function PairingBuy({ item, keyword }) {
  if (!item) return null;
  // 스마트스토어 링크는 브라우저에서 로그인을 요구 → 로그인 없이 열리는 검색으로 우회
  const href = item.direct
    ? item.link
    : `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword || item.title)}`;
  return (
    <a className="pair-buy" href={href} target="_blank" rel="noreferrer">
      {item.image && <img src={item.image} alt="" />}
      <span className="pair-buy-name">
        {item.title}
        <em>{item.direct ? item.mall : "쿠팡에서 검색"}</em>
      </span>
      {item.price && <span className="pair-buy-price">{item.price.toLocaleString("ko-KR")}원</span>}
    </a>
  );
}

function DrinkWindow({ from, peak, until }) {
  if (!from || !until) return null;
  const f = parseInt(from), u = parseInt(until), p = peak ? parseInt(peak) : null;
  const now = new Date().getFullYear();
  const lo = Math.min(f, now) - 1;
  const hi = Math.max(u, now) + 1;
  const pct = (y) => ((y - lo) / (hi - lo)) * 100;
  return (
    <div className="card">
      <div className="card-title">음용 적기</div>
      <div className="window-bar">
        <div className="window-fill" style={{ left: `${pct(f)}%`, right: `${100 - pct(u)}%` }} />
        <div
          style={{
            position: "absolute", top: -5, width: 3, height: 18, background: "#ece4d4",
            borderRadius: 2, left: `${pct(now)}%`,
          }}
          title="올해"
        />
      </div>
      <div className="window-years"><span>{f}</span><span>{u}</span></div>
      {p && <div className="window-peak">피크 {p}년 무렵 · 흰 눈금 = 올해({now})</div>}
    </div>
  );
}

// 유사주 추천 — 카탈로그에 이미 있는 술만 눌러서 볼 수 있게 한다.
// 없는 술을 누르면 새로 분석되어 비용이 발생하므로, 보유분만 링크로 제공한다.
function SimilarCard({ names, category, currentName, onExplore }) {
  const list = Array.isArray(names) ? names : [];
  const [ready, setReady] = useState(null); // 카탈로그에 있는 추천 목록

  useEffect(() => {
    if (!category) return;
    let alive = true;
    const qs = new URLSearchParams({
      names: list.join("|"),
      category,
      exclude: currentName || "",
    });
    fetch(`/api/catalog/similar?${qs}`)
      .then((r) => r.json())
      .then((d) => alive && setReady([...(d.matched || []), ...(d.fromCatalog || [])]))
      .catch(() => alive && setReady([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.join("|"), category, currentName]);

  if (!list.length && !ready?.length) return null;

  // 추천받았지만 아직 자료가 없는 술 — 이름만 보여준다
  const readyKeys = new Set((ready || []).map((r) => r.name));
  const notYet = list.filter((n) => !readyKeys.has(n));

  return (
    <div className="card">
      <div className="card-title">이런 술도 좋아하실 거예요</div>

      {ready?.length > 0 && (
        <div className="chip-row">
          {ready.map((s, i) => (
            <button className="chip chip-btn" key={i} onClick={() => onExplore?.(s.name)}>
              {s.name} <em>›</em>
            </button>
          ))}
        </div>
      )}

      {notYet.length > 0 && (
        <>
          {ready?.length > 0 && <div className="similar-divider" />}
          <div className="chip-row">
            {notYet.map((n, i) => (
              <span className="chip chip-plain" key={i}>
                {n}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="shop-note">
        {ready?.length > 0
          ? "금색 항목은 눌러서 바로 확인할 수 있습니다."
          : "아직 상세 자료가 준비되지 않은 술입니다."}
      </div>
    </div>
  );
}

// 디캔팅·칠링 타이머 — 애호가용 실사용 기능
function ServingTimer({ result }) {
  const [picked, setPicked] = useState(null); // 고른 항목 (아직 시작 전)
  const [run, setRun] = useState(null); // { preset, total, left }

  // 준비 시간은 술마다 다르다. 이 술에 필요한 것만 만든다.
  const plan = servingPlan(result);

  useEffect(() => {
    if (!run) return;
    if (run.left <= 0) {
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("보틀 렌즈", { body: `${run.preset.label} 완료 — ${run.preset.done}` });
      }
      setRun(null);
      return;
    }
    const t = setTimeout(() => setRun((r) => (r ? { ...r, left: r.left - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [run]);

  function start() {
    if (!picked) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const total = picked.min * 60;
    setRun({ preset: picked, total, left: total });
  }

  if (!run) {
    if (!plan.presets.length) return null;

    return (
      <div className="card">
        <div className="card-title">마시기 전 준비</div>
        <div
          className="timer-presets"
          style={{ gridTemplateColumns: `repeat(${Math.min(3, plan.presets.length)}, 1fr)` }}
        >
          {plan.presets.map((p) => (
            <button
              className={`timer-btn ${picked?.min === p.min && picked?.kind === p.kind ? "on" : ""}`}
              key={`${p.kind}-${p.min}`}
              aria-pressed={picked?.min === p.min && picked?.kind === p.kind}
              onClick={() =>
                setPicked(picked?.min === p.min && picked?.kind === p.kind ? null : p)
              }
            >
              <i className="timer-thumb">
                <TimerVisual kind={p.kind} progress={0.45} mini />
              </i>
              <b>{p.label}</b>
              <span>{p.min}분</span>
              <em>{p.hint}</em>
            </button>
          ))}
        </div>

        <button className="btn primary timer-start" disabled={!picked} onClick={start}>
          {picked ? `${picked.label} ${picked.min}분 시작` : "시간을 먼저 선택하세요"}
        </button>

        {plan.avoid && <div className="avoid-line">✕ {plan.avoid}</div>}
        {plan.note && <div className="shop-note">{plan.note}</div>}
        <div className="shop-note">시작하면 진행 상황이 눈에 보이고, 끝나면 알림과 진동으로 알려드립니다.</div>
      </div>
    );
  }

  const progress = (run.total - run.left) / run.total;
  const mm = String(Math.floor(run.left / 60)).padStart(2, "0");
  const ss = String(run.left % 60).padStart(2, "0");

  return (
    <div className="card">
      <div className="card-title">타이머</div>
      <div className="timer-run">
        <div className="timer-stage">
          <TimerVisual kind={run.preset.kind} progress={progress} />
        </div>
        <div className="timer-label">{run.preset.label} 진행 중</div>
        <div className="timer-clock">{mm}:{ss}</div>
        <div className="timer-bar">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <button className="timer-cancel" onClick={() => setRun(null)}>중단</button>
      </div>
    </div>
  );
}

// 히어로 대표 이미지.
//
// 판매처에서 찾은 실제 상품 사진을 우선 쓴다. 사용자가 찍은 사진은 조명·각도·배경이
// 제각각이라 대표 컷으로는 약하다. 상품 사진은 대개 흰 배경이라 어두운 카드 위에
// 그대로 올리면 흰 상자처럼 보이므로, 진열장처럼 밝은 판 위에 얹어 의도된 화면으로 만든다.
//
// 상품 사진 → 촬영 사진 → 주종 엠블럼 순으로 내려간다.
function HeroVisual({ result, thumb, shop }) {
  const [failed, setFailed] = useState(false);
  const product = shop.items?.find((it) => it.image)?.image || null;
  const usingProduct = !!product && !failed;
  const shown = usingProduct ? product : thumb;

  // 상품을 찾는 동안 자리를 비워 두면 화면이 튀므로 자리를 잡아 둔다
  if (shop.loading && !thumb) {
    return <div className="hero-visual is-loading" aria-hidden="true" />;
  }

  if (!shown) {
    return (
      <div className="hero-visual">
        <CatIcon category={result.category} size={124} className="hero-emblem" />
      </div>
    );
  }

  return (
    <>
      <div className={`hero-visual ${usingProduct ? "is-case" : ""}`}>
        <img
          className="hero-shot"
          src={shown}
          alt={result.name}
          onError={() => setFailed(true)}
        />
        {/* 상품 사진을 쓰는 경우, 내가 찍은 사진은 구석에 작게 남긴다 */}
        {usingProduct && thumb && (
          <img className="hero-mine" src={thumb} alt="내가 촬영한 사진" title="내가 촬영한 사진" />
        )}
      </div>
      {/* 우리가 찍은 사진이 아니라는 것을 밝힌다 */}
      {usingProduct && <div className="hero-credit">판매처 제공 이미지</div>}
    </>
  );
}

export default function ResultScreen({
  result,
  thumb,
  meta,
  onRescan,
  onExplore,
  onToast,
  onCellarChanged,
  onDeepSearch,
}) {
  const r = result;
  // 훅은 조건부로 부를 수 없으므로 이른 반환보다 위에서 부른다.
  // 히어로 이미지와 구매 정보 카드가 이 결과를 함께 쓴다.
  const shop = useShopItems(r?.found === false ? null : r?.name, r?.searchKeyword);

  if (!r || r.found === false) {
    return (
      <div className="result">
        <div className="notfound">
          {thumb && <img className="notfound-thumb" src={thumb} alt="촬영한 사진" />}
          <h2>라벨을 읽지 못했습니다</h2>
          <p>{r?.reason || "술 라벨이 잘 보이도록 다시 촬영해 주세요."}</p>
          <ul className="notfound-tips">
            <li>라벨 전체가 화면 안에 들어오게 찍어주세요</li>
            <li>글자가 흐리면 조금 더 가까이서 찍어주세요</li>
            <li>빛 반사가 심하면 각도를 살짝 틀어보세요</li>
          </ul>
        </div>
        <div className="result-actions">
          <button className="btn primary" onClick={onRescan}>다시 스캔</button>
        </div>
      </div>
    );
  }

  const cat = catOf(r.category);
  const glow = r.liquidColor || "#7a2434";

  return (
    <div className="result">
      {/* 히어로 */}
      <div className="hero">
        <div
          className="hero-glow"
          style={{ background: `radial-gradient(360px 240px at 50% 0%, ${glow}, transparent 70%)` }}
        />
        {/* 주종 엠블럼을 배경 워터마크로 */}
        <HeroVisual result={r} thumb={thumb} shop={shop} />
        <span className="hero-cat">
          <CatIcon category={r.category} size={22} />
          {cat.label}
          {r.type ? ` · ${r.type}` : ""}
        </span>
        <h1 className="hero-name">{r.name}</h1>
        <div className="hero-rule"><i>✦</i></div>
        <div className="hero-meta">
          {[r.producer, r.vintage, r.region, r.country, r.alcohol].filter(Boolean).join(" · ")}
        </div>
        <div className="badges">
          <span className={`badge ${r.knowledge === "rich" ? "gold" : ""}`}>
            {r.knowledge === "rich" ? "확실한 정보" : r.knowledge === "moderate" ? "부분 확인" : "일반 추정"}
          </span>
          {meta?.demo && <span className="badge">데모 모드</span>}
          {meta?.cached && <span className="badge">저장된 정보</span>}
          {meta?.usedWeb && <span className="badge gold">웹 검색 보강</span>}
          {meta?.webFellBack && <span className="badge">지식 기반 분석</span>}
        </div>
      </div>

      {/* 신뢰도 */}
      <div className="card">
        <div className="card-title">인식 신뢰도</div>
        <div className="meter-row">
          <div className="meter"><i style={{ width: `${r.confidence ?? 0}%` }} /></div>
          <div className="meter-val">{r.confidence ?? "–"}%</div>
        </div>
        {r.basis && <div className="basis">{r.basis}</div>}
      </div>

      {/* 사용자 평점 — 표가 쌓이기 전에는 나타나지 않는다 */}
      <CommunityRating name={r.name} vintage={r.vintage} />

      {/* 가격 */}
      {(r.priceRange || r.priceTier) && (
        <div className="card">
          <div className="card-title">예상 가격</div>
          <div className="price-line">
            <div className="price-val">{r.priceRange || "정보 없음"}</div>
            {r.priceTier && (
              <div className="tier">
                {"●".repeat(r.priceTier)}{"○".repeat(Math.max(0, 5 - r.priceTier))}
              </div>
            )}
          </div>
          {r.priceNote && <div className="price-note">{r.priceNote}</div>}
        </div>
      )}

      {/* 나의 셀러 — 담기 / 위시 / 테이스팅 노트 */}
      <CellarActions
        result={r}
        thumb={thumb}
        onToast={onToast}
        onChanged={onCellarChanged}
      />

      {/* 구매 정보 (네이버쇼핑 + 딥링크) */}
      <PurchaseCard shop={shop} />

      {/* 빈티지별 가격 비교 */}
      <VintageCompare
        name={r.name}
        keyword={r.searchKeyword}
        currentVintage={r.vintage}
      />

      {/* 플레이버 레이더 */}
      {Array.isArray(r.tasteProfile) && r.tasteProfile.length >= 3 && (
        <div className="card">
          <div className="card-title">플레이버 시그니처</div>
          <Radar profile={r.tasteProfile} />
          {r.tastingNotes && <p style={{ marginTop: 8 }}>{r.tastingNotes}</p>}
        </div>
      )}

      {/* 제원 */}
      {Array.isArray(r.specs) && r.specs.length > 0 && (
        <div className="card">
          <div className="card-title">제원</div>
          <div className="spec-grid">
            {r.specs.map((s, i) => (
              <div className="spec" key={i}><b>{s.label}</b><span>{s.value}</span></div>
            ))}
            {r.ibu != null && <div className="spec"><b>IBU</b><span>{r.ibu}</span></div>}
            {r.srm != null && <div className="spec"><b>SRM</b><span>{r.srm}</span></div>}
          </div>
        </div>
      )}

      <DrinkWindow from={r.drinkFrom} peak={r.drinkPeak} until={r.drinkUntil} />

      {/* 히스토리 */}
      {Array.isArray(r.history) && r.history.length > 0 && (
        <div className="card">
          <div className="card-title">히스토리</div>
          <div className="tl">
            {r.history.map((h, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-year">{h.year}</div>
                <div className="tl-event">{h.event}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스토리 / 생산자 */}
      {r.story && (
        <div className="card"><div className="card-title">스토리</div><p>{r.story}</p></div>
      )}
      {r.winery && (
        <div className="card"><div className="card-title">{cat.producerLabel}</div><p>{r.winery}</p></div>
      )}

      {/* 페어링 + 안주 구매 */}
      {Array.isArray(r.foodPairing) && r.foodPairing.length > 0 && (
        <PairingCard
          pairs={r.foodPairing}
          tip={r.pairingTip}
          avoid={r.avoidPairing}
          wineName={r.name}
        />
      )}

      {/* 평점 */}
      {Array.isArray(r.ratings) && r.ratings.length > 0 && (
        <div className="card">
          <div className="card-title">평점</div>
          <div className="rating-row">
            {r.ratings.map((rt, i) => (
              <div className="rating" key={i}><b>{rt.score}</b><span>{rt.source}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* 서빙 */}
      {(r.servingTemp || r.servingNote || r.aging) && (
        <div className="card">
          <div className="card-title">서빙</div>
          <div className="spec-grid">
            {r.servingTemp && <div className="spec"><b>음용 온도</b><span>{r.servingTemp}</span></div>}
            {r.aging && <div className="spec"><b>숙성</b><span>{r.aging}</span></div>}
          </div>
          {r.servingNote && <p style={{ marginTop: 10 }}>{r.servingNote}</p>}
        </div>
      )}

      {/* 서빙 타이머 */}
      <ServingTimer result={r} />

      {/* 유사주 — 카탈로그에 있는 술만 눌러서 볼 수 있다 (새 분석 비용 없음) */}
      <SimilarCard
        names={r.similar}
        category={r.category}
        currentName={r.name}
        onExplore={onExplore}
      />
      {r.trivia && (
        <div className="card"><div className="card-title">알고 마시면 더 맛있는 이야기</div><p>{r.trivia}</p></div>
      )}
      {Array.isArray(r.tips) && r.tips.length > 0 && (
        <div className="card">
          <div className="card-title">음용 팁</div>
          <ul className="tips-list">{r.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {/* 웹 검색은 기본 OFF(원가 7.5배) — 필요할 때만 사용자가 켠다 */}
      {onDeepSearch && !meta?.usedWeb && (
        <div className="card">
          <div className="card-title">정보가 부족한가요?</div>
          <p style={{ color: "var(--ink-dim)", fontSize: 13, marginBottom: 14 }}>
            웹에서 최신 시세·평점·수상 이력을 추가로 찾아 다시 분석합니다. 약 3분 걸립니다.
          </p>
          <button className="btn" style={{ width: "100%" }} onClick={() => onDeepSearch(r.name)}>
            최신 정보 더 찾기
          </button>
        </div>
      )}

      <div className="result-actions">
        {/* 공유 카드에는 판매처 이미지를 쓰지 않는다.
            우리가 만들어 배포하는 결과물이라, 남의 상품 사진과 그 위에 합성된
            타사 로고가 출처 없이 퍼지게 된다. 내가 찍은 사진이나 주종 엠블럼만 쓴다. */}
        <ShareCard result={r} thumb={thumb} onToast={onToast} />
        <button className="btn primary" onClick={onRescan}>다른 술 스캔</button>
      </div>

      <ScrollTop />
    </div>
  );
}
