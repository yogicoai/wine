"use client";
// 분석 결과를 이미지 한 장으로 그린다 (인스타 4:5 / 카톡 공유용).
// 서버를 거치지 않고 브라우저 캔버스에서 만들기 때문에 비용도 지연도 없다.

import { catOf } from "./cats";

const W = 1080;
const H = 1350;

const GOLD = "#d4b278";
const GOLD_HI = "#ecd7a4";
const GOLD_LO = "#8f6f3d";
const INK = "#efe7d6";
const INK_DIM = "#9a907e";
const LINE = "rgba(212,178,120,0.22)";

// next/font가 만든 실제 폰트 이름을 CSS 변수에서 읽어 온다
function fonts() {
  const root = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => (root.getPropertyValue(name) || "").trim() || fallback;
  return {
    display: `${pick("--font-display", "Georgia")}, "Noto Serif KR", serif`,
    serif: `${pick("--font-serif-kr", "")} , "Malgun Gothic", serif`.replace(/^\s*,/, ""),
    sans: `${pick("--font-sans-kr", "")} , "Malgun Gothic", sans-serif`.replace(/^\s*,/, ""),
  };
}

// 다른 도메인 이미지는 그대로 캔버스에 올릴 수 없으므로 우리 서버를 거쳐 불러온다
function sameOrigin(src) {
  if (!/^https?:\/\//i.test(src)) return src; // data:, blob:, 상대 경로는 그대로
  try {
    if (new URL(src).origin === location.origin) return src;
  } catch {
    return src;
  }
  return `/api/img?u=${encodeURIComponent(src)}`;
}

function loadImage(src, { crossOrigin } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // 실패해도 카드 생성은 계속한다
    img.src = src;
  });
}

// 글자를 폭에 맞춰 줄바꿈하고, 최대 줄 수를 넘으면 말줄임
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function goldGradient(ctx, y, height) {
  const g = ctx.createLinearGradient(0, y, 0, y + height);
  g.addColorStop(0, "#f6ecd4");
  g.addColorStop(0.45, GOLD_HI);
  g.addColorStop(1, GOLD_LO);
  return g;
}

// 4~6축 레이더 (결과 화면과 같은 형태)
function drawRadar(ctx, profile, cx, cy, r) {
  const n = profile.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, radius) => [cx + Math.cos(angle(i)) * radius, cy + Math.sin(angle(i)) * radius];

  ctx.lineWidth = 1.5;
  for (const f of [0.33, 0.66, 1]) {
    ctx.beginPath();
    profile.forEach((_, i) => {
      const [x, y] = pt(i, r * f);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }

  profile.forEach((_, i) => {
    const [x, y] = pt(i, r);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = LINE;
    ctx.stroke();
  });

  ctx.beginPath();
  profile.forEach((p, i) => {
    const value = Math.max(0, Math.min(100, p.value || 0)) / 100;
    const [x, y] = pt(i, r * value);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(212,178,120,0.22)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  return pt;
}

/**
 * 결과 → PNG Blob
 * @param {object} result 분석 결과
 * @param {string|null} thumb 사진/상품 이미지 주소 (없으면 주종 엠블럼)
 */
export async function renderShareCard(result, thumb) {
  await document.fonts?.ready;

  const f = fonts();
  const cat = catOf(result.category);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ── 배경: 셀러 톤 + 술 색으로 은은한 글로우
  ctx.fillStyle = "#12100c";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 260, 720);
  glow.addColorStop(0, `${result.liquidColor || "#6e1f30"}55`);
  glow.addColorStop(1, "rgba(18,16,12,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── 이중 헤어라인 프레임
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = "rgba(212,178,120,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(58, 58, W - 116, H - 116);

  // ── 상단 브랜드
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = `500 26px ${f.display}`;
  ctx.letterSpacing = "10px";
  ctx.fillText("BOTTLE LENS", W / 2, 128);
  ctx.letterSpacing = "0px";

  // ── 이미지 (사진 → 실패 시 엠블럼)
  const imgY = 176;
  const imgSize = 232;
  let drawn = null;
  if (thumb) drawn = await loadImage(sameOrigin(thumb), { crossOrigin: "anonymous" });
  if (!drawn) drawn = await loadImage(`/icons/cat/${result.category}.png`);

  if (drawn) {
    const box = imgSize;
    const x = (W - box) / 2;
    // 사진은 정사각으로 잘라 넣고, 엠블럼은 여백을 두고 그대로 둔다
    const isPhoto = !!thumb && drawn.naturalWidth > 0 && !drawn.src.includes("/icons/cat/");
    if (isPhoto) {
      const side = Math.min(drawn.naturalWidth, drawn.naturalHeight);
      const sx = (drawn.naturalWidth - side) / 2;
      const sy = (drawn.naturalHeight - side) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, imgY, box, box);
      ctx.clip();
      ctx.drawImage(drawn, sx, sy, side, side, x, imgY, box, box);
      ctx.restore();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, imgY, box, box);
    } else {
      const scale = Math.min((box * 0.86) / drawn.naturalWidth, (box * 0.86) / drawn.naturalHeight);
      const w = drawn.naturalWidth * scale;
      const h = drawn.naturalHeight * scale;
      ctx.drawImage(drawn, (W - w) / 2, imgY + (box - h) / 2, w, h);
    }
  }

  // ── 주종
  let y = imgY + imgSize + 62;
  ctx.fillStyle = GOLD;
  ctx.font = `500 24px ${f.sans}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(cat.label.toUpperCase(), W / 2, y);
  ctx.letterSpacing = "0px";

  // ── 제품명
  y += 72;
  ctx.font = `500 62px ${f.display}`;
  const nameLines = wrap(ctx, result.name, W - 220, 2);
  nameLines.forEach((line, i) => {
    ctx.fillStyle = goldGradient(ctx, y + i * 74 - 50, 70);
    ctx.fillText(line, W / 2, y + i * 74);
  });
  y += (nameLines.length - 1) * 74;

  // ── 구분선
  y += 44;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 150, y);
  ctx.lineTo(W / 2 - 22, y);
  ctx.moveTo(W / 2 + 22, y);
  ctx.lineTo(W / 2 + 150, y);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = `18px ${f.sans}`;
  ctx.fillText("✦", W / 2, y + 7);

  // ── 생산자·빈티지·지역
  y += 52;
  ctx.fillStyle = INK_DIM;
  ctx.font = `28px ${f.serif}`;
  const meta = [result.producer, result.vintage, result.region, result.alcohol]
    .filter(Boolean)
    .join("  ·  ");
  wrap(ctx, meta, W - 200, 2).forEach((line, i) => ctx.fillText(line, W / 2, y + i * 40));

  // ── 레이더 + 축 이름
  const profile = Array.isArray(result.tasteProfile) ? result.tasteProfile.slice(0, 6) : [];
  if (profile.length >= 3) {
    const cy = 900;
    const pt = drawRadar(ctx, profile, W / 2, cy, 132);
    ctx.fillStyle = INK_DIM;
    ctx.font = `24px ${f.sans}`;
    profile.forEach((p, i) => {
      const [x, ly] = pt(i, 132 + 40);
      ctx.textAlign = x < W / 2 - 10 ? "right" : x > W / 2 + 10 ? "left" : "center";
      ctx.fillText(p.axis, x, ly + 8);
    });
    ctx.textAlign = "center";
  }

  // ── 테이스팅 노트
  if (result.tastingNotes) {
    ctx.fillStyle = INK;
    ctx.font = `27px ${f.serif}`;
    const notes = wrap(ctx, result.tastingNotes, W - 210, 3);
    notes.forEach((line, i) => ctx.fillText(line, W / 2, 1112 + i * 42));
  }

  // ── 하단 서명
  ctx.strokeStyle = "rgba(212,178,120,0.16)";
  ctx.beginPath();
  ctx.moveTo(150, H - 148);
  ctx.lineTo(W - 150, H - 148);
  ctx.stroke();

  ctx.fillStyle = INK_DIM;
  ctx.font = `22px ${f.sans}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("AI 소믈리에가 읽은 라벨", W / 2, H - 104);
  ctx.letterSpacing = "0px";

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.95));
}
