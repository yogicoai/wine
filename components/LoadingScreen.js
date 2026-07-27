"use client";
import { useEffect, useState } from "react";

const STEPS = [
  "라벨을 읽는 중…",
  "주종을 판별하는 중…",
  "빈티지·가격 정보를 확인하는 중…",
  "테이스팅 노트를 정리하는 중…",
  "인포그래픽을 그리는 중…",
];

export default function LoadingScreen({ thumb }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="loading">
      {thumb && <img className="loading-thumb" src={thumb} alt="촬영 이미지" />}
      <div className="swirl">
        <img src="/icons/icon.png" alt="" className="swirl-mark" />
      </div>
      <div className="loading-step">{STEPS[i]}</div>
      <div className="loading-sub">웹 검색으로 최신 정보를 함께 확인합니다</div>
    </div>
  );
}
