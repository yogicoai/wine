// 키 치유 — 문서의 key 가 앱 규칙(catalogKey)과 다른 것을 전부 바로잡는다.
//
// 왜: 내 보정 스크립트들이 "모든 괄호 제거" 규칙으로 키를 만들었는데,
// 앱(lib/nameClean.js)은 "맨 뒤 괄호만" 뗀다. 이름 가운데 괄호가 있는 술
// (고리키(強力), 쿠(空))에서 키가 갈라져 재적재마다 쌍둥이가 태어났다.
//
// 앱 로직을 문자 그대로 복제해 전 정식 문서를 검사한다:
//   키가 어긋난 문서 → 올바른 키의 문서가 이미 있으면 병합 후 삭제, 없으면 키만 교정.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// ── lib/nameClean.js + lib/catalog.js 복제 (한 글자도 다르면 이 사달이 난다)
function splitName(raw) {
  const s = String(raw || "").trim();
  if (!s) return { name: "", original: null };
  const m = s.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (!m) return { name: s, original: null };
  const name = m[1].trim();
  const inside = m[2].trim();
  if (name.length < 2) return { name: s, original: null };
  if (/^\d+(\.\d+)?\s*(ml|mL|L|도|%|년)$/i.test(inside)) return { name: s, original: null };
  return { name, original: inside };
}
function displayName(raw) {
  return splitName(raw).name;
}
function catalogKey(name, vintage) {
  const base = displayName(name)
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .normalize("NFKC");
  return `${base}|${vintage || ""}`;
}

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

const docs = await col.find({ tier: "full" }).toArray();
const byKey = new Map();
for (const d of docs) {
  if (!byKey.has(d.key)) byKey.set(d.key, []);
  byKey.get(d.key).push(d);
}

let fixedKey = 0, merged = 0, ok = 0;
for (const d of docs) {
  const want = catalogKey(d.name, d.vintage);
  if (d.key === want) { ok++; continue; }

  const existing = (byKey.get(want) || []).find((x) => String(x._id) !== String(d._id));
  if (existing) {
    // 올바른 키의 형제가 있다 — 이미지·조회수를 살리고 이쪽을 지운다
    const set = {};
    if (d.image && !existing.image) { set.image = d.image; set.imageSource = d.imageSource || null; }
    const hits = (existing.hits || 0) + (d.hits || 0);
    await col.updateOne({ _id: existing._id }, { $set: { ...set, hits } });
    await col.deleteOne({ _id: d._id });
    merged++;
    console.log(`병합·삭제: ${d.name} (${d.key} → ${want})`);
  } else {
    await col.updateOne({ _id: d._id }, { $set: { key: want } });
    byKey.set(want, [d]);
    fixedKey++;
    console.log(`키 교정: ${d.name} (${d.key} → ${want})`);
  }
}
console.log(`\n정상 ${ok} · 키 교정 ${fixedKey} · 병합 ${merged}`);
await client.close();
