// 조사 데이터 보고용 수치 — DB 에 무엇이 몇 개 쓰여 있는지 센다 (읽기만 한다).
//   node --env-file=.env.local scripts/_data-report.mjs        요약을 찍고 data/research/_work/spec/data-report.json 에 저장
//
// 세는 단위
//   항목      catalog 문서 하나 = 술 한 병 (앱이 보여 주는 것: notDrink 아님 · dupeOf 없음)
//   데이터    문서 안의 값 하나. 글·숫자 칸은 1개, 목록 칸(연표·페어링·제원·팁 …)은 원소 수만큼 센다.
import { MongoClient } from "mongodb";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";

const OUT_DIR = "data/research/_work/spec";
const HOSTED = /yogibo\.openhost\.cafe24\.com\/app\/img\/wine\/catalog\//;
const has = (v) => v != null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);

// 앱 화면에 나오는 정보 칸 — [키, 이름, 종류(scalar|list)]
const FIELDS = [
  ["story", "이야기", "scalar"], ["winery", "생산자 소개", "scalar"], ["history", "역사 연표", "list"], ["foodPairing", "페어링 음식", "list"],
  ["pairingTip", "페어링 팁", "scalar"], ["avoidPairing", "피할 음식", "scalar"], ["specs", "제원", "list"], ["tasteProfile", "맛 축 수치", "list"],
  ["tastingNotes", "시음 노트", "scalar"], ["trivia", "알고 마시면 더 맛있는 이야기", "scalar"], ["tips", "음용 팁", "list"], ["servingTemp", "음용 온도", "scalar"],
  ["aging", "숙성", "scalar"], ["servingNote", "서빙 메모", "scalar"], ["ratings", "출처별 평점", "list"], ["similar", "비슷한 술", "list"],
  ["producer", "생산자", "scalar"], ["country", "국가", "scalar"], ["region", "지역·산지", "scalar"], ["type", "종류", "scalar"],
  ["alcohol", "도수", "scalar"], ["vintage", "빈티지", "scalar"], ["liquidColor", "술 색", "scalar"],
];

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "winelens");
const col = db.collection("catalog");
const base = { notDrink: { $ne: true }, dupeOf: { $in: [null, ""] } };

// ── DB 전체 ──
const collections = [];
for (const c of await db.listCollections().toArray()) collections.push({ name: c.name, n: await db.collection(c.name).estimatedDocumentCount() });
collections.sort((a, b) => b.n - a.n);

// ── 카탈로그 ──
const totalAll = await col.countDocuments({});
const docs = await col.find(base, { projection: { category: 1, tier: 1, image: 1, priceBand: 1, priceInfo: 1, result: 1, verified: 1, enrichedBy: 1, sourceFacts: 1, i18n: 1, i18nMeta: 1, i18nStale: 1, strippedEstimates: 1, imageRejected: 1 } }).toArray();

const fieldStat = Object.fromEntries(FIELDS.map(([k, label, kind]) => [k, { key: k, label, kind, docs: 0, points: 0, chars: 0 }]));
const byCat = {};
const blankCat = () => ({ items: 0, verified: 0, structured: 0, points: 0, story: 0, history: 0, pairing: 0, specs: 0 });
const ver = { docs: 0, level: { A: 0, B: 0, C: 0 }, status: {}, sources: 0, srcPerDoc: { 0: 0, 1: 0, 2: 0, "3+": 0 }, multiDomainDocs: 0, corrections: 0, removed: 0, notes: 0, usedCites: 0 };
const urlSet = new Set(), domains = {}, corrBy = {}, remBy = {};
const extra = { priceBand: 0, priceInfo: 0, dailyshotFacts: 0, vivino: 0, dsReviews: 0, tasteEstimated: 0, photoHosted: 0, photoExternal: 0, photoNone: 0, stripped: 0, imageRejected: 0, i18nStale: 0, enDocs: 0, jaDocs: 0, enFields: 0, jaFields: 0, enStory: 0, jaStory: 0 };
const i18nField = { en: {}, ja: {} };
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^(www|m)\./, ""); } catch { return null; } };
const family = (f) => String(f || "기타").split(/[.\[]/)[0] || "기타";

for (const d of docs) {
  const r = d.result || {};
  const c = (byCat[d.category] ||= blankCat());
  c.items++;
  let pts = 0;
  for (const [k, , kind] of FIELDS) {
    const v = r[k];
    if (!has(v)) continue;
    const s = fieldStat[k];
    s.docs++;
    const n = kind === "list" ? (Array.isArray(v) ? v.length : 1) : 1;
    s.points += n; pts += n;
    if (typeof v === "string") s.chars += v.length;
  }
  if (has(d.priceBand)) { extra.priceBand++; pts++; }
  if (d.priceInfo && (d.priceInfo.krwLow || d.priceInfo.krwHigh)) { extra.priceInfo++; pts++; }
  c.points += pts;
  if (has(r.story)) c.story++;
  if (has(r.history)) c.history++;
  if (has(r.foodPairing)) c.pairing++;
  if (has(r.specs)) c.specs++;
  if (r.tasteEstimated) extra.tasteEstimated++;

  const isVer = d.verified?.by === "web-research";
  if (isVer) {
    c.verified++; ver.docs++;
    const v = d.verified;
    const lv = v.level === "A" || v.level === "B" ? v.level : "C"; ver.level[lv]++;
    ver.status[v.status || "?"] = (ver.status[v.status || "?"] || 0) + 1;
    const src = Array.isArray(v.sources) ? v.sources : [];
    ver.sources += src.length;
    ver.srcPerDoc[src.length >= 3 ? "3+" : src.length]++;
    const doms = new Set();
    for (const s of src) {
      const u = typeof s === "string" ? s : s?.url;
      if (!u) continue;
      urlSet.add(u);
      const dm = domainOf(u); if (dm) { doms.add(dm); domains[dm] = (domains[dm] || 0) + 1; }
      if (Array.isArray(s?.used)) ver.usedCites += s.used.length;
    }
    if (doms.size >= 2) ver.multiDomainDocs++;
    for (const x of v.corrections || []) { ver.corrections++; const f = family(x.field); corrBy[f] = (corrBy[f] || 0) + 1; }
    for (const x of v.removed || []) { ver.removed++; const f = family(x.field); remBy[f] = (remBy[f] || 0) + 1; }
    if (Array.isArray(v.notes)) ver.notes += v.notes.length; else if (has(v.notes)) ver.notes++;
  } else if (d.enrichedBy === "dailyshot-structured") c.structured++;

  const ds = d.sourceFacts?.dailyshot;
  if (ds) { extra.dailyshotFacts++; if (ds.vivino && (ds.vivino.rating || ds.vivino.score || ds.vivino.averageRating)) extra.vivino++; if ((ds.reviewCount || 0) > 0) extra.dsReviews++; }
  const img = has(d.image) ? String(d.image) : has(r.image) ? String(r.image) : "";
  if (!img) extra.photoNone++; else if (HOSTED.test(img)) extra.photoHosted++; else extra.photoExternal++;
  if (d.strippedEstimates) extra.stripped++;
  if (d.imageRejected) extra.imageRejected++;
  if (Array.isArray(d.i18nStale) && d.i18nStale.length) extra.i18nStale++;
  for (const lang of ["en", "ja"]) {
    const o = d.i18n?.[lang];
    if (!o || !Object.keys(o).length) continue;
    extra[lang + "Docs"]++;
    for (const [k, v] of Object.entries(o)) if (has(v)) { extra[lang + "Fields"]++; i18nField[lang][k] = (i18nField[lang][k] || 0) + 1; }
    if (has(o.story)) extra[lang + "Story"]++;
  }
}

const fields = Object.values(fieldStat).sort((a, b) => b.points - a.points);
const totalPoints = fields.reduce((n, f) => n + f.points, 0) + extra.priceBand + extra.priceInfo;
const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([d, n]) => ({ d, n }));
const sortObj = (o, k = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, n]) => ({ f, n }));

// ── 판매처 가격 색인 ──
const dsIndex = { total: await db.collection("dailyshot").estimatedDocumentCount(), withPrice: await db.collection("dailyshot").countDocuments({ price: { $gt: 0 } }), withVivino: await db.collection("dailyshot").countDocuments({ "vivino.rating": { $gt: 0 } }) };

// ── 앱 사용 기록(사용자 데이터) ──
const userData = {};
for (const name of ["sessions", "cellar", "preferences", "ratings", "wanted", "push_subscriptions", "deal_notices", "drink_notices"]) {
  const c = collections.find((x) => x.name === name);
  if (c) userData[name] = c.n;
}
const cellarByStatus = Object.fromEntries((await db.collection("cellar").aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray()).map((x) => [x._id || "?", x.n]));

// ── 조사 작업 기록 (러너 로그) ──
const lines = (p) => { try { return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const runs = lines("data/research/_work/runs.jsonl").filter((r) => r.file);
const sum = (xs, k) => xs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const by = (xs, k) => { const o = {}; for (const r of xs) o[r[k] || "?"] = (o[r[k] || "?"] || 0) + 1; return o; };
const ats = runs.map((r) => r.at).filter(Boolean).sort();
const findRuns = lines("data/images/_work/runs-find.jsonl"), checkRuns = lines("data/images/_work/runs.jsonl");
const work = {
  batches: runs.length, ok: runs.filter((r) => r.ok).length, failed: runs.filter((r) => !r.ok).length,
  entries: sum(runs, "entries"), searches: sum(runs, "searches"), turns: sum(runs, "turns"),
  tokens: { input: sum(runs, "input"), output: sum(runs, "output"), cacheRead: sum(runs, "cacheR"), cacheWrite: sum(runs, "cacheW") },
  cost: Math.round(sum(runs, "costUsd")), models: by(runs, "model"), effort: by(runs, "effort"), from: ats[0] || null, to: ats[ats.length - 1] || null,
  imageFind: { batches: findRuns.length, cost: Math.round(sum(findRuns, "costUsd")), models: by(findRuns, "model") },
  imageCheck: { batches: checkRuns.length, cost: Math.round(sum(checkRuns, "costUsd")), models: by(checkRuns, "model") },
};

// ── 사진 기록 ──
const man = Object.values((() => { try { return JSON.parse(readFileSync("data/images/manifest.json", "utf8")); } catch { return {}; } })());
const photo = { manifest: man.length, status: by(man, "status"), liveBySource: by(man.filter((e) => e.status === "live"), "source"), liveBytes: man.filter((e) => e.status === "live").reduce((a, e) => a + (e.bytes || 0), 0) };

// ── 되돌릴 수 있게 남긴 백업 ──
const backups = existsSync("data/backup") ? readdirSync("data/backup").map((f) => ({ f, kb: Math.round(statSync(`data/backup/${f}`).size / 1024) })) : [];

const out = {
  at: new Date().toISOString(), totalAll, shown: docs.length, excluded: totalAll - docs.length, collections,
  totalPoints, fields, extra, byCat, ver: { ...ver, uniqueUrls: urlSet.size, uniqueDomains: Object.keys(domains).length }, topDomains,
  corrBy: sortObj(corrBy), remBy: sortObj(remBy), i18nField: { en: sortObj(i18nField.en, 10), ja: sortObj(i18nField.ja, 10) },
  dsIndex, userData, cellarByStatus, work, photo, backups,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/data-report.json`, JSON.stringify(out, null, 1), "utf8");

const n = (x) => Number(x || 0).toLocaleString("ko-KR");
console.log(`항목 ${n(out.shown)} (전체 ${n(totalAll)}, 숨김 ${n(out.excluded)}) · 데이터 값 ${n(totalPoints)}개`);
console.log("칸별:", fields.slice(0, 12).map((f) => `${f.label} ${n(f.docs)}종/${n(f.points)}`).join(" · "));
console.log(`검증 ${n(ver.docs)} (A ${ver.level.A} · B ${ver.level.B} · C ${ver.level.C}) · 출처 ${n(ver.sources)}건(고유 주소 ${n(urlSet.size)}, 도메인 ${n(Object.keys(domains).length)}) · 출처 수 분포 ${JSON.stringify(ver.srcPerDoc)} · 서로 다른 도메인 2곳 이상 ${n(ver.multiDomainDocs)}`);
console.log("출처 도메인 상위:", topDomains.slice(0, 12).map((x) => `${x.d} ${x.n}`).join(" · "));
console.log(`정정 ${n(ver.corrections)} · 뺀 주장 ${n(ver.removed)} · 정정 많은 칸: ${out.corrBy.slice(0, 6).map((x) => `${x.f} ${x.n}`).join(", ")}`);
console.log(`판매처 색인 ${n(dsIndex.total)} (가격 ${n(dsIndex.withPrice)}) · 판매처 사실 붙은 항목 ${n(extra.dailyshotFacts)} · 사용자 데이터 ${JSON.stringify(userData)} · 셀러 ${JSON.stringify(cellarByStatus)}`);
console.log(`러너 ${work.batches}묶음 · 항목 ${n(work.entries)} · 검색 ${n(work.searches)}회 · $${work.cost} · 모델 ${JSON.stringify(work.models)} · ${work.from} → ${work.to}`);
await client.close();
process.exit(0);
