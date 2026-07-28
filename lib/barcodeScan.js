"use client";
// 브라우저에서 바코드를 읽는다.
//
// 크롬·안드로이드에는 BarcodeDetector가 내장되어 있어 그것을 쓰고,
// 지원하지 않는 곳(사파리 등)에서만 해독기를 내려받는다.
// 내려받는 쪽은 무거우므로 바코드 모드를 켤 때 처음 한 번만 불러온다.

const FORMATS = ["ean_13", "upc_a", "ean_8"]; // 술병에 쓰이는 형식만

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
  const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, NotFoundException } =
    await import("@zxing/library");

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.EAN_8,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new BrowserMultiFormatReader(hints);
  return async (video) => {
    if (!video.videoWidth) return null;
    try {
      return reader.decodeBitmap(reader.createBinaryBitmap(video)).getText();
    } catch (err) {
      // 프레임에 바코드가 없는 것은 정상이다 — 오류로 취급하지 않는다
      if (err instanceof NotFoundException || err?.name === "NotFoundException") return null;
      return null;
    }
  };
}

/**
 * 비디오에서 바코드가 읽힐 때까지 반복해서 시도한다.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onFound
 * @param {{ interval?: number }} opts
 * @returns {() => void} 중지 함수
 */
export function scanLoop(video, onFound, { interval = 320 } = {}) {
  let stopped = false;
  let timer = null;

  (async () => {
    let detect = null;
    try {
      detect = nativeAvailable() ? await makeNative() : null;
      if (!detect) detect = await makeFallback();
    } catch {
      return; // 해독기를 준비하지 못하면 조용히 포기한다 (라벨 촬영은 그대로 쓸 수 있다)
    }
    if (stopped) return;

    // 같은 값을 두 번 연속 읽었을 때만 확정한다 — 흐릿한 프레임의 오독을 줄인다
    let prev = null;

    const tick = async () => {
      if (stopped) return;
      try {
        const code = await detect(video);
        if (code) {
          if (code === prev) {
            onFound(code);
            return;
          }
          prev = code;
        }
      } catch {
        /* 한 프레임 실패는 넘어간다 */
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
