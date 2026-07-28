"use client";

// 타이머 진행 상태를 눈으로 보여주는 연출.
// progress 0 → 1 에 따라 실제로 차오르고 서리가 끼도록 그린다.
// (단순 애니메이션이 아니라 남은 시간과 연동되므로 진행 정도를 가늠할 수 있다)

const GOLD = "#d4b278";
const GOLD_DIM = "rgba(212,178,120,0.35)";
const WINE = "#7a2434";

// 칠링 — 잔에 담긴 술이 차가워지며 표면에 서리가 앉는다
function Chilling({ progress, mini }) {
  const frost = Math.min(1, progress * 1.2); // 서리는 조금 일찍부터 보이기 시작
  const temp = Math.round(18 - 10 * progress); // 18℃ → 8℃

  // 서리 방울 — 진행에 따라 하나씩 또렷해진다
  const drops = [
    [40, 44], [53, 38], [66, 46], [45, 58], [60, 62],
    [37, 70], [70, 34], [52, 74], [64, 78], [43, 86],
  ];

  return (
    <svg viewBox="0 0 110 140" className="tv-svg" aria-hidden="true">
      <defs>
        <clipPath id="tv-bowl">
          <path d="M30 28h50l-4 34a21 21 0 0 1-42 0Z" />
        </clipPath>
      </defs>

      {/* 잔 */}
      <path d="M30 28h50l-4 34a21 21 0 0 1-42 0Z" fill="none" stroke={GOLD} strokeWidth="2" />
      <path d="M55 83v30M40 115h30" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />

      {/* 술 */}
      <g clipPath="url(#tv-bowl)">
        <rect x="28" y="40" width="54" height="45" fill={WINE} opacity="0.75" />
        {/* 표면 */}
        <rect x="28" y="40" width="54" height="1.5" fill={GOLD} opacity="0.5" />
      </g>

      {/* 서리 */}
      {drops.map(([cx, cy], i) => {
        const step = i / drops.length;
        const on = frost > step;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={on ? 1.8 : 0}
            fill="#eaf2f5"
            opacity={on ? 0.75 : 0}
            style={{ transition: "r .6s ease, opacity .6s ease" }}
          />
        );
      })}

      {/* 냉기 — 아래로 흘러내리는 결 */}
      <g className="tv-cold" opacity={0.25 + frost * 0.4}>
        <path d="M24 60c0 8 3 12 3 20" fill="none" stroke="#cfe4ec" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M86 56c0 9-3 13-3 22" fill="none" stroke="#cfe4ec" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      {!mini && (
        <text x="55" y="20" textAnchor="middle" className="tv-temp">
          {temp}℃
        </text>
      )}
    </svg>
  );
}

// 디캔팅 — 병에서 디캔터로 옮겨지며 향이 열린다
function Decanting({ progress, long, mini }) {
  const fill = 44 * progress; // 디캔터에 차오르는 높이
  const y = 108 - fill;

  return (
    <svg viewBox="0 0 110 140" className="tv-svg" aria-hidden="true">
      <defs>
        <clipPath id="tv-decanter">
          <path d="M55 46c0 10-24 16-24 38a24 24 0 0 0 48 0c0-22-24-28-24-38Z" />
        </clipPath>
      </defs>

      {/* 향 — 목에서 피어오른다 */}
      <g className="tv-aroma" stroke={GOLD_DIM} strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M48 30c-3-6 3-9 0-15" className="tv-a1" />
        <path d="M55 26c-3-7 3-10 0-16" className="tv-a2" />
        <path d="M62 30c-3-6 3-9 0-15" className="tv-a3" />
        {long && <path d="M41 34c-2-5 2-7 0-12" className="tv-a4" />}
      </g>

      {/* 디캔터 */}
      <path
        d="M55 46c0 10-24 16-24 38a24 24 0 0 0 48 0c0-22-24-28-24-38Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
      />
      <path d="M50 40h10" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <path d="M52 40v6M58 40v6" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />

      {/* 차오르는 술 */}
      <g clipPath="url(#tv-decanter)">
        <rect
          x="28"
          y={y}
          width="54"
          height={fill + 2}
          fill={WINE}
          opacity="0.8"
          style={{ transition: "y 1s linear, height 1s linear" }}
        />
        <rect
          x="28"
          y={y}
          width="54"
          height="1.5"
          fill={GOLD}
          opacity="0.55"
          style={{ transition: "y 1s linear" }}
        />
      </g>

      {!mini && (
        <text x="55" y="132" textAnchor="middle" className="tv-temp">
          {Math.round(progress * 100)}%
        </text>
      )}
    </svg>
  );
}

// mini: 버튼 안 미리보기 — 숫자 없이 그림만 보여준다
export default function TimerVisual({ kind, progress = 0, mini = false }) {
  const p = Math.max(0, Math.min(1, progress));
  if (kind === "chill") return <Chilling progress={p} mini={mini} />;
  return <Decanting progress={p} long={kind === "long"} mini={mini} />;
}
