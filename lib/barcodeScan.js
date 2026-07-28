"use client";
// 브라우저에서 바코드를 읽는다.
//
// 크롬·안드로이드에는 BarcodeDetector가 내장되어 있어 그것을 쓰고,
// 지원하지 않는 곳(사파리 등)에서만 해독기를 내려받는다.
// 내려받는 쪽은 무거우므로 바코드 모드를 켤 때 처음 한 번만 불러온다.

const FORMATS = ["ean_13", "upc_a", "ean_8"]; // 술병에 쓰이는 형식만

// 조준선 안쪽만 잘라서 본다.
// 1920px 프레임 전체를 훑으면 바코드가 화면의 일부일 때 잘 못 찾는다.
// 화면의 안내선보다 조금 넉넉하게 잡아 살짝 벗어나도 읽히게 한다.
const BAND = { w: 0.88, h: 0.38 };

function nativeAvailable() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

async function makeNative() {
  // 브라우저가 형식을 실제로 지원하는지도 확인한다 (있다고 다 되는 것은 아니다)
  const supported = await window.BarcodeDetector.getSupportedFormats?.();
  const formats = supported ? FORMATS.filter((f) => supported.includes(f)) : FORMATS;
  if (!formats.length) return null;

  const detector = new window.BarcodeDetector({ formats });
  return async (video) => {
    const found = await detector.detect(video);
    return found?.[0]?.rawValue || null;
  };
}

async function makeFallback() {
  const {
    MultiFormatReader,
    BinaryBitmap,
    HybridBinarizer,
    GlobalHistogramBinarizer,
    RGBLuminanceSource,
    DecodeHintType,
    BarcodeFormat,
  } = await import("@zxing/library");

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.EAN_8,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // 잘라낸 영역을 회색조로 바꾼다 (해독기는 밝기 값만 본다)
  function luminanceOf(video, sx, sy, sw, sh) {
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    const { data } = ctx.getImageData(0, 0, sw, sh);
    const gray = new Uint8ClampedArray(sw * sh);
    for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
      // 녹색에 가중치를 두는 통상적인 밝기 계산
      gray[p] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
    }
    return new RGBLuminanceSource(gray, sw, sh);
  }

  function tryDecode(source) {
    // 지역 이진화(Hybrid)가 먼저, 실패하면 전역 이진화로 한 번 더.
    // 모니터 화면이나 조명이 고르지 않은 라벨은 둘 중 하나만 되는 경우가 많다.
    for (const Binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
      try {
        const result = reader.decode(new BinaryBitmap(new Binarizer(source)), hints);
        if (result) return result.getText();
      } catch {
        /* 이 프레임에서 못 찾았을 뿐이다 */
      } finally {
        reader.reset();
      }
    }
    return null;
  }

  return async (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // 1) 조준선 안쪽 — 대부분 여기서 잡힌다
    const bw = Math.round(vw * BAND.w);
    const bh = Math.round(vh * BAND.h);
    const band = tryDecode(
      luminanceOf(video, Math.round((vw - bw) / 2), Math.round((vh - bh) / 2), bw, bh)
    );
    if (band) return band;

    // 2) 못 찾으면 전체 프레임 — 선 밖에 걸쳐 있는 경우를 위한 보루
    return tryDecode(luminanceOf(video, 0, 0, vw, vh));
  };
}

/**
 * 비디오에서 바코드가 읽힐 때까지 반복해서 시도한다.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onFound
 * @param {{ interval?: number, onStatus?: (s: "loading"|"scanning"|"error") => void }} opts
 * @returns {() => void} 중지 함수
 */
export function scanLoop(video, onFound, { interval = 300, onStatus } = {}) {
  let stopped = false;
  let timer = null;

  (async () => {
    let detect = null;
    onStatus?.("loading");
    try {
      detect = nativeAvailable() ? await makeNative() : null;
      if (!detect) detect = await makeFallback();
    } catch (err) {
      // 조용히 포기하면 사용자는 왜 안 읽히는지 알 수 없다 — 상태를 알린다
      console.error("[barcode] 해독기 준비 실패:", err);
      onStatus?.("error");
      return;
    }
    if (stopped) return;
    onStatus?.("scanning");

    const tick = async () => {
      if (stopped) return;
      try {
        const code = await detect(video);
        // EAN-13은 체크digit이 있어 해독기 단계에서 이미 검증된다.
        // 서버에서 한 번 더 확인하므로 여기서 두 번 읽기를 기다리지 않는다.
        if (code) {
          onFound(code);
          return;
        }
      } catch (err) {
        console.warn("[barcode] 프레임 해독 실패:", err?.message || err);
      }
      if (!stopped) timer = setTimeout(tick, interval);
    };
    tick();
  })();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
