"use client";
import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/imageClient";
import Icon from "./Icon";

export default function CaptureScreen({ onCapture }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState(null);
  const [dragging, setDragging] = useState(false);

  // 1) 카메라 권한 요청 — 스트림은 state로 보관한다.
  useEffect(() => {
    let cancelled = false;
    let acquired = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("이 브라우저는 카메라를 지원하지 않습니다.");
        return;
      }
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          acquired.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(acquired);
      } catch (err) {
        // 권한 거부·미지원 등 — 업로드 경로로 안내한다
        setCamError(
          err?.name === "NotAllowedError"
            ? "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요."
            : "카메라를 사용할 수 없습니다."
        );
      }
    })();

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  function shoot() {
    const video = videoRef.current;
    if (!stream || !video?.videoWidth) {
      fileRef.current?.click(); // 카메라가 준비되지 않았으면 업로드로
      return;
    }
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
            <div>
              {camError || "카메라를 준비하는 중입니다…"}
              <br />
              아래 버튼으로 사진을 업로드하거나
              <br />
              이미지를 드래그/붙여넣기 하세요.
            </div>
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
        <button className="shutter" aria-label="촬영" onClick={shoot} />
        <div style={{ width: 52 }} />
      </div>

      <p className="drop-hint">이미지 드래그 앤 드롭 · 클립보드 붙여넣기 지원</p>

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
