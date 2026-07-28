// 보틀 렌즈 서비스 워커 — 특가 푸시 알림 수신 전용
// (오프라인 캐싱은 하지 않는다. 결과가 실시간 가격에 의존하기 때문)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "보틀 렌즈", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "보틀 렌즈";
  const options = {
    body: data.body || "",
    icon: "/icons/app-192.png",
    badge: "/icons/app-192.png",
    tag: data.tag || "deal",
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // 이미 열려 있는 창이 있으면 그 창을 쓰고, 없으면 새로 연다
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
