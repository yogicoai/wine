// UI 아이콘 — 이모지는 OS·폰트에 따라 엉뚱한 글리프로 렌더링되므로 인라인 SVG로 그린다.
// 모두 24×24 좌표계, currentColor를 따르므로 CSS 색상만 지정하면 된다.

const PATHS = {
  camera: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.6" />
    </>
  ),
  gallery: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m4.5 17 4.2-4.2a1.6 1.6 0 0 1 2.2 0L15 16.5m0 0 1.6-1.6a1.6 1.6 0 0 1 2.2 0l1 1" />
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
};

export default function Icon({ name, size = 20, stroke = 1.6, className }) {
  const path = PATHS[name];
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
