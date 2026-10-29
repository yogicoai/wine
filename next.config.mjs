import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 작업 기준 폴더를 이 저장소로 못 박는다.
  // 비워 두면 Next 가 C:\Users\Yogibo Design\package-lock.json 을 보고 홈 폴더를 기준으로 잡는데,
  // 그러면 산출물 이름에 Dropbox 의 한글 폴더 이름이 섞여 Turbopack 이 글자 중간을 자르다 죽는다
  // ("start byte index … is not a char boundary", 2026-10-27 — 폴더를 Dropbox 로 옮긴 뒤).
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // 개발 서버 왼쪽 아래의 Next 표시를 끈다 — 떠 있는 아래 메뉴(밝은 디자인)를 가린다
  devIndicators: false,
  // 촬영 이미지(base64)가 body 로 넘어오므로 서버 액션/라우트 한도 상향
  experimental: {
    // 개발 서버의 영구 캐시(.next-<앱>/dev/cache)를 쓰지 않는다.
    // 몇 주 쌓이면 1GB 가 넘고, 서버를 끄다 반쯤 쓰인 채 남으면 다음 기동이
    // "Could not find the module … in the React Client Manifest" 오류로 멈춘다 (2026-10-02).
    // 대신 서버를 켤 때마다 처음부터 컴파일한다 — 첫 기동이 조금 느릴 뿐이다.
    turbopackFileSystemCacheForDev: false,
  },
  // 앱마다 빌드 폴더를 나눈다 (scripts/dev.mjs 가 넣어 준다).
  // 이래야 와인·사케·맥주를 동시에 띄워 놓고 견줄 수 있다.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
