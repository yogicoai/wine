import { Cormorant_Garamond, Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});
const serifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif-kr",
});
const sansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-kr",
});

export const metadata = {
  title: "보틀 렌즈 — Bottle Lens",
  description: "술 라벨을 찍으면 주종·가격·히스토리·페어링까지, AI 소믈리에가 읽어드립니다.",
  applicationName: "보틀 렌즈",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "보틀 렌즈", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "보틀 렌즈 — Bottle Lens",
    description: "술 라벨을 찍으면 주종·가격·히스토리·페어링까지, AI 소믈리에가 읽어드립니다.",
    type: "website",
    locale: "ko_KR",
  },
  // 시연 단계에서는 검색엔진에 노출되지 않도록 (정식 출시 때 제거)
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 아이폰 노치 영역까지 배경이 채워지도록
  themeColor: "#12100c", // 모바일 브라우저 상단바 색
};

// 저장해 둔 글자 크기를 첫 그림 전에 적용한다.
// 리액트가 붙은 뒤에 적용하면 기본 크기로 한 번 그려졌다가 튄다.
// 이 시점에는 body 가 아직 없으므로 html 의 CSS 변수로 넘긴다 (globals.css 가 받아 쓴다)
const APPLY_SCALE = `try{
  var k=localStorage.getItem('bottlelens.fontScale');
  var v={s:0.92,m:1,l:1.12,xl:1.24}[k];
  if(v)document.documentElement.style.setProperty('--ui-zoom',v);
}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — 한글 UI 가독성이 좋고, 쓰이는 글자만 내려받는 방식이라 가볍다 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: APPLY_SCALE }} />
      </head>
      <body className={`${cormorant.variable} ${serifKr.variable} ${sansKr.variable}`}>
        {children}
      </body>
    </html>
  );
}
