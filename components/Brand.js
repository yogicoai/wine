"use client";
import Image from "next/image";
import { APP } from "@/lib/appProfile";

// 브랜드 로고 — 앱마다 다르다.
//
// 심볼은 lib/apps/<키>.js 의 theme.brandMark 가 정한다. 사케 앱 머리에
// 와인병이 붙어 있으면 그 순간 "와인 앱을 색만 바꾼 것"이 들통난다.
//
// 검정 배경이 칠해진 원본은 mix-blend-mode: screen 으로 배경에 묻힌다.
// 투명 PNG면 그대로 얹혀도 된다 (둘 다 무해하다).
export function BrandMark({ size = 38, className = "" }) {
  return (
    <Image
      className={`brand-mark ${className}`}
      src={APP.theme.brandMark || "/icons/img_a.png"}
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
      alt={APP.nameEn}
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
      src={APP.theme.brandEmblem || "/icons/img_c.png"}
      alt=""
      width={size}
      height={size}
    />
  );
}
