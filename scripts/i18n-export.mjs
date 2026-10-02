// 번역할 한국어 문장을 뽑는다 — 문서의 번역층(i18n.en/ja)에 없는 필드만.
//
//   node --env-file=.env.local scripts/i18n-export.mjs [--scope stale|all] [--lang en|ja] [--fields a,b,c] [--sample N] [--out 경로]
//
//   --scope stale  조사로 고쳐져 번역이 지워진 문서(i18nStale) + 판매처 구조화로 채운 와인   (기본)
//   --scope all    번역층이 비어 있는 필드가 있는 모든 문서
//   --lang         한 언어에서만 비어 있는 필드를 센다 (기본: 둘 다)
//   --fields       이 필드만 (기본: 전부)  예) story,tastingNotes,winery,tips
//   --sample N     (품질 시험용) 필드가 골고루 섞이게 N 문장만
//
// 출력: <MT_DIR>/units.jsonl  한 줄 {"id": 내용해시, "text": 한국어 한 문장} — 같은 문장은 한 번만, 문서 순서대로
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { ALL_FIELDS, MT_DIR, mapField, uid } from "./mt/_lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SCOPE = arg("--scope", "stale");
const SAMPLE = Number(arg("--sample", 0));
const OUT = arg("--out", `${MT_DIR}/units.jsonl`);
const LANGS = arg("--lang") ? [arg("--lang")] : ["en", "ja"];
const FIELDS = arg("--fields") ? arg("--fields").split(",").filter((f) => ALL_FIELDS.includes(f)) : ALL_FIELDS;

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const q = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, result: { $exists: true } };
if (SCOPE === "stale") q.$or = [{ i18nStale: { $exists: true, $ne: [] } }, { enrichedBy: "dailyshot-structured" }];
const docs = await col.find(q, { projection: { name: 1, result: 1, i18n: 1 } }).sort({ _id: 1 }).toArray();

const units = new Map(); const byField = {};
let need = 0;
for (const d of docs) {
  for (const f of FIELDS) {
    const v = d.result?.[f];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    for (const lang of LANGS) {
      if (d.i18n?.[lang]?.[f] != null) continue;          // 이미 번역이 있는 필드는 건드리지 않는다
      need++;
      mapField(f, v, (s) => { const id = uid(s); if (!units.has(id)) { units.set(id, s); byField[f] = (byField[f] || 0) + 1; } return s; }, lang);
    }
  }
}
let rows = [...units].map(([id, text]) => ({ id, text }));
if (SAMPLE) { const step = Math.max(1, Math.floor(rows.length / SAMPLE)); rows = rows.filter((_, i) => i % step === 0).slice(0, SAMPLE); }
mkdirSync(MT_DIR, { recursive: true });
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
const chars = rows.reduce((a, r) => a + r.text.length, 0);
console.log(`문서 ${docs.length}개 · 번역층이 비어 있는 (문서·언어·필드) ${need}건 → 고유 문장 ${units.size}개 (한국어 ${chars.toLocaleString()}자)${SAMPLE ? ` — 시험용으로 ${rows.length}개만 씀` : ""} → ${OUT}`);
console.log("필드별 고유 문장:", JSON.stringify(Object.fromEntries(Object.entries(byField).sort((a, b) => b[1] - a[1]))));
await client.close();
process.exit(0);
