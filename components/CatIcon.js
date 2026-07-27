"use client";
import { catOf } from "@/lib/cats";

// 주종 엠블럼 — public/icons/cat/*.png (금박 인그레이빙 세트)
// 이미지가 없는 주종은 기존 이모지로 대체한다.
const HAS_IMAGE = new Set([
  "wine",
  "sake",
  "whisky",
  "traditional",
  "beer",
  "brandy",
  "baijiu",
  "tequila",
  "rum",
  "gin",
  "soju",
  "makgeolli",
  "vodka",
  "liqueur",
  "spirits",
]);

export default function CatIcon({ category, size = 22, className = "" }) {
  const cat = catOf(category);
  const key = HAS_IMAGE.has(category) ? category : null;

  if (!key) {
    return (
      <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }}>
        {cat.icon}
      </span>
    );
  }

  return (
    <img
      className={`cat-icon ${className}`}
      src={`/icons/cat/${key}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
