"use client";
import { useCallback, useEffect, useState } from "react";
import CaptureScreen from "@/components/CaptureScreen";
import LoadingScreen from "@/components/LoadingScreen";
import ResultScreen from "@/components/ResultScreen";
import HistoryDrawer from "@/components/HistoryDrawer";
import CellarScreen from "@/components/CellarScreen";
import Icon from "@/components/Icon";
import { downscale, stripPrefix } from "@/lib/imageClient";

export default function Home() {
  const [screen, setScreen] = useState("capture"); // capture | loading | result
  const [thumb, setThumb] = useState(null);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [noDb, setNoDb] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null); // {text, err}
  const [cellar, setCellar] = useState({ items: [], taste: null });

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
        body: JSON.stringify({ image: stripPrefix(apiImage) }),
      });
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

      setResult(data.result);
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
          body: JSON.stringify({ result: data.result, thumb: null, demo: data.demo }),
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

      {screen === "capture" && <CaptureScreen onCapture={analyze} />}
      {screen === "loading" && <LoadingScreen thumb={thumb} />}
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
          onDeepSearch={(name) => explore(name, { web: true })}
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
