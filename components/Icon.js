// UI 아이콘 — 이모지는 OS·폰트에 따라 엉뚱한 글리프로 렌더링되므로 인라인 SVG로 그린다.
// 모두 24×24 좌표계, currentColor를 따르므로 CSS 색상만 지정하면 된다.

import { APP } from "@/lib/appProfile";

// "잔" 아이콘은 앱마다 담는 그릇이 다르다 — 사케 앱 탭에 와인잔이 떠 있으면
// 색을 아무리 맞춰도 남의 앱처럼 보인다. name="glass" 는 이 표에서 먼저 찾는다.
const VESSELS = {
  // 도쿠리 — 좁은 목에서 둥근 몸통으로
  sake: (
    <>
      <path d="M9.9 3.5h4.2" />
      <path d="M10.4 3.5c.2 1.7-.2 2.8-1.3 4A6 6 0 1 0 14.9 7.5c-1.1-1.2-1.5-2.3-1.3-4" />
    </>
  ),
  // 파인트 잔 + 거품선
  beer: (
    <>
      <path d="M8.3 4.5h7.4l-.7 14.6a1.7 1.7 0 0 1-1.7 1.4h-2.6a1.7 1.7 0 0 1-1.7-1.4L8.3 4.5Z" />
      <path d="M8.6 8.3h6.8" />
    </>
  ),
  // 록 글라스 + 술 면
  whisky: (
    <>
      <path d="M6.5 4.5h11l-.7 13.7a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6.5 4.5Z" />
      <path d="M7.3 12.5h9.4" />
    </>
  ),
  // 쿠프 잔
  spirits: (
    <>
      <path d="M5.8 4.5h12.4c0 3.5-2.8 6.1-6.2 6.1S5.8 8 5.8 4.5Z" />
      <path d="M12 10.6v6.4M8.8 20.5h6.4" />
    </>
  ),
  // 달항아리
  tradition: (
    <>
      <path d="M9.9 3.8h4.2" />
      <path d="M10.3 3.8c0 .9-.5 1.6-1.4 2.2a6.7 6.7 0 1 0 6.2 0c-.9-.6-1.4-1.3-1.4-2.2" />
    </>
  ),
};

const PATHS = {
  camera: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.6" />
    </>
  ),
  gallery: (
    <>
      <rect x="4" y="5.5" width="16" height="13" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5 16 3.8-3.8 3 3L15 12.5l4 4" />
    </>
  ),
  glass: (
    <>
      <path d="M7 3.5h10l-.7 5.2A4.4 4.4 0 0 1 12 12.6a4.4 4.4 0 0 1-4.3-3.9L7 3.5Z" />
      <path d="M12 12.6v6.2M8.6 20.5h6.8" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
      <path d="M10 12.5h4" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  hourglass: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5v3.2c0 1 .4 2 1.2 2.7L12 12l-2.8 2.6c-.8.7-1.2 1.7-1.2 2.7v3.2" />
      <path d="M16 3.5v3.2c0 1-.4 2-1.2 2.7L12 12l2.8 2.6c.8.7 1.2 1.7 1.2 2.7v3.2" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5a1.5 1.5 0 0 1 1.5-1.5h11A2.5 2.5 0 0 1 19.5 6v13a1.5 1.5 0 0 1-1.5 1.5H6.5A2 2 0 0 1 4.5 18.5V5Z" />
      <path d="M4.5 17h13.5M8.5 7.5h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20c.6-3.7 3.6-6 7.2-6s6.6 2.3 7.2 6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
};

export default function Icon({ name, size = 20, stroke = 1.6, className }) {
  const path = name === "glass" ? VESSELS[APP.key] || PATHS.glass : PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
