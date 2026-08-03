"use client";

import { THEME } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

// 4~6축 레이더 차트 — 술의 플레이버 시그니처 / 사용자 취향 프로필 공용
// 색은 앱 프로필의 accent 를 따른다 (SVG 속성이라 CSS 변수를 못 쓴다)
export default function Radar({ profile, size = 240, accent = THEME.accent }) {
  if (!Array.isArray(profile) || profile.length < 3) return null;

  const c = size / 2;
  const rMax = size * 0.325;
  const n = profile.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r];

  const rings = [0.33, 0.66, 1].map((f) =>
    profile.map((_, i) => pt(i, rMax * f).join(",")).join(" ")
  );
  const shape = profile
    .map((p, i) => pt(i, (Math.max(0, Math.min(100, p.value || 0)) / 100) * rMax).join(","))
    .join(" ");

  return (
    <div className="radar-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((r, i) => (
          <polygon key={i} points={r} fill="none" stroke={THEME.accentLine} />
        ))}
        {profile.map((_, i) => {
          const [x, y] = pt(i, rMax);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={THEME.accentLine} />;
        })}
        <polygon points={shape} fill={THEME.accentFill} stroke={accent} strokeWidth="1.5" />
        {profile.map((p, i) => {
          const [x, y] = pt(i, rMax + 18);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">
              {t(p.axis)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
