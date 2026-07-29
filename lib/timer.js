"use client";
// 진행 중인 서빙 준비(칠링·디캔팅)를 브라우저에 남긴다.
//
// 지금까지 타이머는 결과 화면 안에만 있었다. 다른 화면으로 넘어가거나 앱을 닫으면
// 사라졌고, 끝나도 아무도 알려주지 않았다. 그런데 디캔팅 90분은 원래 자리를 뜨는 시간이다.
// 화면이 아니라 저장소에 두고, 어디에 있든 남은 시간을 보고 알림을 받게 한다.

const KEY = "bottlelens.timer";
const EVENT = "bottlelens:timer";

/** @returns {null | {name, kind, label, min, endsAt, doneText}} */
export function readTimer() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    return t?.endsAt ? t : null;
  } catch {
    return null;
  }
}

function write(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 공간이 막혀 있어도 타이머 동작 자체는 막지 않는다 */
  }
  // 같은 탭의 다른 컴포넌트에도 알린다 (storage 이벤트는 다른 탭에만 간다)
  window.dispatchEvent(new Event(EVENT));
}

export function startTimer({ name, kind, label, min, doneText }) {
  write({ name, kind, label, min, doneText, endsAt: Date.now() + min * 60000 });
}

export function clearTimer() {
  write(null);
}

/** 남은 초 */
export function remainingOf(timer) {
  if (!timer) return 0;
  return Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
}

/** 진행률 0~1 */
export function progressOf(timer) {
  if (!timer?.min) return 0;
  const total = timer.min * 60;
  return Math.min(1, Math.max(0, (total - remainingOf(timer)) / total));
}

export function formatRemain(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 저장소 변화 구독 — 같은 탭·다른 탭 모두 */
export function subscribeTimer(fn) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
