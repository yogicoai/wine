"use client";
import { APP } from "./appProfile";
// 화면 설정 — 글자 크기.
//
// 앱으로 쓰는 물건이라 손에 든 기기와 눈에 따라 알맞은 크기가 다르다.
// 이 앱의 치수는 px 로 짜여 있어서 글자만 키우면 칸이 따라오지 않는다.
// 그래서 zoom 으로 화면 전체를 함께 키운다 — 글자와 여백과 누를 자리가 같이 커진다.

const KEY = `${APP.storageKey}.fontScale`;
const EVENT = `${APP.storageKey}:prefs`;

export const SCALES = [
  { key: "s", label: "작게", value: 0.92 },
  { key: "m", label: "기본", value: 1 },
  { key: "l", label: "크게", value: 1.12 },
  { key: "xl", label: "아주 크게", value: 1.24 },
];

export const DEFAULT_SCALE = "m";

export function readScaleKey() {
  if (typeof window === "undefined") return DEFAULT_SCALE;
  try {
    const key = localStorage.getItem(KEY);
    return SCALES.some((s) => s.key === key) ? key : DEFAULT_SCALE;
  } catch {
    return DEFAULT_SCALE;
  }
}

export function applyScale(key) {
  const scale = SCALES.find((s) => s.key === key) || SCALES[1];
  try {
    localStorage.setItem(KEY, scale.key);
  } catch {
    /* 저장이 막혀도 이번 화면에는 적용한다 */
  }
  // layout 의 첫 그림 스크립트와 같은 자리에 쓴다
  document.documentElement.style.setProperty("--ui-zoom", String(scale.value));
  window.dispatchEvent(new Event(EVENT));
}

export function subscribePrefs(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
