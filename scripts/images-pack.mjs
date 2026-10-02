// 사진 확인 묶음 만들기 — 규격을 맞춘 사진(staged)을 에이전트가 열어 볼 묶음으로 나눈다.
//   node scripts/images-pack.mjs --prefix img --batch 14 [--cat whisky] [--limit 300]
// 출력: data/images/_work/in/<prefix>-<번호>.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const prefix = arg("--prefix", "img");
const batch = Number(arg("--batch", 14));
const cat = arg("--cat");
const limit = Number(arg("--limit", 1e9));

const m = JSON.parse(readFileSync("data/images/manifest.json", "utf8"));
const source = arg("--source");     // 예: research-page — 에이전트가 가져온 사진만 묶는다 (이미 묶인 것을 또 묶지 않게)
let rows = Object.values(m).filter((e) => e.status === "staged" && e.file && (!cat || e.category === cat) && (!source || e.source === source));
rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "ko"));
rows = rows.slice(0, limit);

const DIR = "data/images/_work/in";
mkdirSync(DIR, { recursive: true });
let n = 0;
for (let i = 0; i < rows.length; i += batch) {
  n++;
  const items = rows.slice(i, i + batch).map((e) => ({
    name: e.name, category: e.category, file: `data/images/${e.file}`, source: e.source,
  }));
  writeFileSync(`${DIR}/${prefix}-${String(n).padStart(3, "0")}.json`, JSON.stringify(items, null, 1), "utf8");
}
console.log(`확인할 사진 ${rows.length}장 → 묶음 ${n}개 (${DIR}/${prefix}-001.json …)`);
process.exit(0);
