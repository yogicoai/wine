// 술 정보 언어 — 사용자가 고른다.
//
// 앱의 기본 언어(APP.locale)는 빌드 때 정해지지만, 술 데이터의 번역층(i18n.en/ja)은
// 사용자가 내 정보에서 직접 골라 볼 수 있다. 선택은 쿠키에 저장한다 —
// 카탈로그 조회가 서버에서 일어나므로 localStorage 로는 서버에 전달되지 않는다.
//
// 이 파일은 클라이언트에서도 안전하다 (next/headers 를 쓰지 않는다).
// 서버 쪽 해석은 lib/catalog.js 의 requestLocale() 이 맡는다.

import { APP } from "./appProfile";

export const LOCALE_COOKIE = "bl_locale";

export const LOCALES = [
  { key: "ko", label: "한국어" },
  { key: "en", label: "English" },
  { key: "ja", label: "日本語" },
];

export function isLocale(v) {
  return v === "ko" || v === "en" || v === "ja";
}

/** 클라이언트에서 현재 선택을 읽는다. 고른 적이 없으면 앱 기본값. */
export function getContentLocale() {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)bl_locale=([a-z]{2})/);
    if (m && isLocale(m[1])) return m[1];
  }
  return APP.locale || "ko";
}

/** 선택을 저장한다 — 다음 조회부터 그 언어의 번역층이 겹쳐 나온다. */
export function setContentLocale(key) {
  if (!isLocale(key) || typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`;
}
