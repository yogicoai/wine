"use client";
import Image from "next/image";

// 브랜드 로고.
//
// 받은 이미지는 배경이 검정으로 칠해져 있고 투명하지 않다. 우리 배경색과 미세하게
// 달라 그냥 얹으면 네모가 비친다. mix-blend-mode: screen 을 쓰면 검정은 배경에
// 묻히고 금색만 남으므로, 이미지를 다시 만들지 않고도 투명한 것처럼 보인다.
//
// 원본이 1MB 안팎이라 next/image 로 내보낸다. 화면 크기에 맞춰 줄이고
// 최신 포맷으로 바꿔 준다.
export function BrandMark({ size = 38, className = "" }) {
  return (
    <Image
      className={`brand-mark ${className}`}
      src="/icons/img_a.png"
      alt=""
      width={size}
      height={size}
      priority
    />
  );
}

export function BrandWord({ height = 34, className = "" }) {
  // 원본 비율 2172 × 724 (3:1)
  return (
    <Image
      className={`brand-word ${className}`}
      src="/icons/img_b.png"
      alt="Bottle Lens"
      width={Math.round(height * 3)}
      height={height}
      priority
    />
  );
}

/** 로딩·빈 화면에 은은하게 까는 엠블럼 */
export function BrandEmblem({ size = 260, className = "" }) {
  return (
    <Image
      className={`brand-emblem ${className}`}
      src="/icons/img_c.png"
      alt=""
      width={size}
      height={size}
    />
  );
}
