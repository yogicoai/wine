// SVG 국기 아이콘.
//
// 이모지 국기는 Windows 크롬에서 렌더링되지 않고 "KR" 같은 글자로 보인다.
// 그래서 작게 그린 SVG를 쓴다. 목록에서 알아볼 수 있을 만큼만 단순화했고,
// 복잡한 문양(태극 괘, 성조기 별 등)은 크기상 생략했다.
import { countryCode } from "@/lib/flags";

// 4:3 viewBox 기준으로 그린다
const DRAW = {
  fr: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.33" height="3" fill="#0055A4" />
      <rect x="2.67" width="1.33" height="3" fill="#EF4135" />
    </>
  ),
  it: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.33" height="3" fill="#009246" />
      <rect x="2.67" width="1.33" height="3" fill="#CE2B37" />
    </>
  ),
  ie: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.33" height="3" fill="#169B62" />
      <rect x="2.67" width="1.33" height="3" fill="#FF883E" />
    </>
  ),
  mx: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.33" height="3" fill="#006847" />
      <rect x="2.67" width="1.33" height="3" fill="#CE1126" />
      <circle cx="2" cy="1.5" r="0.35" fill="#8a6d3b" />
    </>
  ),
  de: () => (
    <>
      <rect width="4" height="3" fill="#000" />
      <rect y="1" width="4" height="1" fill="#DD0000" />
      <rect y="2" width="4" height="1" fill="#FFCE00" />
    </>
  ),
  at: () => (
    <>
      <rect width="4" height="3" fill="#ED2939" />
      <rect y="1" width="4" height="1" fill="#fff" />
    </>
  ),
  hu: () => (
    <>
      <rect width="4" height="3" fill="#436F4D" />
      <rect width="4" height="2" fill="#fff" />
      <rect width="4" height="1" fill="#CD2A3E" />
    </>
  ),
  es: () => (
    <>
      <rect width="4" height="3" fill="#AA151B" />
      <rect y="0.75" width="4" height="1.5" fill="#F1BF00" />
    </>
  ),
  pt: () => (
    <>
      <rect width="4" height="3" fill="#DA291C" />
      <rect width="1.6" height="3" fill="#046A38" />
      <circle cx="1.6" cy="1.5" r="0.55" fill="#FFE900" />
      <circle cx="1.6" cy="1.5" r="0.3" fill="#DA291C" />
    </>
  ),
  gr: () => (
    <>
      <rect width="4" height="3" fill="#0D5EAF" />
      {[0.6, 1.8, 3].map((y) => (
        <rect key={y} y={y - 0.3} width="4" height="0.33" fill="#fff" />
      ))}
      <rect width="1.5" height="1.65" fill="#0D5EAF" />
      <rect x="0.6" width="0.33" height="1.65" fill="#fff" />
      <rect y="0.66" width="1.5" height="0.33" fill="#fff" />
    </>
  ),
  ge: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect x="1.7" width="0.6" height="3" fill="#f00" />
      <rect y="1.2" width="4" height="0.6" fill="#f00" />
    </>
  ),
  gb: () => (
    <>
      <rect width="4" height="3" fill="#012169" />
      <path d="M0 0 L4 3 M4 0 L0 3" stroke="#fff" strokeWidth="0.6" />
      <path d="M0 0 L4 3 M4 0 L0 3" stroke="#C8102E" strokeWidth="0.25" />
      <rect x="1.7" width="0.6" height="3" fill="#fff" />
      <rect y="1.2" width="4" height="0.6" fill="#fff" />
      <rect x="1.8" width="0.4" height="3" fill="#C8102E" />
      <rect y="1.3" width="4" height="0.4" fill="#C8102E" />
    </>
  ),
  sct: () => (
    <>
      <rect width="4" height="3" fill="#005EB8" />
      <path d="M0 0 L4 3 M4 0 L0 3" stroke="#fff" strokeWidth="0.55" />
    </>
  ),
  us: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      {[0, 0.86, 1.72, 2.57].map((y) => (
        <rect key={y} y={y} width="4" height="0.43" fill="#B22234" />
      ))}
      <rect width="1.8" height="1.5" fill="#3C3B6E" />
    </>
  ),
  ca: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1" height="3" fill="#FF0000" />
      <rect x="3" width="1" height="3" fill="#FF0000" />
      <path d="M2 0.7 L2.35 1.4 L2.75 1.3 L2.45 1.9 L2.6 2.3 L2 2.15 L1.4 2.3 L1.55 1.9 L1.25 1.3 L1.65 1.4 Z" fill="#FF0000" />
    </>
  ),
  cl: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect y="1.5" width="4" height="1.5" fill="#D52B1E" />
      <rect width="1.4" height="1.5" fill="#0039A6" />
      <path d="M0.7 0.35 L0.85 0.75 L1.25 0.75 L0.93 1 L1.05 1.4 L0.7 1.15 L0.35 1.4 L0.47 1 L0.15 0.75 L0.55 0.75 Z" fill="#fff" />
    </>
  ),
  ar: () => (
    <>
      <rect width="4" height="3" fill="#74ACDF" />
      <rect y="1" width="4" height="1" fill="#fff" />
      <circle cx="2" cy="1.5" r="0.35" fill="#F6B40E" />
    </>
  ),
  cu: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      {[0, 1.2, 2.4].map((y) => (
        <rect key={y} y={y} width="4" height="0.6" fill="#002A8F" />
      ))}
      <path d="M0 0 L2 1.5 L0 3 Z" fill="#CF142B" />
      <circle cx="0.6" cy="1.5" r="0.28" fill="#fff" />
    </>
  ),
  au: () => (
    <>
      <rect width="4" height="3" fill="#012169" />
      <path d="M0 0 L1.6 1.2 M1.6 0 L0 1.2" stroke="#fff" strokeWidth="0.28" />
      <rect x="0.66" width="0.28" height="1.2" fill="#fff" />
      <rect y="0.46" width="1.6" height="0.28" fill="#fff" />
      {[[3, 0.6], [2.5, 1.5], [3.5, 1.5], [3, 2.4], [1, 2.2]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.16" fill="#fff" />
      ))}
    </>
  ),
  nz: () => (
    <>
      <rect width="4" height="3" fill="#012169" />
      <path d="M0 0 L1.6 1.2 M1.6 0 L0 1.2" stroke="#fff" strokeWidth="0.28" />
      <rect x="0.66" width="0.28" height="1.2" fill="#fff" />
      <rect y="0.46" width="1.6" height="0.28" fill="#fff" />
      {[[3, 0.7], [2.5, 1.6], [3.5, 1.6], [3, 2.4]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.17" fill="#CC142B" stroke="#fff" strokeWidth="0.07" />
      ))}
    </>
  ),
  za: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="4" height="1.2" fill="#E03C31" />
      <rect y="1.8" width="4" height="1.2" fill="#001489" />
      <path d="M0 0.2 L2.2 1.5 L0 2.8 Z" fill="#007749" />
      <path d="M0 0.55 L1.6 1.5 L0 2.45 Z" fill="#FFB81C" />
      <path d="M0 0.9 L1 1.5 L0 2.1 Z" fill="#000" />
    </>
  ),
  kr: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <path d="M2 0.85 A0.65 0.65 0 0 1 2 2.15 A0.325 0.325 0 0 1 2 1.5 A0.325 0.325 0 0 0 2 0.85" fill="#CD2E3A" />
      <path d="M2 2.15 A0.65 0.65 0 0 1 2 0.85 A0.325 0.325 0 0 1 2 1.5 A0.325 0.325 0 0 0 2 2.15" fill="#0047A0" />
      {[[0.55, 0.55, 45], [3.45, 0.55, -45], [0.55, 2.45, -45], [3.45, 2.45, 45]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-0.3" y="-0.22" width="0.6" height="0.11" fill="#000" />
          <rect x="-0.3" y="-0.05" width="0.6" height="0.11" fill="#000" />
          <rect x="-0.3" y="0.12" width="0.6" height="0.11" fill="#000" />
        </g>
      ))}
    </>
  ),
  jp: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <circle cx="2" cy="1.5" r="0.75" fill="#BC002D" />
    </>
  ),
  cn: () => (
    <>
      <rect width="4" height="3" fill="#DE2910" />
      <path d="M0.8 0.45 L1 1.05 L1.6 1.05 L1.1 1.4 L1.3 2 L0.8 1.6 L0.3 2 L0.5 1.4 L0 1.05 L0.6 1.05 Z" fill="#FFDE00" transform="scale(0.9) translate(0.15 0.1)" />
    </>
  ),
  in: () => (
    <>
      <rect width="4" height="3" fill="#fff" />
      <rect width="4" height="1" fill="#FF9933" />
      <rect y="2" width="4" height="1" fill="#138808" />
      <circle cx="2" cy="1.5" r="0.32" fill="none" stroke="#000080" strokeWidth="0.09" />
    </>
  ),
};

/**
 * <Flag country="프랑스" /> — 모르는 국가면 아무것도 그리지 않는다.
 * 빈 자리보다 없는 편이 낫다.
 */
export default function Flag({ country, width = 18, className = "" }) {
  const code = countryCode(country);
  const draw = code && DRAW[code];
  if (!draw) return null;

  return (
    <svg
      className={`flag ${className}`}
      width={width}
      height={Math.round(width * 0.75)}
      viewBox="0 0 4 3"
      role="img"
      aria-label={country}
    >
      <title>{country}</title>
      {draw()}
      {/* 흰 바탕 국기가 어두운 배경에서 떠 보이지 않게 하는 테두리 */}
      <rect width="4" height="3" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.12" />
    </svg>
  );
}
