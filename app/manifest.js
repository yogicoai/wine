import { APP } from "@/lib/appProfile";

// PWA 매니페스트 — 정적 public/manifest.json 대신 앱 프로필에서 생성한다.
// 같은 소스로 네 앱을 배포하므로 이름·언어가 앱마다 달라야 한다.
export default function manifest() {
  const desc =
    APP.locale === "en"
      ? "Photograph any bottle. Get the story, the taste, the pairing, and where to buy."
      : "술 라벨을 찍으면 주종·가격·히스토리·페어링까지, AI가 읽어드립니다.";
  return {
    name: APP.name === APP.nameEn ? APP.name : `${APP.name} — ${APP.nameEn}`,
    short_name: APP.name,
    description: desc,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // 앱마다 배경이 다르다 — 밝은 앱에서 검정으로 시작하면 열 때마다 한 번 깜빡인다
    background_color: APP.theme.bg,
    theme_color: APP.theme.bg,
    lang: APP.locale,
    // 홈 화면 아이콘도 앱마다 다르다 — 마크를 그 앱 배경색 판에 올린 것
    icons: [
      { src: `/icons/app-${APP.key}-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icons/app-${APP.key}-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icons/app-${APP.key}-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
