"use client";
import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/imageClient";
import Icon from "./Icon";

export default function CaptureScreen({ onCapture }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState(null);
  const [dragging, setDragging] = useState(false);

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

  // 셔터: 카메라가 꺼져 있으면 먼저 켜고, 켜져 있으면 촬영한다
  function onShutter() {
    if (!stream) return startCamera();
    shoot();
  }

  function shoot() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    if (navigator.vibrate) navigator.vibrate(30);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    onCapture(await fileToDataUrl(file));
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
            <div className="cam-guide" />
            <div className="cam-guide-txt">라벨이 프레임 안에 오도록 맞춰주세요</div>
          </>
        ) : (
          <div className="cam-fallback">
            <div className="big">
              <Icon name="camera" size={44} stroke={1.2} />
            </div>
            {camError ? (
              <div className="cam-msg err">{camError}</div>
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
          className={`shutter ${live ? "" : "is-off"}`}
          aria-label={live ? "촬영" : "카메라 켜기"}
          onClick={onShutter}
        />
        <div style={{ width: 52 }} />
      </div>

      <p className="drop-hint">
        {live ? "라벨이 잘 보이게 맞추고 셔터를 누르세요" : "셔터를 누르면 카메라가 켜집니다"}
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
