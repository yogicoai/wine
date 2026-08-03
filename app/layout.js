import {
  Cormorant_Garamond,
  Noto_Serif_KR,
  Noto_Sans_KR,
  Noto_Serif_JP,
  Noto_Sans_JP,
  Inter,
} from "next/font/google";
import { cookies } from "next/headers";
import { FONT_SCALE } from "@/lib/features";
import { APP, themeCss } from "@/lib/appProfile";
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
// 사케 앱의 제목용 — 서양 세리프로는 일본 술의 정서가 서지 않는다
const serifJp = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif-jp",
});

// 본문(메뉴·버튼·안내문)용 — 화면 언어를 따라간다.
// Pretendard 는 한글이 또렷한 대신 일본어 글자를 갖고 있지 않고, 라틴 자간도
// 영어 전용 서체만 못하다. 언어가 바뀌면 본문 서체도 함께 바뀌어야 한다.
const sansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-jp",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-latin",
});

// 앱이 고른 서체 세트를 --font-display 자리에 앉힌다
const FONT_SETS = {
  "latin-serif": cormorant.variable,
  "jp-serif": serifJp.variable,
};
const displayFont = FONT_SETS[APP.theme.fontSet] || cormorant.variable;
// 제목 글꼴 이름도 세트에 따라 갈아끼운다 (globals.css 의 --font-d 가 이걸 쓴다)
const DISPLAY_VAR = APP.theme.fontSet === "jp-serif" ? "--font-serif-jp" : "--font-display";

// 언어별 본문 서체 — 그 언어를 위해 만들어진 것을 앞에 세우고, 나머지는 뒤로 돌린다.
// 앞의 것이 그 글자를 갖고 있지 않으면 브라우저가 다음으로 넘어가므로,
// 한국어 화면에 섞인 일본어(사케 이름)도 빈 네모가 되지 않는다.
const BODY_FONTS = {
  ko: `Pretendard Variable, Pretendard, var(--font-sans-kr), var(--font-sans-jp), var(--font-sans-latin), sans-serif`,
  en: `var(--font-sans-latin), Pretendard Variable, var(--font-sans-kr), sans-serif`,
  ja: `var(--font-sans-jp), Pretendard Variable, var(--font-sans-kr), sans-serif`,
};
function bodyFontFor(locale) {
  return BODY_FONTS[locale] || BODY_FONTS.ko;
}

// 이름·설명은 앱 프로필에서 온다 — 와인·사케·맥주·전통술이 같은 소스를 쓴다
const TITLE = APP.name === APP.nameEn ? APP.name : `${APP.name} — ${APP.nameEn}`;
const DESC =
  APP.locale === "en"
    ? "Photograph any bottle. Get the story, the taste, the pairing, and where to buy."
    : `${APP.tagline}. 라벨을 찍으면 주종·가격·히스토리·페어링까지 읽어드립니다.`;

export const metadata = {
  title: TITLE,
  description: DESC,
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "website",
    locale: APP.locale === "en" ? "en_US" : "ko_KR",
  },
  // 시연 단계에서는 검색엔진에 노출되지 않도록 (정식 출시 때 제거)
  robots: { index: false, follow: false },
  // 파비콘·홈 화면 아이콘 — 앱마다 다르다 (홈 화면에 여섯 앱이 나란히 깔려도 구분되게)
  icons: {
    icon: `/icons/app-${APP.key}-192.png`,
    apple: `/icons/app-${APP.key}-180.png`,
  },
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
//
// 지금은 기능을 내보내지 않으므로(lib/features.js) 배율을 적용하지 않는다.
// 전에 쓰던 사람의 기기에는 값이 남아 있어 그대로 두면 화면이 어긋난 채 뜬다.
const APPLY_SCALE = FONT_SCALE
  ? `try{
  var k=localStorage.getItem("${APP.storageKey}.fontScale");
  var v={s:0.92,m:1,l:1.12,xl:1.24}[k];
  if(v)document.documentElement.style.setProperty('--ui-zoom',v);
}catch(e){}`
  : `try{localStorage.removeItem('${APP.storageKey}.fontScale')}catch(e){}`;

export default async function RootLayout({ children }) {
  // 화면 언어는 쿠키가 정한다. 서버가 여기서 읽어 처음부터 그 언어로 그려야
  // 브라우저가 하이드레이션할 때 어긋나지 않는다 (언어 변경은 새로고침을 동반한다).
  const picked = (await cookies()).get("bl_locale")?.value;
  const uiLocale = picked === "ko" || picked === "en" || picked === "ja" ? picked : APP.locale;

  return (
    <html lang={uiLocale}>
      <head>
        {/* 앱별 색·서체 — globals.css 의 기본값(와인 앱)을 이 앱의 것으로 덮는다 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `${themeCss()}:root{--font-d:var(${DISPLAY_VAR}),var(--font-serif-kr),serif;--font-b:${bodyFontFor(uiLocale)};}`,
          }}
        />
        {/* Pretendard — 한글 UI 가독성이 좋고, 쓰이는 글자만 내려받는 방식이라 가볍다 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: APPLY_SCALE }} />
      </head>
      <body
        className={`${displayFont} ${serifKr.variable} ${sansKr.variable} ${sansJp.variable} ${inter.variable}`}
      >
        {/* 전통 문양 층 — 앱이 문양을 정했을 때만 보인다 (없으면 투명) */}
        {APP.theme.pattern && <div className="pattern-layer" aria-hidden="true" />}
        {children}
      </body>
    </html>
  );
}
