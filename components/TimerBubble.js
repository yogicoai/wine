"use client";
import TimerVisual from "./TimerVisual";
import useActiveTimer from "./useActiveTimer";
import { progressOf, formatRemain } from "@/lib/timer";

// 진행 중인 준비를 떠 있는 버튼으로 보여 준다.
//
// 디캔팅 90분은 원래 자리를 뜨는 시간이라, 그동안 앱은 다른 화면에 가 있다.
// 얼음이 차오르고 향이 열리는 그림이 계속 돌고 있으면 "지금 뭔가 되고 있다"가
// 말보다 빨리 전해진다. 눌러서 자세히 볼 수 있게 한다.
export default function TimerBubble({ onOpen }) {
  const { timer, remain } = useActiveTimer();
  if (!timer) return null;

  return (
    <button
      className="timer-bubble"
      onClick={onOpen}
      title={`${timer.name} · ${timer.label} 진행 중`}
      aria-label={`${timer.name} ${timer.label} 진행 중, ${formatRemain(remain)} 남음. 눌러서 자세히 보기`}
    >
      <span className="tb-stage">
        <TimerVisual kind={timer.kind} progress={progressOf(timer)} mini />
      </span>
      <span className="tb-text">
        <b>{formatRemain(remain)}</b>
        <span>{timer.label}</span>
      </span>
    </button>
  );
}
