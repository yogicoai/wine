// 사진 찾기 묶음 만들기 — 사진이 없는(없음·받다 실패·거절) 술을 8개씩 묶어 data/images/_work/find-in/ 에 쓴다.
//   node --env-file=.env.local scripts/images-findpack.mjs [--batch 8] [--prefix fnd] [--limit 2000]
// 이 뒤: node scripts/research-runner.mjs --kind imgfind --queue fnd --lanes 3
//        → data/images/_work/find-out/ → node scripts/images-from-research.mjs --apply → 사진 눈 확인
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { readManifest } from "./_manifest-lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BATCH = Number(arg("--batch", 8)), PREFIX = arg("--prefix", "fnd"), LIMIT = Number(arg("--limit", 100000));
const DIR = "data/images/_work/find-in";
mkdirSync(DIR, { recursive: true });

const m = readManifest();
// 사진이 아직 없는 술 — 공개(live)·확인(verified)·대기(staged) 된 것은 이미 사진이 있다. 거절된 것도 다시 찾는다.
const need = Object.values(m).filter((e) => ["missing", "failed", "rejected"].includes(e.status));
// 한 번 찾아본 술은 다시 찾지 않는다 (찾기 결과 파일이 있으면 collector 가 기록한 tries 에 남는다)
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ name: { $in: need.map((e) => e.name) }, notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } },
  { projection: { name: 1, category: 1, producer: 1, "result.type": 1, "result.producer": 1, "result.alcohol": 1, "result.country": 1, "sourceFacts.dailyshot.name": 1, "sourceFacts.dailyshot.facts": 1 } }).toArray();
const byName = new Map(docs.map((d) => [d.name, d]));

const rows = need.filter((e) => byName.has(e.name) && !(e.tries || []).some((t) => t.source === "image-finder" || t.source === "research-page")).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "ko")).slice(0, LIMIT);
let n = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  n++;
  const items = rows.slice(i, i + BATCH).map((e) => {
    const d = byName.get(e.name), r = d.result || {}, ds = d.sourceFacts?.dailyshot;
    const hint = [r.type, r.producer || d.producer, r.alcohol, r.country, ds?.facts?.volume, ds?.name && ds.name !== d.name ? `판매처 이름: ${ds.name}` : null].filter(Boolean).join(" · ");
    return { name: e.name, category: d.category, hint };
  });
  writeFileSync(`${DIR}/${PREFIX}-${String(n).padStart(3, "0")}.json`, JSON.stringify(items, null, 1), "utf8");
}
console.log(`사진이 없는 술 ${need.length}종 중 찾기 대상 ${rows.length}종 → 묶음 ${n}개 (${DIR}/${PREFIX}-001.json …)`);
await client.close();
process.exit(0);
