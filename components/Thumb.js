"use client";
import { useState } from "react";
import CatIcon from "./CatIcon";

// 목록에 쓰는 작은 사진.
//
// 사진 주소는 대부분 남의 서버를 가리킨다. 판매처가 상품을 내리거나 참조를
// 막으면 그 주소는 어느 날 죽는다. 그때 <img> 를 그냥 두면 깨진 그림표가
// 남는데, 목록에서는 그것이 줄줄이 늘어서 앱이 고장 난 것처럼 보인다.
//
// 실패하면 주종 엠블럼으로 물러선다. 사진이 없는 항목과 같은 모양이 되므로
// 눈에 거슬리지 않는다.
/**
 * @param {string}  fallback  "emblem"(기본) 또는 "none".
 *   목록의 한 칸을 차지하는 자리에는 엠블럼을 채워 줄이 어긋나지 않게 하고,
 *   특가 알림처럼 사진이 곁들이일 뿐인 자리에서는 아무것도 그리지 않는다.
 */
export default function Thumb({
  src,
  category,
  size = 26,
  className = "hist-thumb",
  fallback = "emblem",
}) {
  const [dead, setDead] = useState(false);

  if (!src || dead) {
    if (fallback === "none") return null;
    return (
      <div className={className}>
        <CatIcon category={category} size={size} />
      </div>
    );
  }
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setDead(true)} />;
}
