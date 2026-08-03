"use client";
import TimerVisual from "./TimerVisual";
import useActiveTimers from "./useActiveTimer";
import { progressOf, formatRemain } from "@/lib/timer";
import { t } from "@/lib/i18n";

// 진행 중인 준비를 떠 있는 버튼으로 보여 준다.
//
// 디캔팅 90분은 원래 자리를 뜨는 시간이라, 그동안 앱은 다른 화면에 가 있다.
// 얼음이 차오르고 향이 열리는 그림이 계속 돌고 있으면 "지금 뭔가 되고 있다"가
// 말보다 빨리 전해진다.
//
// 여럿이 동시에 돌면 가장 먼저 끝나는 것을 보여 주고 나머지는 수로 알린다.
// 다 늘어놓으면 화면을 가린다.
export default function TimerBubble({ onOpen }) {
  const { timers } = useActiveTimers();
  if (!timers.length) return null;

  const [soonest] = timers;
  const more = timers.length - 1;

  return (
    <button
      className="timer-bubble"
      onClick={onOpen}
      aria-label={
        t("{name} {label} 진행 중, {remain} 남음", {
          name: soonest.name,
          label: t(soonest.label),
          remain: formatRemain(soonest.remain),
        }) +
        (more ? t(" 외 {n}건", { n: more }) : "") +
        t(". 눌러서 자세히 보기")
      }
    >
      <span className="tb-stage">
        <TimerVisual kind={soonest.kind} progress={progressOf(soonest)} mini />
      </span>
      <span className="tb-text">
        <b>{formatRemain(soonest.remain)}</b>
        <span>{t(soonest.label)}</span>
      </span>
      {more > 0 && <span className="tb-more">+{more}</span>}
    </button>
  );
}
