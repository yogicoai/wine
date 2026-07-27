"use client";
import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/imageClient";
import Icon from "./Icon";

export default function CaptureScreen({ onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamReady(true);
      } catch {
        setCamReady(false); // 권한 거부/미지원 → 업로드 전용
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const video = videoRef.current;
    if (!video || !camReady) {
      fileRef.current?.click();
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

  // 붙여넣기
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
        {camReady ? (
          <>
            <video ref={videoRef} playsInline muted />
            <div className="cam-guide" />
            <div className="cam-guide-txt">라벨이 프레임 안에 오도록 맞춰주세요</div>
          </>
        ) : (
          <div className="cam-fallback">
            <div className="big"><Icon name="camera" size={44} stroke={1.2} /></div>
            <div>
              카메라를 사용할 수 없습니다.
              <br />
              아래 버튼으로 사진을 업로드하거나
              <br />
              이미지를 드래그/붙여넣기 하세요.
            </div>
            {/* 카메라 시도용 hidden video */}
            <video ref={videoRef} playsInline muted style={{ display: "none" }} />
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
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
