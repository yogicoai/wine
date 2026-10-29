"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import CaptureScreen from "@/components/CaptureScreen";
import LoadingScreen from "@/components/LoadingScreen";
import ResultScreen from "@/components/ResultScreen";
import HistoryDrawer from "@/components/HistoryDrawer";
import AccountDrawer from "@/components/AccountDrawer";
import { BrandMark } from "@/components/Brand";
import useActiveTimers from "@/components/useActiveTimer";
import TimerBubble from "@/components/TimerBubble";
import FirstHint from "@/components/FirstHint";
import KindRail from "@/components/KindRail";
import HomeScreen from "@/components/HomeScreen";
import BrowseScreen from "@/components/BrowseScreen";
import OfflineBanner from "@/components/OfflineBanner";
import CellarScreen from "@/components/CellarScreen";
import WineListScreen from "@/components/WineListScreen";
import DiscoverScreen from "@/components/DiscoverScreen";
import Icon from "@/components/Icon";
import { downscale, stripPrefix } from "@/lib/imageClient";
import { APP, UI } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

// 밝은 디자인(와인 · 사케) — 화면 구성과 흐름을 위스키 렌즈와 같게(2026-10-29 클라이언트 요구 "똑같이").
// 처음 화면은 홈(HomeScreen), 아래 메뉴는 홈 · 와인 · 찍기 · 셀러 · 기록, 내 정보는 홈 오른쪽 위.
// 다른 앱(맥주 · 전통주 · 스피리츠 · 위스키)은 예전 구성(처음 화면 = 촬영) 그대로다.
const LIGHT = UI === "light";
const NOUN = APP.theme.light?.home?.noun || "";
// 넓은 화면에서 가운데 좁은 칸 — 밝은 디자인만. 예전 디자인은 감싸지 않는다(.app > … 규칙이 그대로 걸리게)
const Narrow = ({ children }) => (LIGHT ? <div className="page-narrow">{children}</div> : children);

// 오류 문구는 원인을 짚어야 다음 행동이 정해진다.
// "오류가 발생했습니다"만 보면 다시 눌러야 할지 기다려야 할지 알 수 없다.
function offlineAware(err, fallback) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return t("인터넷 연결이 끊겼습니다. 연결된 뒤 다시 시도해 주세요.");
  }
  // fetch 자체가 실패하면 브라우저는 TypeError 를 던진다 (서버가 죽었거나 응답이 없음)
  if (err instanceof TypeError) {
    return t("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return err?.message || fallback;
}

export default function Home() {
  // capture | loading | result | cellar | winelist | discover — 밝은 디자인은 home · browse 가 더 있다
  const [screen, setScreen] = useState(LIGHT ? "home" : "capture");
  // 찾기에 들어갈 때의 검색어 — 탭으로 들어가면 비운다. quiz 면 취향 문답부터 연다(홈 "내 취향 찾기")
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverQuiz, setDiscoverQuiz] = useState(false);
  // 목록 탭을 열 때의 거르기({kind, band, easy}) — 홈의 종류 카드 · 가격대 · 처음이라면에서 넘어온다
  const [browseQ, setBrowseQ] = useState({});
  // 결과 화면의 뒤로 — 결과를 열기 직전 화면으로 돌아간다
  const backTo = useRef(LIGHT ? "home" : "capture");
  const [wineList, setWineList] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [noDb, setNoDb] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const [toast, setToast] = useState(null); // {text, err}
  const [cellar, setCellar] = useState({ items: [], taste: null });
  // 바코드를 읽었지만 아직 우리 DB에 없는 경우, 라벨 분석 결과에 이 번호를 연결해 둔다.
  // 그러면 다음 사람은 같은 술을 무료로 즉시 찾는다.
  const [pendingBarcode, setPendingBarcode] = useState(null);

  const showToast = useCallback((text, err = false) => {
    setToast({ text, err });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // 서빙 준비 타이머의 주인 — 어느 화면에 있든 여기서 한 번만 알린다.
  // (여러 곳이 알림을 울리면 두 번 울린다)
  const { timers: activeTimers } = useActiveTimers({ owner: true, onDone: showToast });

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
      setNoDb(!!data.noDb);
    } catch {
      /* 무시 */
    }
  }, []);

  const loadCellar = useCallback(async () => {
    try {
      const res = await fetch("/api/cellar");
      setCellar(await res.json());
    } catch {
      /* 무시 */
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadCellar();
  }, [loadSessions, loadCellar]);

  // DB 적중이면 응답이 1~2초 만에 와서 분석 연출이 뚝 끊겨 보인다.
  // 최소 이만큼은 보여 주고 결과로 넘어간다 — 화면일 뿐이라 비용은 0원이다.
  // (진짜 분석은 30초쯤 걸리므로 이 대기가 걸리는 일이 없다)
  const MIN_SCAN_SHOW = 3200;

  async function analyze(dataUrl) {
    remember();
    setScreen("loading");
    const startedAt = Date.now();
    try {
      const [apiImage, thumbImage] = await Promise.all([
        downscale(dataUrl, 1280, 0.82), // API용
        downscale(dataUrl, 320, 0.6), // 썸네일
      ]);
      setThumb(thumbImage);

      // 썸네일은 Cafe24 호스팅에 올리고 DB에는 주소만 저장 (DB 용량 절약)
      // 업로드가 안 되면 기존처럼 base64를 저장한다
      const storedThumb = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: thumbImage, prefix: "scan" }),
      })
        .then((r) => r.json())
        .then((d) => d.url || thumbImage)
        .catch(() => thumbImage);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: stripPrefix(apiImage), barcode: pendingBarcode }),
      });
      setPendingBarcode(null);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("분석 실패"));

      // 저장된 결과라 순식간에 왔으면, 연출이 한 바퀴는 돌게 잠시 붙잡는다
      const remain = MIN_SCAN_SHOW - (Date.now() - startedAt);
      if (data.cached && remain > 0) await new Promise((r) => setTimeout(r, remain));

      setResult(data.result);
      setMeta({
        demo: data.demo,
        usedWeb: data.usedWeb,
        webFellBack: data.webFellBack,
        cached: data.cached,
        partial: data.partial,
      });
      setScreen("result");

      if (data.demo) showToast(t("데모 모드 — API 키를 설정하면 실제 인식이 동작합니다."));
      else if (data.cached) showToast(t("이미 분석된 술이라 추가 비용 없이 보여드렸습니다."));
      else if (data.webDisabled)
        showToast(t("이 계정은 웹 검색을 지원하지 않아 모델 지식으로 분석했습니다."));

      // 세션 저장 (found 여부와 무관하게 결과가 있으면 저장)
      if (data.result?.found !== false) {
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: data.result, thumb: storedThumb, demo: data.demo }),
        }).then(loadSessions);
      }
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    } catch (err) {
      setScreen("capture");
      showToast(offlineAware(err, t("분석 중 오류가 발생했습니다.")), true);
    }
  }

  // 바코드로 찾기 — AI를 부르지 않으므로 비용이 들지 않는다.
  // 우리 DB에 없는 번호면 라벨 촬영으로 넘기고, 분석이 끝난 뒤 번호를 연결해 둔다.
  const scanBarcode = useCallback(
    async (code) => {
      setScreen("loading");
      setThumb(null);
      try {
        const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (!data.found) {
          setPendingBarcode(data.reason === "invalid" ? null : data.code || code);
          setScreen("capture");
          showToast(
            data.reason === "invalid"
              ? t("바코드를 정확히 읽지 못했습니다. 라벨을 촬영해 주세요.")
              : t("아직 등록되지 않은 바코드입니다. 라벨을 촬영하면 다음부터 바로 찾아드립니다.")
          );
          return;
        }

        setResult(data.result);
        setThumb(data.image || null);
        setMeta({ cached: true, byBarcode: true });
        setScreen("result");
        window.scrollTo({ top: 0 });
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
        showToast(t("바코드로 찾았습니다 — 저장된 정보라 분석 비용이 들지 않았습니다."));

        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: data.result, thumb: data.image || null }),
        }).then(loadSessions);
      } catch {
        setScreen("capture");
        showToast(t("바코드를 조회하지 못했습니다."), true);
      }
    },
    [showToast, loadSessions]
  );

  // 와인 리스트(메뉴판) 한 장을 통째로 읽는다.
  // 저비용 모델 1회 호출이면 끝이라, 항목이 몇 개든 원가는 같다.
  async function scanWineList(dataUrl) {
    setScreen("loading");
    setThumb(await downscale(dataUrl, 320, 0.6));
    try {
      // 메뉴판은 잔글씨라 라벨보다 크게 보낸다
      const apiImage = await downscale(dataUrl, 1600, 0.85);
      const res = await fetch("/api/winelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: stripPrefix(apiImage) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("리스트를 읽지 못했습니다."));

      setWineList(data);
      setScreen("winelist");
      window.scrollTo({ top: 0 });

      if (!data.readable) showToast(t("리스트를 인식하지 못했습니다. 더 가까이 찍어보세요."), true);
      else if (!data.counts?.known)
        showToast(t("인식은 했지만 아직 DB에 없는 술들입니다. 개별 스캔으로 채워집니다."));
    } catch (err) {
      setScreen("capture");
      showToast(offlineAware(err, t("리스트를 읽지 못했습니다.")), true);
    }
  }

  // 리스트에서 항목 하나를 눌렀을 때 — 이름으로 상세를 연다 (DB에 있으므로 무료)
  // 목록의 판매처 정보만 있는 술(item.stub)은 AI 없이 아는 정보만 받는다
  function openListItem(item) {
    explore(item.vintage ? `${item.name} ${item.vintage}` : item.name, { stubOk: !!item.stub });
  }

  // 사진 없이 이름만으로 분석 (유사주 칩 클릭 / 웹 검색 재분석)
  async function explore(name, { web = false, stubOk = false } = {}) {
    remember();
    setScreen("loading");
    setThumb(null);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, web, ...(stubOk ? { stubOk: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("분석 실패"));

      // 저장된 결과라 순식간에 왔으면, 연출이 한 바퀴는 돌게 잠시 붙잡는다 (비용 0원)
      const remain = MIN_SCAN_SHOW - (Date.now() - startedAt);
      if (data.cached && remain > 0) await new Promise((r) => setTimeout(r, remain));

      // 사진 없이 이름으로 찾은 경우, 카탈로그에 연결해 둔 판매처 상품 이미지를 대신 보여준다
      const shown = data.image || null;
      setResult(data.result);
      setThumb(shown);
      setMeta({
        demo: data.demo,
        usedWeb: data.usedWeb,
        webFellBack: data.webFellBack,
        cached: data.cached,
        partial: data.partial,
        byName: true,
      });
      setScreen("result");
      window.scrollTo({ top: 0 });

      if (data.result?.found !== false) {
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: data.result, thumb: shown, demo: data.demo }),
        }).then(loadSessions);
      }
    } catch (err) {
      setScreen("result");
      showToast(offlineAware(err, t("분석 중 오류가 발생했습니다.")), true);
    }
  }

  async function openSession(id) {
    remember();
    setDrawer(false);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.session.result);
      setThumb(data.session.thumb);
      setMeta({ demo: data.session.demo, fromHistory: true });
      setScreen("result");
    } catch {
      showToast(t("세션을 불러오지 못했습니다."), true);
    }
  }

  async function deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    loadSessions();
  }

  /**
   * 화면을 옮긴다.
   *
   * 서랍(기록·내 정보)은 화면 위에 덮여 뜬다. 그래서 화면만 바꾸면 뒤에서
   * 바뀌고 서랍은 그대로 남는다 — 기록을 열어 둔 채 "찾기"를 눌러도 기록이
   * 덮고 있어 무엇을 눌렀는지 알 수 없었다. 옮길 때는 반드시 함께 닫는다.
   */
  function go(next) {
    setDrawer(false);
    setAccount(false);
    setScreen(next);
  }

  // 찾기 화면을 연다 — term 이 있으면 그 말로 찾아 둔다
  function openKind(term) {
    setDiscoverQ(term);
    setDiscoverQuiz(false);
    go("discover");
    window.scrollTo({ top: 0 });
  }

  // 홈 "내 취향 찾기" — 찾기 화면을 취향 문답부터 연다
  function openQuiz() {
    setDiscoverQ("");
    setDiscoverQuiz(true);
    go("discover");
    window.scrollTo({ top: 0 });
  }

  // 목록 탭 — 홈의 종류 카드 · 가격대 · 처음이라면에서 넘어오면 그 조건으로 걸러 연다
  function openBrowse(q = {}) {
    setBrowseQ(q);
    go("browse");
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    go("home");
    window.scrollTo({ top: 0 });
  }

  // 결과를 열기 직전 화면을 기억한다 — 결과 화면의 뒤로가 그리로 간다
  function remember() {
    if (screen !== "loading" && screen !== "result") backTo.current = screen;
  }

  function goBack() {
    go(backTo.current || (LIGHT ? "home" : "capture"));
    window.scrollTo({ top: 0 });
  }

  function rescan() {
    setResult(null);
    setThumb(null);
    setMeta(null);
    setWineList(null);
    go("capture");
  }

  // 셀러 항목 열기 — 저장해둔 분석 결과 스냅샷을 그대로 복원
  async function openCellarItem(id) {
    remember();
    try {
      const res = await fetch(`/api/cellar/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.item.result);
      setThumb(data.item.thumb);
      setMeta({ fromCellar: true });
      setScreen("result");
      window.scrollTo({ top: 0 });
    } catch {
      showToast(t("셀러 항목을 불러오지 못했습니다."), true);
    }
  }

  return (
    <main className="app">
      {/* 끊기면 버튼이 안 먹는 게 아니라 왜 안 되는지 보여야 한다 */}
      <OfflineBanner />

      {/* 밝은 디자인 — 위쪽 이름 줄이 어느 화면이든 따라온다(2026-10-29 클라이언트 "어딜 들어가도 상단 로고 따라 다니게").
          왼쪽 로고(누르면 홈), 오른쪽 내 정보. 결과 화면에서는 로고 앞에 뒤로 단추. PC 는 위쪽 메뉴 줄이 대신한다(light.css) */}
      {LIGHT && (
        <header className="topbar">
          {screen === "result" && (
            <button className="topbar-back" onClick={goBack} aria-label={t("뒤로")}>
              <Icon name="back" size={22} stroke={1.9} />
            </button>
          )}
          <button className="topbar-brand" onClick={goHome} aria-label={t("홈")}>
            <BrandMark size={28} />
            <span className="home-word">
              {APP.nameEn.split(" ")[0]} <b>{APP.nameEn.split(" ").slice(1).join(" ")}</b>
            </span>
          </button>
          <button
            className={`home-me ${activeTimers.length > 0 ? "has-dot" : ""}`}
            onClick={() => { setDrawer(false); setAccount(true); }}
            aria-label={t("내 정보")}
          >
            <Icon name="user" size={22} />
          </button>
        </header>
      )}
      {!LIGHT && <header className="hdr">
        {/* 로고는 어디서든 처음 화면으로 돌아가는 길이다 (촬영 아이콘을 따로 두지 않는 이유) */}
        <button className="hdr-home" onClick={rescan} aria-label={t("처음 화면으로")}>
          {/* 워드마크 이미지는 두 줄로 쌓인 형태라 헤더 높이로 줄이면 글자가 뭉개진다.
              심볼만 이미지로 쓰고 글자는 조판한다. 워드마크는 여백이 있는 곳에서 쓴다. */}
          <BrandMark size={38} />
          <span className="hdr-lockup">
            {/* 워드마크는 로고다 — 화면 언어와 무관하게 영문으로 통일한다.
                본문이 한국어라도 여기는 바꾸지 않는다 (브랜드 표기) */}
            <span className="hdr-logo">
              {APP.nameEn.split(" ")[0]} <em>{APP.nameEn.split(" ").slice(1).join(" ")}</em>
            </span>
            <span className="hdr-sub">{APP.motto}</span>
          </span>
          {/* 낙관 — 일본풍 앱의 서명. theme.seal 이 있을 때만 찍힌다 */}
          {APP.theme.seal && <span className="hdr-seal">{APP.theme.seal}</span>}
        </button>
      </header>}

      {screen === "home" && (
        <HomeScreen onOpen={openListItem} onBrowse={openBrowse} onSearch={() => openKind("")} onQuiz={openQuiz} />
      )}
      {screen === "browse" && (
        <BrowseScreen key={JSON.stringify(browseQ)} initial={browseQ} onOpen={openListItem} onSearch={() => openKind("")} />
      )}

      {screen === "capture" && (LIGHT ? (
        // 찍기 탭 — 위스키 렌즈 "라벨 찍기"와 같게: 제목 · 촬영 판 · 아래 이름으로 찾기.
        // 넓은 화면에서도 촬영 판이 화면 가득 커지지 않게 가운데 좁은 칸(page-narrow)에 둔다 — 찾기 · 셀러도 같다
        <div className="page-narrow">
          <h1 className="display">{t("라벨 찍기")}</h1>
          <p className="lead">{t("병 앞면 라벨을 찍으면 어떤 {noun}인지 읽어 정보·가격대·페어링을 찾아 드려요.", { noun: t(NOUN) })}</p>
          <CaptureScreen onCapture={analyze} onBarcode={scanBarcode} onWineList={scanWineList} />
          <section className="section">
            <h2 className="h2">{t("이름으로 찾기")}</h2>
            <button className="search-field search-link" onClick={() => openKind("")}>
              <Icon name="search" size={22} />
              <span>{t("{noun} 이름 · 생산자 · 산지", { noun: t(NOUN) })}</span>
            </button>
          </section>
        </div>
      ) : (
        <>
          <CaptureScreen onCapture={analyze} onBarcode={scanBarcode} onWineList={scanWineList} />
          <KindRail onPick={openKind} />
          {/* 처음 온 사람에게만 한 번 — 닫으면 다시 나오지 않는다 */}
          <FirstHint onOpenDiscover={() => openKind("")} />
        </>
      ))}
      {screen === "loading" && <LoadingScreen thumb={thumb} />}
      {screen === "winelist" && (
        <WineListScreen data={wineList} onOpen={openListItem} onRescan={rescan} />
      )}
      {screen === "discover" && (
        <Narrow>
          {LIGHT && <h1 className="display">{t("{noun} 찾기", { noun: t(NOUN) })}</h1>}
          <DiscoverScreen
            key={`${discoverQ}|${discoverQuiz}`}
            initialQuery={discoverQ}
            initialQuiz={discoverQuiz}
            onOpen={openListItem}
            onToast={showToast}
          />
        </Narrow>
      )}
      {screen === "cellar" && (
        <Narrow>
          {LIGHT && <h1 className="display">{t("셀러")}</h1>}
          <CellarScreen
            data={cellar}
            onOpen={openCellarItem}
            onReload={loadCellar}
            onToast={showToast}
          />
        </Narrow>
      )}
      {/* 결과 화면의 뒤로 — PC 에서만 본문 맨 위에 둔다. 폰 · 태블릿은 위쪽 이름 줄 안의 뒤로 단추를 쓴다 */}
      {screen === "result" && LIGHT && (
        <button className="back-float" onClick={goBack} aria-label={t("뒤로")}>
          <Icon name="back" size={22} stroke={1.9} />
        </button>
      )}
      {screen === "result" && (
        <ResultScreen
          result={result}
          thumb={thumb}
          meta={meta}
          onRescan={rescan}
          onExplore={explore}
          onToast={showToast}
          onCellarChanged={loadCellar}
          // 웹 검색은 스캔당 원가가 7배로 뛰고 3분이 걸려 기본은 숨긴다.
          // 쓰려면 NEXT_PUBLIC_DEEP_SEARCH=1 (+ 서버의 DEEP_SEARCH=1) 로 켠다.
          onDeepSearch={
            process.env.NEXT_PUBLIC_DEEP_SEARCH === "1"
              ? (name) => explore(name, { web: true })
              : undefined
          }
        />
      )}

      <HistoryDrawer
        open={drawer}
        sessions={sessions}
        noDb={noDb}
        onClose={() => setDrawer(false)}
        onOpenSession={openSession}
        onDelete={deleteSession}
      />

      <AccountDrawer
        open={account}
        onClose={() => setAccount(false)}
        onOpenCellar={() => go("cellar")}
        onOpenWine={(name) => explore(name)}
        onToast={showToast}
      />

      {/* 진행 중인 준비 — 어느 화면에 있든 떠 있고, 누르면 자세히 볼 수 있다 */}
      <TimerBubble onOpen={() => { setDrawer(false); setAccount(true); }} />

      {/* 아래 탭 — 화면 위쪽 아이콘 줄을 대신한다.
          한 손으로 쥔 폰에서 엄지가 닿는 곳은 위가 아니라 아래다.
          어디에 무엇이 있는지도 글자로 보여 준다 (아이콘만으로는 알 수 없었다) */}
      {LIGHT ? (
        // 밝은 디자인 — 위스키 렌즈와 같은 다섯 칸(홈 · 술 · 찍기 · 모아 두는 곳 둘). 내 정보는 홈 오른쪽 위.
        // PC(가로 1080px~)에서는 같은 칸이 위쪽 메뉴 줄이 된다 — 왼쪽 이름, 오른쪽 메뉴, 끝에 "찍기" 단추와 내 정보(light.css)
        <nav className="tabbar" aria-label={t("주요 이동")}>
          <button className="tabbar-brand" onClick={goHome} aria-label={t("홈")}>
            <BrandMark size={28} />
            <span className="home-word">
              {APP.nameEn.split(" ")[0]} <b>{APP.nameEn.split(" ").slice(1).join(" ")}</b>
            </span>
          </button>
          <button className={`tab ${screen === "home" ? "on" : ""}`} onClick={goHome}>
            <Icon name="home" />
            <span>{t("홈")}</span>
          </button>
          <button className={`tab ${screen === "browse" ? "on" : ""}`} onClick={() => openBrowse({})}>
            <Icon name="glass" />
            <span>{t(NOUN)}</span>
          </button>
          <button className={`tab tab-primary ${screen === "capture" || screen === "loading" ? "on" : ""}`} onClick={rescan}>
            <Icon name="camera" />
            <span>{t("찍기")}</span>
          </button>
          <button className={`tab ${screen === "cellar" ? "on" : ""}`} onClick={() => go("cellar")}>
            <Icon name="bottle" />
            <span>{t("셀러")}</span>
          </button>
          <button className={`tab ${drawer ? "on" : ""}`} onClick={() => { setAccount(false); setDrawer(true); }}>
            <Icon name="archive" />
            <span>{t("기록")}</span>
          </button>
          <button
            className={`tab tab-acct ${activeTimers.length > 0 ? "has-dot" : ""}`}
            onClick={() => { setDrawer(false); setAccount(true); }}
            aria-label={t("내 정보")}
          >
            <Icon name="user" />
          </button>
        </nav>
      ) : (
      <nav className="tabbar" aria-label={t("주요 이동")}>
        <button
          className={`tab ${screen === "capture" || screen === "loading" ? "on" : ""}`}
          onClick={rescan}
        >
          <Icon name="camera" />
          <span>{t("스캔")}</span>
        </button>
        <button
          className={`tab ${screen === "discover" ? "on" : ""}`}
          onClick={() => openKind("")}
        >
          <Icon name="search" />
          <span>{t("찾기")}</span>
        </button>
        <button
          className={`tab ${screen === "cellar" ? "on" : ""}`}
          onClick={() => go("cellar")}
        >
          <Icon name="glass" />
          <span>{t("셀러")}</span>
        </button>
        {/* 서랍 둘이 겹쳐 뜨면 안 된다 — 하나를 열 때 다른 하나를 닫는다 */}
        <button className="tab" onClick={() => { setAccount(false); setDrawer(true); }}>
          <Icon name="archive" />
          <span>{t("기록")}</span>
        </button>
        <button
          className={`tab ${activeTimers.length ? "has-dot" : ""}`}
          onClick={() => { setDrawer(false); setAccount(true); }}
          aria-label={
            activeTimers.length
              ? t("내 정보 · 준비 {n}건 진행 중", { n: activeTimers.length })
              : t("내 정보")
          }
        >
          <Icon name="user" />
          <span>{t("내 정보")}</span>
        </button>
      </nav>
      )}

      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.text}</div>}
    </main>
  );
}
