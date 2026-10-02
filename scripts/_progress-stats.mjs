// 진행 현황 수치 — 주종별로 한 번에 센다.
//   node --env-file=.env.local scripts/_progress-stats.mjs            표를 찍고 data/research/_work/spec/progress.json 에 저장
//
// 세는 기준: notDrink 가 아니고 dupeOf 가 비어 있는 항목 (앱이 실제로 보여 주는 항목).
//   검증      verified.by == "web-research" (등급 A·B 확정 / C 부분)
//   구조화    판매처(데일리샷) 구조화 정보로 채운 와인 — enrichedBy == "dailyshot-structured"
//   이름 색인 둘 다 아닌 항목 (이름·주종·가격대만 있다)
//   사진      image 가 우리 호스팅(Cafe24 /app/img/wine/catalog/) · 외부 주소 · 없음
// 합계는 문서를 다시 읽지 않고 countDocuments 로 한 번 더 세어 맞춰 본다.
import { MongoClient } from "mongodb";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT_DIR = "data/research/_work/spec";
const HOSTED = /yogibo\.openhost\.cafe24\.com\/app\/img\/wine\/catalog\//;
const APP_OF = { wine: "wine", sake: "sake", beer: "beer", whisky: "whisky", traditional: "tradition", makgeolli: "tradition", soju: "tradition", brandy: "spirits", gin: "spirits", rum: "spirits", tequila: "spirits", baijiu: "spirits", liqueur: "spirits", vodka: "spirits", highball: "spirits", spirits: "spirits" };
const NAME = { wine: "와인", sake: "사케", beer: "맥주", whisky: "위스키", traditional: "전통주", makgeolli: "막걸리", soju: "소주", brandy: "브랜디", gin: "진", rum: "럼", tequila: "데킬라", baijiu: "백주", liqueur: "리큐르", vodka: "보드카", highball: "하이볼", spirits: "기타 증류주" };
const APP_NAME = { wine: "보틀 렌즈(와인)", sake: "사케 렌즈", beer: "비어 렌즈", whisky: "위스키 렌즈", tradition: "전통주 렌즈", spirits: "스피리츠 렌즈" };
const ORDER = ["wine", "whisky", "traditional", "makgeolli", "soju", "sake", "beer", "brandy", "baijiu", "rum", "gin", "tequila", "liqueur", "vodka", "highball", "spirits"];

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const base = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };

const docs = await col.find(base, { projection: { category: 1, tier: 1, image: 1, "result.image": 1, "result.story": 1, "i18n.en.story": 1, "i18n.ja.story": 1, "verified.by": 1, "verified.level": 1, "verified.status": 1, enrichedBy: 1, priceBand: 1, strippedEstimates: 1, imageRejected: 1, i18nStale: 1 } }).toArray();

const blank = () => ({ total: 0, verified: 0, A: 0, B: 0, C: 0, structured: 0, nameOnly: 0, both: 0, full: 0, stub: 0, photoHosted: 0, photoExternal: 0, photoNone: 0, priceBand: 0, storyDocs: 0, enStory: 0, jaStory: 0, stripped: 0, imageRejected: 0, i18nStale: 0 });
const byCat = {};
const has = (v) => v != null && String(v).trim() !== "";
for (const d of docs) {
  const c = (byCat[d.category] ||= blank());
  c.total++;
  const ver = d.verified?.by === "web-research";
  const str = d.enrichedBy === "dailyshot-structured";
  if (ver) { c.verified++; const lv = d.verified?.level; if (lv === "A") c.A++; else if (lv === "B") c.B++; else c.C++; }
  if (str && !ver) c.structured++;
  if (str && ver) c.both++;
  if (!ver && !str) c.nameOnly++;
  if (d.tier === "full") c.full++; else c.stub++;
  const img = has(d.image) ? String(d.image) : has(d.result?.image) ? String(d.result.image) : "";
  if (!img) c.photoNone++; else if (HOSTED.test(img)) c.photoHosted++; else c.photoExternal++;
  if (has(d.priceBand)) c.priceBand++;
  if (has(d.result?.story)) { c.storyDocs++; if (has(d.i18n?.en?.story)) c.enStory++; if (has(d.i18n?.ja?.story)) c.jaStory++; }
  if (d.strippedEstimates) c.stripped++;
  if (d.imageRejected) c.imageRejected++;
  if (Array.isArray(d.i18nStale) && d.i18nStale.length) c.i18nStale++;
}

const sumInto = (a, b) => { for (const k of Object.keys(b)) if (typeof b[k] === "number") a[k] = (a[k] || 0) + b[k]; return a; }; // 숫자 칸만 더한다 (key·name 같은 글자 칸은 건드리지 않는다)
const cats = ORDER.filter((k) => byCat[k]).concat(Object.keys(byCat).filter((k) => !ORDER.includes(k))).map((k) => ({ key: k, name: NAME[k] || k, app: APP_OF[k] || "?", ...byCat[k] }));
const apps = {};
for (const c of cats) { const a = (apps[c.app] ||= { key: c.app, name: APP_NAME[c.app] || c.app, ...blank() }); sumInto(a, c); }
const totals = cats.reduce((t, c) => sumInto(t, c), blank());

// ── 한 번 더 세어 맞춰 본다 (문서를 훑은 위 계산과 독립) ──
const check = {
  total: await col.countDocuments(base),
  verified: await col.countDocuments({ ...base, "verified.by": "web-research" }),
  structured: await col.countDocuments({ ...base, enrichedBy: "dailyshot-structured", "verified.by": { $ne: "web-research" } }),
  hosted: await col.countDocuments({ ...base, image: { $regex: "yogibo\\.openhost\\.cafe24\\.com/app/img/wine/catalog/" } }),
  full: await col.countDocuments({ ...base, tier: "full" }),
  excluded: await col.countDocuments({ $or: [{ notDrink: true }, { dupeOf: { $nin: [null, ""] } }] }),
};
const mismatch = [];
if (check.total !== totals.total) mismatch.push(`전체 ${totals.total} ≠ ${check.total}`);
if (check.verified !== totals.verified) mismatch.push(`검증 ${totals.verified} ≠ ${check.verified}`);
if (check.structured !== totals.structured) mismatch.push(`구조화 ${totals.structured} ≠ ${check.structured}`);
if (check.full !== totals.full) mismatch.push(`full ${totals.full} ≠ ${check.full}`);
// 사진: 위 계산은 image → result.image 순으로 보므로, image 만 보는 센 값과는 result.image 만 있는 문서만큼 다를 수 있다
const hostedViaResult = totals.photoHosted - check.hosted;

const engines = await col.aggregate([{ $match: base }, { $project: { e: { $objectToArray: { $ifNull: ["$i18nMeta", {}] } } } }, { $unwind: { path: "$e", preserveNullAndEmptyArrays: false } }, { $group: { _id: "$e.v.engine", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();

// ── 사진 manifest · 조사 비용 ──
const readJson = (p, d = null) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const lines = (p) => { try { return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const man = Object.values(readJson("data/images/manifest.json", {}));
const manifest = { total: man.length, status: {}, liveBySource: {} };
for (const e of man) { manifest.status[e.status] = (manifest.status[e.status] || 0) + 1; if (e.status === "live") manifest.liveBySource[e.source] = (manifest.liveBySource[e.source] || 0) + 1; }
const W = "data/research/_work", IW = "data/images/_work";
const rr = lines(`${W}/runs.jsonl`).filter((r) => r.file); // 본 가동 + 재조사(rr·rp) + 시험(t1~t3) 전부
const sumCost = (xs) => xs.reduce((a, r) => a + (r.costUsd || 0), 0);
const research = {
  batchesOk: rr.filter((r) => r.ok).length, batchesFailed: rr.filter((r) => !r.ok).length,
  costResearch: Math.round(sumCost(rr.filter((r) => r.ok))),
  costFind: Math.round(sumCost(lines(`${IW}/runs-find.jsonl`))),
  costImageCheck: Math.round(sumCost(lines(`${IW}/runs.jsonl`))),
};
research.costTotal = research.costResearch + research.costFind + research.costImageCheck;
const usage = readJson(`${W}/usage.json`, {});

// ── git ──
const git = (...a) => { try { return execFileSync("git", a, { encoding: "utf8" }).trim(); } catch { return ""; } };
const gitInfo = { lastCommit: git("log", "-1", "--format=%h %cs %s"), uncommitted: git("status", "--porcelain").split("\n").filter(Boolean).length };

const out = { at: new Date().toISOString(), basis: "notDrink 가 아니고 dupeOf 가 비어 있는 항목", excluded: check.excluded, categories: cats, apps: Object.values(apps), totals, check, mismatch, hostedViaResult, engines, manifest, research, usage: { sevenDay: usage.sevenDay ?? null, at: usage.at ?? null }, git: gitInfo };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/progress.json`, JSON.stringify(out, null, 1), "utf8");

// ── 표 ──
const n = (x) => x.toLocaleString("ko-KR");
const p = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-");
console.log("| 주종 | 앱 | 전체 | 웹 조사 검증 (확정 A·B / 부분 C) | 판매처 구조화 | 이름 색인만 | 정보 채움 | 공개 사진 (우리 호스팅) | 사진 없음 |");
console.log("|---|---|--:|--:|--:|--:|--:|--:|--:|");
const row = (c) => `| ${c.name} | ${APP_NAME[c.app] || c.app} | ${n(c.total)} | ${n(c.verified)} (${n(c.A + c.B)} / ${n(c.C)}) · ${p(c.verified, c.total)} | ${n(c.structured)} | ${n(c.nameOnly)} | ${p(c.verified + c.structured, c.total)} | ${n(c.photoHosted)} · ${p(c.photoHosted, c.total)} | ${n(c.photoNone)} |`;
for (const c of cats) console.log(row(c));
console.log(row({ ...totals, name: "**합계**", app: "" }));
console.log("");
console.log(`전체 ${n(totals.total)}종 · 대조: 전체 ${n(check.total)} · 검증 ${n(check.verified)} · 구조화 ${n(check.structured)} · full ${n(check.full)} · 우리 호스팅(image 필드만) ${n(check.hosted)} → ${mismatch.length ? "불일치: " + mismatch.join(", ") : "모두 일치"}`);
console.log(`검증∩구조화 겹침 ${totals.both} · 사진 위 계산(image→result.image)과 image 만 센 값의 차이 ${hostedViaResult}`);
console.log(`번역층 엔진: ${engines.map((e) => `${e._id ?? "표시 없음"} ${e.n}`).join(" · ")} · 서술문 있는 ${n(totals.storyDocs)}종 중 영어 ${n(totals.enStory)} · 일본어 ${n(totals.jaStory)}`);
console.log(`사진 manifest ${manifest.total}건: ${Object.entries(manifest.status).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`조사 $${research.costTotal} (조사 ${research.costResearch} · 사진 찾기 ${research.costFind} · 사진 확인 ${research.costImageCheck}) · 묶음 ${research.batchesOk} 완료/${research.batchesFailed} 실패 · git ${gitInfo.lastCommit} · 미커밋 ${gitInfo.uncommitted}건`);
await client.close();
process.exit(0);
