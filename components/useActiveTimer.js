"use client";
import { useEffect, useState } from "react";
import { readTimer, remainingOf, clearTimer, subscribeTimer } from "@/lib/timer";

/**
 * 진행 중인 준비 타이머를 읽어 1초마다 갱신한다.
 *
 * @param {object} opts
 * @param {boolean} opts.owner 끝났을 때 알릴 책임을 질지.
 *   여러 화면이 같은 타이머를 보므로, 알림은 한 곳(앱 최상단)에서만 울려야 두 번 울리지 않는다.
 * @param {(text: string) => void} opts.onDone 알림을 띄울 수 없을 때 쓸 대체 통지
 */
export default function useActiveTimer({ owner = false, onDone } = {}) {
  const [timer, setTimer] = useState(null);
  const [remain, setRemain] = useState(0);

  useEffect(() => {
    const sync = () => {
      const t = readTimer();
      setTimer(t);
      setRemain(remainingOf(t));
    };
    sync();

    const unsubscribe = subscribeTimer(sync);
    const tick = setInterval(sync, 1000);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, []);

  // 끝났으면 알리고 정리한다
  useEffect(() => {
    if (!owner || !timer || remain > 0) return;

    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    const text = `${timer.label} 완료 — ${timer.doneText}`;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("보틀 렌즈", { body: `${timer.name}\n${text}` });
    } else {
      onDone?.(`${timer.name} · ${text}`);
    }
    clearTimer();
  }, [owner, timer, remain, onDone]);

  return { timer, remain };
}
