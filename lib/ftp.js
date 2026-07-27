// Cafe24(yogibo 오픈호스팅) 이미지 업로드
// 썸네일을 DB에 base64로 넣으면 문서가 비대해지고 무료 티어 용량을 빠르게 소진하므로,
// 이미지는 웹호스팅에 올리고 DB에는 주소만 저장한다.
import { Readable } from "node:stream";
import { Client } from "basic-ftp";
import { env } from "./env";

export function ftpConfigured() {
  return !!(env("YOGIBO_FTP") && env("YOGIBO_FTP_ID") && env("YOGIBO_FTP_PW"));
}

// 원격 디렉터리 (예: /app/img/wine/)
function remoteDir() {
  const dir = env("YOGIBO_FPT_LINK", "/app/img/wine/");
  return dir.endsWith("/") ? dir : `${dir}/`;
}

// 공개 URL — FTP 경로와 공개 베이스를 이어 붙인다
export function publicUrl(filename) {
  const base = env("FTP_PUBLIC_BASE").replace(/\/+$/, "");
  const dir = remoteDir().replace(/^\/+/, "");
  return `${base}/${dir}${filename}`;
}

// 파일명: 날짜별 폴더 없이 평면 구조 + 충돌 방지용 난수
export function makeFilename(prefix = "scan", ext = "jpg") {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${stamp}_${rand}.${ext}`;
}

/**
 * 이미지를 업로드하고 공개 URL을 돌려준다.
 * 실패하면 예외를 던지므로, 호출부에서 base64 저장으로 폴백할 것.
 */
export async function uploadImage(buffer, filename) {
  if (!ftpConfigured()) throw new Error("FTP 설정 없음");

  // 서버리스 환경에서는 FTP 패시브 모드가 막힐 수 있다.
  // 오래 매달리지 않도록 짧게 끊고, 실패하면 호출부가 base64 저장으로 폴백한다.
  const client = new Client(8000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: env("YOGIBO_FTP"),
      user: env("YOGIBO_FTP_ID"),
      password: env("YOGIBO_FTP_PW"),
      secure: false,
    });
    await client.ensureDir(remoteDir()); // 없으면 생성하고 그 위치로 이동
    await client.uploadFrom(Readable.from(buffer), filename);
    return publicUrl(filename);
  } finally {
    client.close();
  }
}
