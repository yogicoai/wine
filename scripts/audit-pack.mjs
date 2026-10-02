// 표본 재검증 묶음 만들기 — 웹 조사로 검증된 술에서 무작위로 골라 감사(audit) 입력을 만든다 (DB 는 읽기만).
//
//   node --env-file=.env.local scripts/audit-pack.mjs [--a 16 --b 11 --c 13] [--per 4] [--seed 20261002]
//
// 등급(A·B·C)별로 따로 뽑는다(층화). 같은 시드면 같은 표본이 나온다.
// 출력: data/research/_work/audit-in/au-NNN.json (묶음마다 술 --per 개) · data/research/_work/audit-sample.json (표본 목록)
// 감사자가 우리 출처에 끌려가지 않도록 verified.sources 는 넣지 않는다 — 스스로 출처를 찾게 한다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAKE = { A: Number(arg("--a", 16)), B: Number(arg("--b", 11)), C: Number(arg("--c", 13)) };
const PER = Number(arg("--per", 4));
let seed = Number(arg("--seed", 20261002)) >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 감사할 칸 — 사실을 담는 칸만 (맛 표현·페어링·팁은 뺀다)
const FIELDS = ["country", "region", "producer", "type", "alcohol", "vintage", "specs", "history", "story", "winery", "trivia", "aging"];

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, "verified.by": "web-research" }, { projection: { key: 1, name: 1, category: 1, "verified.level": 1, result: 1 } }).sort({ key: 1 }).toArray();

const byLevel = { A: [], B: [], C: [] };
for (const d of docs) byLevel[d.verified?.level === "A" || d.verified?.level === "B" ? d.verified.level : "C"].push(d);
const picked = [];
for (const lv of ["A", "B", "C"]) for (const d of shuffle(byLevel[lv]).slice(0, TAKE[lv])) picked.push({ d, lv });
shuffle(picked); // 묶음마다 등급·주종이 섞이게

const entries = picked.map(({ d, lv }) => {
  const fields = {};
  for (const f of FIELDS) { const v = d.result?.[f]; if (v != null && v !== "" && !(Array.isArray(v) && !v.length)) fields[f] = v; }
  return { key: d.key, name: d.name, category: d.category, level: lv, fields };
});

const IN = "data/research/_work/audit-in";
mkdirSync(IN, { recursive: true });
if (readdirSync(IN).some((f) => /^au-\d+\.json$/.test(f))) { console.error(`${IN} 에 이미 묶음이 있습니다 — 지우고 다시 만드세요`); process.exit(2); }
let n = 0;
for (let i = 0; i < entries.length; i += PER) {
  n++;
  writeFileSync(`${IN}/au-${String(n).padStart(3, "0")}.json`, JSON.stringify({ entries: entries.slice(i, i + PER) }, null, 1), "utf8");
}
writeFileSync("data/research/_work/audit-sample.json", JSON.stringify({ at: new Date().toISOString(), seed: Number(arg("--seed", 20261002)), take: TAKE, population: { A: byLevel.A.length, B: byLevel.B.length, C: byLevel.C.length }, items: entries.map(({ key, name, category, level }) => ({ key, name, category, level })) }, null, 1), "utf8");

const cats = {}; for (const e of entries) cats[e.category] = (cats[e.category] || 0) + 1;
console.log(`표본 ${entries.length}종 (A ${TAKE.A} · B ${TAKE.B} · C ${TAKE.C} / 모집단 A ${byLevel.A.length} · B ${byLevel.B.length} · C ${byLevel.C.length}) → 묶음 ${n}개 (${IN})`);
console.log("주종:", Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("예:", entries.slice(0, 6).map((e) => `${e.name}(${e.category}·${e.level}, 칸 ${Object.keys(e.fields).length})`).join(" | "));
await client.close();
process.exit(0);
