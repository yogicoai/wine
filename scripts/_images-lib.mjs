// 사진 받기·규격 통일 도우미 — images-stage.mjs 와 images-from-research.mjs 가 같이 쓴다.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

export const ROOT = "data/images";
const UA = "Mozilla/5.0 (compatible; BottleLens/1.0)";

export async function download(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  const buf = Buffer.from(await r.arrayBuffer());
  // 데일리샷 이미지 서버는 webp 를 application/octet-stream 으로 내려보낸다. 헤더만 믿고 거르면
  // 그 사진을 전부 버리고 네이버 사진으로 대신하게 된다 (417건이 그렇게 대체됐다).
  // 그래서 헤더가 아니라 파일 머리의 표식으로 이미지인지 본다 — JPEG · PNG · GIF · WebP.
  const head = buf.subarray(0, 12);
  const isImg =
    (head[0] === 0xff && head[1] === 0xd8) ||
    (head[0] === 0x89 && head.toString("latin1", 1, 4) === "PNG") ||
    head.toString("latin1", 0, 3) === "GIF" ||
    (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP");
  if (!isImg) throw new Error(`이미지 아님 (${ct || "형식 없음"})`);
  if (buf.length < 1500) throw new Error("너무 작음");
  if (buf.length > 8 * 1024 * 1024) throw new Error("너무 큼");
  return buf;
}

/**
 * 네이버쇼핑이 성인 상품 사진에 덧씌운 "19" 배지를 지운다.
 *
 * 배지가 이미지 파일에 구워져 있다 — 받은 사진 12장이 12장 다 오른쪽 위에 빨간 동그라미가
 * 있었다. 그대로 두면 우리 앱에 남의 표시가 박히고, 흰 테두리를 걷을 때 배지까지 사진으로
 * 쳐서 병이 한쪽으로 쏠린다. 그래서 걷기 전에 먼저 지운다.
 *
 * 위치로만 찾으면 안 된다. 빨간 라벨이 오른쪽 위에 있는 병이 있다. 그래서 세 가지를 함께
 * 본다 — 빨간 점들이 모인 덩어리가 (1) 거의 정사각형이고 (2) 사진 너비의 7~25% 이며
 * (3) 오른쪽 위 구석에 붙어 있을 때만 배지로 보고 흰색으로 덮는다.
 */
export async function stripAdultBadge(buf) {
  const { data, info } = await sharp(buf, { failOn: "none" }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  // 배지는 자리가 정해져 있다. 600×600 원본에서 x 460~579, y 20~139 (너비의 20%, 위·오른쪽에서 3%).
  // 처음에는 오른쪽 위 넓은 영역의 빨간 점을 한 덩어리로 묶었는데, 병의 빨간 라벨이 섞여
  // 덩어리가 커져 12장 중 3장을 놓쳤다. 그래서 배지가 있는 구역 안에서만 본다.
  const x0 = Math.floor(W * 0.74), x1 = Math.floor(W * 0.99);
  const y0 = Math.floor(H * 0.01), y1 = Math.floor(H * 0.26);
  let minX = W, minY = H, maxX = -1, maxY = -1, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      // JPEG 때문에 빨강이 살짝 번진다 — 느슨하게 본다
      if (data[i] > 170 && data[i + 1] < 140 && data[i + 2] < 140 && data[i] - data[i + 1] > 70) {
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 60) return buf;
  const bw = maxX - minX + 1, bh = maxY - minY + 1, ar = bw / bh;
  if (ar < 0.85 || ar > 1.18) return buf;                 // 동그라미라 거의 정사각형
  if (bw < W * 0.15 || bw > W * 0.24) return buf;         // 너비의 15~24%
  if (maxX < W * 0.93 || minY > H * 0.08) return buf;     // 구석에 붙어 있다
  const m = Math.ceil(Math.max(bw, bh) * 0.12);
  const left = Math.max(0, minX - m), top = Math.max(0, minY - m);
  const w = Math.min(W - left, bw + 2 * m), h = Math.min(H - top, bh + 2 * m);
  const white = await sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } }).png().toBuffer();
  return sharp(buf, { failOn: "none" }).rotate().composite([{ input: white, left, top }]).toBuffer();
}

// 규격 통일 — 회전 바로잡기 · 투명은 흰색으로 · 흰 테두리 걷기 · 640 이내 · WebP
export async function normalize(buf, { source } = {}) {
  if (source === "naver-shopping") buf = await stripAdultBadge(buf);
  const base = sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  const trimmed = await base.clone().trim({ background: "#ffffff", threshold: 14 }).toBuffer({ resolveWithObject: true });
  // 걷고 났더니 거의 안 남으면 걷지 않은 원본을 쓴다 (흰 병 · 흰 라벨)
  const useTrim = trimmed.info.width >= 80 && trimmed.info.height >= 80;
  let pipeline = sharp(useTrim ? trimmed.data : await base.toBuffer());
  const m = await pipeline.metadata();
  const pad = Math.round(Math.max(m.width, m.height) * 0.04); // 숨 쉴 자리
  const out = await pipeline
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = out.info;
  const stats = await sharp(out.data).stats();
  const spread = stats.channels.reduce((a, c) => a + c.stdev, 0) / stats.channels.length;
  if (Math.min(w, h) < 110 || Math.max(w, h) < 200) throw new Error(`작음 ${w}×${h}`);
  if (Math.max(w, h) / Math.min(w, h) > 5) throw new Error(`비율 이상 ${w}×${h}`);
  if (spread < 5) throw new Error("빈 이미지");
  return { data: out.data, w, h };
}

export function stagePath(category, hash) {
  const dir = `${ROOT}/stage/${category}/${hash[0]}`;
  mkdirSync(dir, { recursive: true });
  return { dir, file: `${dir}/${hash}.webp`, rel: `stage/${category}/${hash[0]}/${hash}.webp` };
}
