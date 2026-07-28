"use client";
import { useCallback, useEffect, useState } from "react";
import CaptureScreen from "@/components/CaptureScreen";
import LoadingScreen from "@/components/LoadingScreen";
import ResultScreen from "@/components/ResultScreen";
import HistoryDrawer from "@/components/HistoryDrawer";
import CellarScreen from "@/components/CellarScreen";
import WineListScreen from "@/components/WineListScreen";
import DiscoverScreen from "@/components/DiscoverScreen";
import Icon from "@/components/Icon";
import { downscale, stripPrefix } from "@/lib/imageClient";

export default function Home() {
  const [screen, setScreen] = useState("capture"); // capture | loading | result | cellar | winelist
  const [wineList, setWineList] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [noDb, setNoDb] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null); // {text, err}
  const [cellar, setCellar] = useState({ items: [], taste: null });
  // 바코드를 읽었지만 아직 우리 DB에 없는 경우, 라벨 분석 결과에 이 번호를 연결해 둔다.
  // 그러면 다음 사람은 같은 술을 무료로 즉시 찾는다.
  const [pendingBarcode, setPendingBarcode] = useState(null);

  const showToast = useCallback((text, err = false) => {
    setToast({ text, err });
    setTimeout(() => setToast(null), 4000);
  }, []);

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

  async function analyze(dataUrl) {
    setScreen("loading");
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
      if (!res.ok) throw new Error(data.error || "분석 실패");

      setResult(data.result);
      setMeta({
        demo: data.demo,
        usedWeb: data.usedWeb,
        webFellBack: data.webFellBack,
        cached: data.cached,
      });
      setScreen("result");

      if (data.demo) showToast("데모 모드 — API 키를 설정하면 실제 인식이 동작합니다.");
      else if (data.cached) showToast("이미 분석된 술이라 저장된 정보로 즉시 보여드렸습니다.");
      else if (data.webDisabled)
        showToast("이 계정은 웹 검색을 지원하지 않아 모델 지식으로 분석했습니다.");

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
      showToast(err.message || "분석 중 오류가 발생했습니다.", true);
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
              ? "바코드를 정확히 읽지 못했습니다. 라벨을 촬영해 주세요."
              : "아직 등록되지 않은 바코드입니다. 라벨을 촬영하면 다음부터 바로 찾아드립니다."
          );
          return;
        }

        setResult(data.result);
        setThumb(data.image || null);
        setMeta({ cached: true, byBarcode: true });
        setScreen("result");
        window.scrollTo({ top: 0 });
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
        showToast("바코드로 찾았습니다 — 저장된 정보라 분석 비용이 들지 않았습니다.");

        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: data.result, thumb: data.image || null }),
        }).then(loadSessions);
      } catch {
        setScreen("capture");
        showToast("바코드를 조회하지 못했습니다.", true);
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
      if (!res.ok) throw new Error(data.error || "리스트를 읽지 못했습니다.");

      setWineList(data);
      setScreen("winelist");
      window.scrollTo({ top: 0 });

      if (!data.readable) showToast("리스트를 인식하지 못했습니다. 더 가까이 찍어보세요.", true);
      else if (!data.counts?.known)
        showToast("인식은 했지만 아직 DB에 없는 술들입니다. 개별 스캔으로 채워집니다.");
    } catch (err) {
      setScreen("capture");
      showToast(err.message || "리스트를 읽지 못했습니다.", true);
    }
  }

  // 리스트에서 항목 하나를 눌렀을 때 — 이름으로 상세를 연다 (DB에 있으므로 무료)
  function openListItem(item) {
    explore(item.vintage ? `${item.name} ${item.vintage}` : item.name);
  }

  // 사진 없이 이름만으로 분석 (유사주 칩 클릭 / 웹 검색 재분석)
  async function explore(name, { web = false } = {}) {
    setScreen("loading");
    setThumb(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, web }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");

      // 사진 없이 이름으로 찾은 경우, 카탈로그에 연결해 둔 판매처 상품 이미지를 대신 보여준다
      const shown = data.image || null;
      setResult(data.result);
      setThumb(shown);
      setMeta({
        demo: data.demo,
        usedWeb: data.usedWeb,
        webFellBack: data.webFellBack,
        cached: data.cached,
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
      showToast(err.message || "분석 중 오류가 발생했습니다.", true);
    }
  }

  async function openSession(id) {
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
      showToast("세션을 불러오지 못했습니다.", true);
    }
  }

  async function deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    loadSessions();
  }

  function rescan() {
    setResult(null);
    setThumb(null);
    setMeta(null);
    setWineList(null);
    setScreen("capture");
  }

  // 셀러 항목 열기 — 저장해둔 분석 결과 스냅샷을 그대로 복원
  async function openCellarItem(id) {
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
      showToast("셀러 항목을 불러오지 못했습니다.", true);
    }
  }

  return (
    <main className="app">
      <header className="hdr">
        <div>
          <div className="hdr-logo">Bottle <em>Lens</em></div>
          <div className="hdr-sub">AI Sommelier for every bottle</div>
        </div>
        <div className="hdr-btns">
          {screen !== "capture" && (
            <button className="icon-btn" title="새 스캔" aria-label="새 스캔" onClick={rescan}>
              <Icon name="camera" />
            </button>
          )}
          <button
            className={`icon-btn ${screen === "discover" ? "on" : ""}`}
            title="찾기 · 추천"
            aria-label="찾기 · 추천"
            onClick={() => setScreen(screen === "discover" ? "capture" : "discover")}
          >
            <Icon name="search" />
          </button>
          <button
            className={`icon-btn ${screen === "cellar" ? "on" : ""}`}
            title="나의 셀러"
            aria-label="나의 셀러"
            onClick={() => setScreen(screen === "cellar" ? "capture" : "cellar")}
          >
            <Icon name="glass" />
          </button>
          <button
            className="icon-btn"
            title="히스토리"
            aria-label="히스토리"
            onClick={() => setDrawer(true)}
          >
            <Icon name="archive" />
          </button>
        </div>
      </header>

      {screen === "capture" && (
        <CaptureScreen onCapture={analyze} onBarcode={scanBarcode} onWineList={scanWineList} />
      )}
      {screen === "loading" && <LoadingScreen thumb={thumb} />}
      {screen === "winelist" && (
        <WineListScreen data={wineList} onOpen={openListItem} onRescan={rescan} />
      )}
      {screen === "discover" && <DiscoverScreen onOpen={openListItem} onToast={showToast} />}
      {screen === "cellar" && (
        <CellarScreen
          data={cellar}
          onOpen={openCellarItem}
          onReload={loadCellar}
          onToast={showToast}
        />
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

      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.text}</div>}
    </main>
  );
}
