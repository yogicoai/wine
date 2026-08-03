"use client";
import { useEffect, useState } from "react";
import { BrandEmblem } from "./Brand";
import { t } from "@/lib/i18n";
import { APP } from "@/lib/appProfile";
import { tipsFor } from "@/lib/scanTips";

const STEPS = [
  "라벨을 읽는 중",
  "주종을 판별하는 중",
  "제품 정보를 정리하는 중",
  "테이스팅 노트를 다듬는 중",
  "인포그래픽을 그리는 중",
];

// 팁은 기다림이 길어질 때만 띄운다.
// DB 에 있는 술은 3초면 끝나는데, 그때 팁이 번쩍하고 사라지면 읽지도 못하고
// 화면만 어수선해진다. 4초를 넘긴 사람에게만 보여 준다.
const TIP_AFTER = 4000;
const TIP_ROTATE = 8000;

export default function LoadingScreen({ thumb }) {
  const [i, setI] = useState(0);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    // 앞 단계는 빠르게, 뒤로 갈수록 천천히.
    // 저장된 결과(약 3초 노출)에서도 단계가 서너 개는 흘러가야 일하는 것처럼 보인다.
    let step = 0;
    let timer;
    const tick = () => {
      step = Math.min(step + 1, STEPS.length - 1);
      setI(step);
      if (step < STEPS.length - 1) timer = setTimeout(tick, step < 3 ? 1100 : 2800);
    };
    timer = setTimeout(tick, 1100);
    return () => clearTimeout(timer);
  }, []);

  // 순서를 섞는 일은 화면이 붙은 뒤에 한다 — 서버와 브라우저가 다른 것을
  // 고르면 화면이 어긋난다.
  useEffect(() => {
    const pool = tipsFor(APP.key);
    let n = Math.floor(Math.random() * pool.length);
    let rotate;

    const show = () => {
      setTip(pool[n % pool.length]);
      n += 1;
    };
    const first = setTimeout(() => {
      show();
      rotate = setInterval(show, TIP_ROTATE);
    }, TIP_AFTER);

    return () => {
      clearTimeout(first);
      clearInterval(rotate);
    };
  }, []);

  return (
    <div className="loading">
      {/* 촬영한 라벨 위로 스캔 선이 지나간다 — 지금 이 사진을 읽고 있다는 신호 */}
      <div className="scan-frame">
        {thumb ? (
          <img className="scan-img" src={thumb} alt={t("촬영한 라벨")} />
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
            {t(s)}
          </li>
        ))}
      </ol>

      {/* 기다림이 길어질 때만 — 진행 표시를 가리지 않게 아래에 조용히 둔다 */}
      {tip && (
        <p className="scan-tip" key={tip}>
          <i>✦</i>
          {t(tip)}
        </p>
      )}
    </div>
  );
}
