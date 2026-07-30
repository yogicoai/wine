"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

// 처음 오는 사람에게 무엇을 할 수 있는지 알린다.
//
// 앱을 열면 카메라 화면 하나뿐이라, 검색·추천·와인 리스트·셀러가 있다는 것을
// 알 방법이 없었다. 기능을 만들어 놓고 첫 화면에서 하나도 보이지 않는 건 아깝다.
//
// 여러 장짜리 안내로 길을 막지는 않는다. 첫 화면 아래에 한 번만 펼쳐 두고,
// 닫으면 다시 나오지 않는다.
const KEY = "bottlelens.hintSeen";

const ITEMS = [
  // 바코드는 지금 내보내지 않으므로 문구에서도 뺀다 (lib/features.js)
  { icon: "camera", title: "찍어서 알아보기", body: "술병 라벨과 식당 와인 리스트까지" },
  { icon: "search", title: "찾기 · 추천", body: "이름으로 찾거나, O·X 여덟 문항으로 취향 추천" },
  { icon: "glass", title: "나의 셀러", body: "보유·위시 관리, 값이 내리면 알림" },
];

export default function FirstHint({ onOpenDiscover }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* 저장소가 막혀 있으면 그냥 보여 준다 */
    }
  }, []);

  function close() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* 다음에 또 보이더라도 기능에는 지장이 없다 */
    }
  }

  if (!show) return null;

  return (
    <div className="hint">
      <div className="hint-head">
        <b>이렇게 쓸 수 있습니다</b>
        <button className="hint-x" onClick={close} aria-label="안내 닫기">
          <Icon name="close" size={14} />
        </button>
      </div>

      <ul className="hint-list">
        {ITEMS.map((it) => (
          <li key={it.title}>
            <span className="hint-icon">
              <Icon name={it.icon} size={17} stroke={1.3} />
            </span>
            <span>
              <b>{it.title}</b>
              <em>{it.body}</em>
            </span>
          </li>
        ))}
      </ul>

      <button
        className="hint-go"
        onClick={() => {
          close();
          onOpenDiscover?.();
        }}
      >
        와인 둘러보기부터 <em>›</em>
      </button>
    </div>
  );
}
