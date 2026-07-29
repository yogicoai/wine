"use client";
import { useEffect, useState } from "react";
import { SCALES, readScaleKey, applyScale } from "@/lib/prefs";

// 글자 크기 고르기 — 고른 즉시 화면에 반영되고 다음에도 유지된다.
export default function FontScale() {
  const [key, setKey] = useState(null); // 서버·클라이언트 첫 그림을 맞추려 null 로 시작

  useEffect(() => setKey(readScaleKey()), []);

  function pick(next) {
    setKey(next);
    applyScale(next);
  }

  return (
    <>
      <div className="scale-row">
        {SCALES.map((s) => (
          <button
            key={s.key}
            className={`scale-btn ${key === s.key ? "on" : ""}`}
            aria-pressed={key === s.key}
            onClick={() => pick(s.key)}
          >
            <b style={{ fontSize: `${Math.round(13 * s.value)}px` }}>가</b>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="drawer-note">
        글자와 함께 여백·버튼도 같은 비율로 커집니다. 이 기기에만 적용됩니다.
      </div>
    </>
  );
}
