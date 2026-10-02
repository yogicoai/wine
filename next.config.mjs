/** @type {import('next').NextConfig} */
const nextConfig = {
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
