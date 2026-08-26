// 못 붙은 것을 갈래로 나눈다 — 고칠 수 있는 것과 없는 것을 가른다.
import { readFileSync } from "node:fs";
import { searchName } from "../lib/dailyshot.js";

const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const VOL_OK = [700, 750];
const mlOf = (s) => {
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*(ml|l|리터)(?![a-z가-힣])/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /^(l|리터)$/i.test(m[2]) ? Math.round(n * 1000) : Math.round(n);
};

const names = readFileSync("scripts/_miss-whisky.txt", "utf8").split(/\r?\n/).filter(Boolean);
const bucket = { 세트: [], 바이알: [], 용량: [], 미취급: [], 모호: [] };

for (const n of names) {
  if (/\s[&+]|\+\s|\d+종/.test(n)) { bucket.세트.push(n); continue; }
  if (/바이알|슈터/.test(n)) { bucket.바이알.push(n); continue; }
  const q = searchName(n, "whisky");
  let hits = [];
  try {
    const r = await fetch(`${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=10`, { headers: HEAD });
    hits = ((await r.json())?.results || []).filter((x) => !/세트|기획|패키지|잔|바이알/.test(x.name));
  } catch {}
  await new Promise((s) => setTimeout(s, 200));

  // 상표(첫 낱말)가 든 후보가 하나도 없으면 그쪽이 안 파는 것이다
  const brand = q.split(/\s+/)[0];
  const same = hits.filter((x) => x.name.replace(/\s/g, "").includes(brand.replace(/\s/g, "")));
  if (!same.length) { bucket.미취급.push(n); continue; }
  // 후보는 있는데 전부 700/750 이 아니면 용량 때문에 걸린 것이다
  const vols = same.map((x) => mlOf(x.volume) || mlOf(x.name)).filter(Boolean);
  if (vols.length && !vols.some((v) => VOL_OK.includes(v))) {
    bucket.용량.push(`${n}   (${[...new Set(vols)].join("·")}ml)`);
    continue;
  }
  bucket.모호.push(`${n}   →  ${same[0].name}`);
}

const 설명 = {
  세트: "여러 병을 묶은 것 — 낱병 값이 없다",
  바이알: "30ml 맛보기 — 병값으로 쓰면 안 된다",
  용량: "그쪽에 1L·375ml 만 있다 — 다른 용량은 다른 값이다",
  미취급: "데일리샷이 안 판다 — 고쳐도 안 붙는다",
  모호: "후보는 있는데 어느 것인지 못 고른다 — 고칠 여지가 있다",
};
for (const [k, v] of Object.entries(bucket)) {
  console.log(`\n[${k}] ${v.length}종 — ${설명[k]}`);
  v.forEach((x) => console.log(`   ${x}`));
}
process.exit(0);
