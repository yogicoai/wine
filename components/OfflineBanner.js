"use client";
import { useEffect, useState } from "react";

// 인터넷이 끊긴 것을 알린다.
//
// 이 앱은 분석·가격·검색이 모두 서버를 거치므로, 끊기면 아무것도 되지 않는다.
// 그때 버튼만 안 먹으면 사용자는 앱이 고장 났다고 여긴다. 무엇이 문제인지 밝혀야
// "잠시 뒤 다시" 라는 판단이 선다.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-bar" role="status">
      인터넷 연결이 끊겼습니다 — 촬영·검색·가격 조회를 쓸 수 없습니다
    </div>
  );
}
