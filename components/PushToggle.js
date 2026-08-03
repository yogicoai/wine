"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

// base64url(VAPID 공개키) → Uint8Array (브라우저 구독 API가 요구하는 형식)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle({ onToast }) {
  const [state, setState] = useState({ ready: false, enabled: false, subscribed: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) return setState({ ready: true, enabled: false, subscribed: false });

      try {
        const info = await fetch("/api/push/subscribe").then((r) => r.json());
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (alive) {
          setState({ ready: true, enabled: !!info.enabled, subscribed: !!sub, publicKey: info.publicKey });
        }
      } catch {
        if (alive) setState({ ready: true, enabled: false, subscribed: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        onToast?.(t("알림 권한이 허용되지 않았습니다."), true);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(state.publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error();
      setState((s) => ({ ...s, subscribed: true }));
      onToast?.(t("특가 알림을 켰습니다. 하루 한 번 가격을 확인합니다."));
    } catch {
      onToast?.(t("알림을 켜지 못했습니다."), true);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false }));
      onToast?.(t("특가 알림을 껐습니다."));
    } catch {
      onToast?.(t("설정을 변경하지 못했습니다."), true);
    } finally {
      setBusy(false);
    }
  }

  if (!state.ready || !state.enabled) return null;

  return (
    <div className="push-row">
      <div>
        <b>{t("특가 알림")}</b>
        <span>
          {state.subscribed
            ? t("찜해 둔 술이 목표가에 닿거나 최저가를 경신하면 알려드립니다.")
            : t("앱을 닫아 두어도 특가를 놓치지 않도록 알림을 보내드립니다.")}
        </span>
      </div>
      <button
        className={`push-btn ${state.subscribed ? "on" : ""}`}
        onClick={state.subscribed ? unsubscribe : subscribe}
        disabled={busy}
      >
        {busy ? t("처리 중…") : state.subscribed ? t("끄기") : t("켜기")}
      </button>
    </div>
  );
}
