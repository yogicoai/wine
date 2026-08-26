// 못 붙은 이름을 짧게 줄여 가며 데일리샷이 뭐라 부르는지 본다.
//   node scripts/_probe-miss.mjs 1 40
import { readFileSync } from "node:fs";

const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const from = Number(process.argv[2] || 1), to = Number(process.argv[3] || 40);
const names = readFileSync("scripts/_miss-whisky.txt", "utf8").split(/\r?\n/).filter(Boolean).slice(from - 1, to);

const SKIP = /[&+]|\d종|바이알|Old No|츠쿠리와케/;
for (const n of names) {
  if (SKIP.test(n)) { console.log(`— ${n}   (세트·바이알이라 건너뜀)`); continue; }
  // 앞 두 낱말로 줄여서 찾는다 — 상표만 남기면 그쪽 표기가 드러난다
  const q = n.split(/\s+/).slice(0, 2).join(" ");
  try {
    const r = await fetch(`${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=6`, { headers: HEAD });
    const j = await r.json();
    const hits = (j?.results || []).filter((x) => !/세트|기획|패키지|잔/.test(x.name)).slice(0, 3);
    console.log(`▸ ${n}   [${q}]`);
    if (!hits.length) console.log(`    없음`);
    hits.forEach((x) => console.log(`    ${x.name}   ${Number(x.price) ? Number(x.price).toLocaleString() + "원" : ""}`));
  } catch { console.log(`▸ ${n}   조회 실패`); }
  await new Promise((s) => setTimeout(s, 220));
}
process.exit(0);
