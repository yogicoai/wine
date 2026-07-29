"use client";
// 진행 중인 서빙 준비(칠링·디캔팅)를 브라우저에 남긴다.
//
// 화면이 아니라 저장소에 두는 이유: 디캔팅 90분은 원래 자리를 뜨는 시간이다.
// 다른 화면으로 옮기거나 앱을 닫아도 이어져야 하고, 끝나면 알려 줘야 한다.
//
// 여러 개를 동시에 둘 수 있다. 화이트는 칠링하고 레드는 디캔팅하는 상황이
// 오히려 자연스럽다. 같은 술의 같은 준비만 하나로 본다(다시 시작하면 덮어씀).

const KEY = "bottlelens.timers";
const LEGACY_KEY = "bottlelens.timer"; // 하나만 담던 시절
const EVENT = "bottlelens:timer";

function idOf(name, kind) {
  return `${name}::${kind}`;
}

/** @returns {Array<{id, name, kind, label, min, endsAt, doneText}>} */
export function readTimers() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((t) => t?.endsAt) : [];
    }
    // 예전에 하나만 담아 두던 것을 옮겨 온다
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const t = JSON.parse(legacy);
      localStorage.removeItem(LEGACY_KEY);
      if (t?.endsAt) {
        const moved = [{ ...t, id: idOf(t.name, t.kind) }];
        localStorage.setItem(KEY, JSON.stringify(moved));
        return moved;
      }
    }
    return [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 공간이 막혀 있어도 타이머 동작 자체는 막지 않는다 */
  }
  // 같은 탭의 다른 컴포넌트에도 알린다 (storage 이벤트는 다른 탭에만 간다)
  window.dispatchEvent(new Event(EVENT));
}

export function startTimer({ name, kind, label, min, doneText }) {
  const id = idOf(name, kind);
  const next = readTimers().filter((t) => t.id !== id); // 같은 준비를 다시 시작하면 덮어쓴다
  next.push({ id, name, kind, label, min, doneText, endsAt: Date.now() + min * 60000 });
  write(next);
}

export function clearTimer(id) {
  write(readTimers().filter((t) => t.id !== id));
}

export function clearAllTimers() {
  write([]);
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
