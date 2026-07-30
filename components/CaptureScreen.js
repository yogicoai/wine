"use client";
import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/imageClient";
import { scanLoop } from "@/lib/barcodeScan";
import { BARCODE_SCAN } from "@/lib/features";
import Icon from "./Icon";

// 모드 이름만으로는 무엇을 찍어야 할지 알 수 없다.
// 특히 "와인 리스트"는 병을 여러 개 찍으라는 뜻으로 읽히기 쉬워 분명히 적는다.
const MODE_NOTES = {
  label: "술병 앞면 라벨 한 장. 이름을 읽어 정보·가격·페어링을 찾아드립니다.",
  barcode: "병 뒷면 바코드. 셔터 없이 자동으로 읽고, 분석 비용이 들지 않습니다.",
  list: "식당 메뉴판이나 와인 리스트를 한 장. 적힌 술을 모두 뽑아 가성비 순으로 정리합니다. 병을 여러 개 찍는 것이 아니라 글자가 적힌 목록을 찍는 기능입니다.",
};

export default function CaptureScreen({ onCapture, onBarcode, onWineList }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState("label"); // label | barcode | list
  const [scanState, setScanState] = useState(null); // loading | scanning | error

  // 카메라는 화면에 들어오자마자 켜지 않는다.
  // 사용자가 촬영을 시작할 때 권한을 요청해야 거부감이 적고, 배터리·발열에도 낫다.
  async function startCamera() {
    if (stream || starting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("이 브라우저는 카메라를 지원하지 않습니다. 사진을 업로드해 주세요.");
      return;
    }
    setStarting(true);
    setCamError(null);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      setStream(acquired);
    } catch (err) {
      setCamError(
        err?.name === "NotAllowedError"
          ? "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용하거나 사진을 업로드해 주세요."
          : "카메라를 사용할 수 없습니다. 사진을 업로드해 주세요."
      );
    } finally {
      setStarting(false);
    }
  }

  // 화면을 벗어나면 카메라를 반드시 끈다 (표시등이 계속 켜져 있으면 불안하다)
  useEffect(() => {
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  // 2) 스트림을 video에 연결 — video 요소는 항상 렌더되므로 교체될 일이 없다.
  //    (조건부로 두 번 렌더하면 스트림을 붙인 요소가 사라져 검은 화면이 된다)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true; // iOS 자동재생 조건 — 속성만으로는 적용되지 않는 경우가 있다
    video.setAttribute("playsinline", "");

    const play = () => video.play().catch(() => {});
    play();
    // iOS에서 첫 play()가 무시되면 메타데이터 로드 후 한 번 더 시도
    video.addEventListener("loadedmetadata", play);
    return () => video.removeEventListener("loadedmetadata", play);
  }, [stream]);

  // 바코드 모드에서는 셔터를 누를 필요 없이 계속 읽는다.
  // 바코드로 찾으면 AI를 부르지 않으므로 비용도 대기 시간도 없다.
  useEffect(() => {
    if (mode !== "barcode" || !stream || !onBarcode) {
      setScanState(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let done = false;
    const stop = scanLoop(
      video,
      (code) => {
        if (done) return;
        done = true;
        if (navigator.vibrate) navigator.vibrate(60);
        onBarcode(code);
      },
      { onStatus: setScanState }
    );
    return stop;
  }, [mode, stream, onBarcode]);

  // 셔터: 카메라가 꺼져 있으면 먼저 켜고, 켜져 있으면 촬영한다
  function onShutter() {
    if (!stream) return startCamera();
    if (mode === "barcode") return setMode("label"); // 바코드가 안 읽히면 라벨 촬영으로
    shoot();
  }

  // 붙여넣기 리스너는 마운트 때 한 번만 등록되므로 그때의 mode에 묶인다.
  // 현재 모드를 ref로 읽어 항상 최신 값을 쓰게 한다.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // 지금 모드에 맞는 처리로 보낸다 (라벨 분석 / 리스트 판독)
  function deliver(dataUrl) {
    if (modeRef.current === "list" && onWineList) onWineList(dataUrl);
    else onCapture(dataUrl);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    if (navigator.vibrate) navigator.vibrate(30);
    deliver(canvas.toDataURL("image/jpeg", 0.92));
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    deliver(await fileToDataUrl(file));
  }

  // 클립보드 붙여넣기
  useEffect(() => {
    function onPaste(e) {
      const item = [...(e.clipboardData?.items || [])].find((i) =>
        i.type.startsWith("image/")
      );
      if (item) handleFile(item.getAsFile());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = !!stream;

  return (
    <div
      className={dragging ? "dragover" : ""}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      {onBarcode && (
        <div className="mode-switch" role="tablist" aria-label="인식 방식">
          <button
            role="tab"
            aria-selected={mode === "label"}
            className={mode === "label" ? "on" : ""}
            onClick={() => setMode("label")}
          >
            라벨 촬영
          </button>
          {/* 바코드는 대조표가 없어 지금 내보내지 않는다 (lib/features.js) */}
          {BARCODE_SCAN && (
            <button
              role="tab"
              aria-selected={mode === "barcode"}
              className={mode === "barcode" ? "on" : ""}
              onClick={() => {
                setMode("barcode");
                if (!stream) startCamera();
              }}
            >
              바코드
            </button>
          )}
          {onWineList && (
            <button
              role="tab"
              aria-selected={mode === "list"}
              className={mode === "list" ? "on" : ""}
              onClick={() => setMode("list")}
            >
              와인 리스트
            </button>
          )}
        </div>
      )}

      {/* 무엇을 찍으라는 것인지 먼저 알려 준다.
          모드 이름만으로는 "와인 리스트"가 병 여러 개인지 메뉴판인지 알 수 없다. */}
      {onBarcode && <p className="mode-note">{MODE_NOTES[mode]}</p>}

      <div className="cam-frame">
        {/* 항상 렌더 — 준비 전에는 숨기기만 한다 */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={live ? "cam-video" : "cam-video is-hidden"}
        />

        {live ? (
          <>
            <div
              className={`cam-guide ${mode === "barcode" ? "is-barcode" : ""} ${
                mode === "list" ? "is-list" : ""
              }`}
            />
            <div className={`cam-guide-txt ${scanState === "error" ? "err" : ""}`}>
              {mode === "barcode"
                ? scanState === "loading"
                  ? "바코드 인식기를 불러오는 중…"
                  : scanState === "error"
                    ? "이 브라우저에서 바코드 인식을 쓸 수 없습니다 — 라벨 촬영을 이용해 주세요"
                    : "병 뒷면 바코드를 선 안에 맞춰주세요"
                : mode === "list"
                  ? "메뉴판 전체가 들어오도록 정면에서 찍어주세요"
                  : "라벨이 프레임 안에 오도록 맞춰주세요"}
            </div>
          </>
        ) : (
          <div className="cam-fallback">
            <div className="big">
              <Icon name="camera" size={44} stroke={1.2} />
            </div>
            {camError ? (
              <div className="cam-msg err">{camError}</div>
            ) : mode === "list" ? (
              <div className="cam-msg">
                식당 와인 리스트를 찍으면
                <br />
                가성비 순으로 정리해 드립니다.
              </div>
            ) : mode === "barcode" ? (
              <div className="cam-msg">
                병 뒷면 바코드를 비추면
                <br />
                바로 찾아드립니다.
              </div>
            ) : (
              <div className="cam-msg">
                술병 라벨을 찍으면
                <br />
                AI가 바로 읽어드립니다.
              </div>
            )}
            <button className="cam-start" onClick={startCamera} disabled={starting}>
              {starting ? "카메라 여는 중…" : camError ? "다시 시도" : "카메라 켜기"}
            </button>
            <button className="cam-alt" onClick={() => fileRef.current?.click()}>
              사진으로 올리기
            </button>
          </div>
        )}
      </div>

      <div className="cap-actions">
        <button
          className="side-btn"
          title="갤러리에서 선택"
          aria-label="갤러리에서 선택"
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="gallery" />
        </button>
        <button
          className={`shutter ${live ? "" : "is-off"} ${live && mode === "barcode" ? "is-scanning" : ""}`}
          aria-label={
            !live ? "카메라 켜기" : mode === "barcode" ? "라벨 촬영으로 전환" : "촬영"
          }
          onClick={onShutter}
        />
        <div style={{ width: 52 }} />
      </div>

      <p className="drop-hint">
        {!live
          ? "셔터를 누르면 카메라가 켜집니다"
          : mode === "barcode"
            ? "바코드를 인식하면 자동으로 넘어갑니다 · 잘 안 읽히면 셔터를 눌러 라벨 촬영으로"
            : mode === "list"
              ? "메뉴판이 한 화면에 다 들어오게 맞추고 셔터를 누르세요"
              : "라벨이 잘 보이게 맞추고 셔터를 누르세요"}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
