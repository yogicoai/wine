"use client";

// dataURL → 다운사이즈 JPEG dataURL (API용 max 1280px q0.82 / 썸네일 320px q0.6)
export function downscale(dataUrl, maxPx = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function stripPrefix(dataUrl) {
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// 앨범에서 고르게 하면 무엇이든 올라올 수 있다. 분석은 한 장에 수십 원이 들고
// 결과는 화면에 그대로 나가므로, 술 사진일 수 없는 것은 올라가기 전에 막는다.
//
// accept="image/*" 만으로는 부족하다. SVG 도 image/* 이고, 사진이 아니라 마크업이라
// 스크립트를 품을 수 있다. 어떤 카메라도 SVG 를 만들지 않으므로 받을 이유가 없다.
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 25 * 1024 * 1024; // 요즘 폰 사진이 5~12MB — 그 두 배까지만
const MIN_SIDE = 200; // 이보다 작으면 라벨 글자를 읽을 수 없다

/**
 * 파일을 읽어 분석에 쓸 수 있는 dataURL 로 만든다.
 * 통과하지 못하면 이유를 돌려준다 — 화면이 그 이유를 그대로 보여 준다.
 * @returns {Promise<{ok: true, dataUrl: string} | {ok: false, reason: string}>}
 */
export async function readImageFile(file) {
  if (!file) return { ok: false, reason: "사진을 고르지 못했습니다." };

  const type = String(file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) {
    // HEIC 는 브라우저가 빈 type 으로 주기도 한다 — 확장자로 한 번 더 본다
    const byExt = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "");
    if (!byExt) {
      return { ok: false, reason: "사진 파일만 올릴 수 있습니다. (JPG · PNG · WEBP · HEIC)" };
    }
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "사진이 너무 큽니다. 25MB 이하로 올려 주세요." };
  }

  const dataUrl = await fileToDataUrl(file).catch(() => null);
  if (!dataUrl) return { ok: false, reason: "사진을 읽지 못했습니다." };

  // 확장자만 바꾼 파일은 여기서 걸린다 — 실제로 그려지는지 본다
  const size = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
  if (!size) return { ok: false, reason: "사진 형식이 올바르지 않습니다." };
  if (Math.min(size.w, size.h) < MIN_SIDE) {
    return { ok: false, reason: "사진이 너무 작아 라벨을 읽을 수 없습니다." };
  }

  return { ok: true, dataUrl };
}
