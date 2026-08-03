/** @type {import('next').NextConfig} */
const nextConfig = {
  // 촬영 이미지(base64)가 body 로 넘어오므로 서버 액션/라우트 한도 상향
  experimental: {},
  // 앱마다 빌드 폴더를 나눈다 (scripts/dev.mjs 가 넣어 준다).
  // 이래야 와인·사케·맥주를 동시에 띄워 놓고 견줄 수 있다.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
