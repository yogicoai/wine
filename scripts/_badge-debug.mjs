import sharp from "sharp";
import { readFileSync } from "node:fs";
const m = JSON.parse(readFileSync("data/images/manifest.json", "utf8"));
const names = ["MB 롤랜드 스트레이트 버번", "그린 레이블 43도", "글렌모렌지 오리지널 10년", "글렌파클라스 105", "글렌드로낙 12년"];
for (const n of names) {
  const e = m[n]; if (!e) { console.log("기록 없음", n); continue; }
  const r = await fetch(e.origin); const buf = Buffer.from(await r.arrayBuffer());
  const { data, info } = await sharp(buf, { failOn: "none" }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  // 느슨한 빨강 판정으로 덩어리를 본다
  const lo = (R, G, B) => R > 170 && G < 140 && B < 140 && R - G > 70;
  let minX = W, minY = H, maxX = -1, maxY = -1, cnt = 0;
  for (let y = 0; y < Math.floor(H * 0.4); y++) for (let x = Math.floor(W * 0.5); x < W; x++) {
    const i = (y * W + x) * C;
    if (lo(data[i], data[i + 1], data[i + 2])) { cnt++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  console.log(`${n.padEnd(24)} 원본 ${W}×${H}  빨강 ${cnt}점  덩어리 ${cnt ? `x ${minX}~${maxX} (${(maxX / W * 100).toFixed(0)}%) y ${minY}~${maxY} (${(minY / H * 100).toFixed(0)}%)  ${bw}×${bh}  비율 ${(bw / bh).toFixed(2)}  너비/사진 ${(bw / W * 100).toFixed(0)}%` : "없음"}`);
}
process.exit(0);
