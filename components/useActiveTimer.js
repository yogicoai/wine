"use client";
import { useEffect, useState } from "react";
import { readTimers, remainingOf, clearTimer, subscribeTimer } from "@/lib/timer";

/**
 * 진행 중인 준비 타이머들을 읽어 1초마다 갱신한다.
 * 끝나는 시각이 이른 것부터 돌려준다 — 화면에서 대표로 보여 줄 것이 앞에 온다.
 *
 * @param {object} opts
 * @param {boolean} opts.owner 끝났을 때 알릴 책임을 질지.
 *   여러 화면이 같은 타이머를 보므로, 알림은 한 곳(앱 최상단)에서만 울려야 두 번 울리지 않는다.
 * @param {(text: string) => void} opts.onDone 알림 권한이 없을 때 쓸 대체 통지
 */
export default function useActiveTimers({ owner = false, onDone } = {}) {
  const [timers, setTimers] = useState([]);

  useEffect(() => {
    const sync = () => {
      const list = readTimers()
        .map((t) => ({ ...t, remain: remainingOf(t) }))
        .sort((a, b) => a.remain - b.remain);
      setTimers(list);
    };
    sync();

    const unsubscribe = subscribeTimer(sync);
    const tick = setInterval(sync, 1000);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, []);

  // 끝난 것들을 알리고 정리한다
  useEffect(() => {
    if (!owner) return;
    const done = timers.filter((t) => t.remain <= 0);
    if (!done.length) return;

    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    for (const t of done) {
      const text = `${t.label} 완료 — ${t.doneText}`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("보틀 렌즈", { body: `${t.name}\n${text}`, tag: t.id });
      } else {
        onDone?.(`${t.name} · ${text}`);
      }
      clearTimer(t.id);
    }
  }, [owner, timers, onDone]);

  return { timers };
}
