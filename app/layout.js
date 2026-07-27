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

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={`${cormorant.variable} ${serifKr.variable} ${sansKr.variable}`}>
        {children}
      </body>
    </html>
  );
}
