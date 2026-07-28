"use client";
import { useEffect, useState } from "react";
import { BrandEmblem } from "./Brand";

const STEPS = [
  "라벨을 읽는 중",
  "주종을 판별하는 중",
  "제품 정보를 정리하는 중",
  "테이스팅 노트를 다듬는 중",
  "인포그래픽을 그리는 중",
];

export default function LoadingScreen({ thumb }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="loading">
      {/* 촬영한 라벨 위로 스캔 선이 지나간다 — 지금 이 사진을 읽고 있다는 신호 */}
      <div className="scan-frame">
        {thumb ? (
          <img className="scan-img" src={thumb} alt="촬영한 라벨" />
        ) : (
          <div className="scan-empty">
            <BrandEmblem size={190} />
          </div>
        )}
        <span className="scan-line" />
        <span className="scan-corner tl" />
        <span className="scan-corner tr" />
        <span className="scan-corner bl" />
        <span className="scan-corner br" />
      </div>

      <ol className="loading-steps">
        {STEPS.map((s, idx) => (
          <li
            key={s}
            className={idx < i ? "done" : idx === i ? "now" : ""}
            aria-current={idx === i ? "step" : undefined}
          >
            <i className="step-dot" />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
