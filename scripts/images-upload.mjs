// 이미지 올리기 — 확인된 사진만, 호스팅 전용 폴더에 천천히 올린다.
//
//   호스팅 (Cafe24)
//     /app/img/wine/catalog/_staging/<주종>/<해시>.webp          올리는 중간 자리
//     /app/img/wine/catalog/<주종>/<해시 첫 글자>/<해시>.webp      공개 폴더 (한 폴더에 수백 장 이하)
//
// 순서: 올림(_staging) → 공개 주소로 받아 보고 크기·형식 확인 → 이름 바꿔 이동(rename) →
//       이동한 주소로 다시 확인 → 그제야 DB 의 image 를 새 주소로 바꾼다.
//
// 왜 이렇게 하는가.
//  · 한꺼번에 몰아 올리지 않는다. 분당 장수를 정해 두고 천천히 올린다 (기본 30장/분).
//    연결 하나를 재사용하고, 일정 장수마다 쉬고 다시 연결한다.
//  · 올리는 도중의 파일이 공개 주소에서 보이지 않게 한다. 이름 바꾸기는 데이터 전송이 없고
//    한 번에 끝나서, 공개 폴더에는 다 올라간 파일만 있다.
//  · 확인이 끝난 뒤에만 DB 를 바꾼다. 호스팅에 문제가 있으면 앱의 기존 이미지가 그대로 남는다.
//  · 이전 주소는 imagePrev 에 남겨 둔다 — 되돌릴 수 있다.
//  · 기록(manifest) 은 내가 바꾼 항목만 병합해 저장한다 — 판정 적용 같은 다른 스크립트와 같이 돌아도 안전하다.
//
//   node --env-file=.env.local scripts/images-upload.mjs --limit 20                 시험
//   node --env-file=.env.local scripts/images-upload.mjs --rate 30                  전부 (verified 만) 올리고 끝
//   node --env-file=.env.local scripts/images-upload.mjs --rate 30 --watch --until 2026-10-02T08:45:00+09:00
//        새로 verified 가 되는 사진이 있는지 1분마다 보며 계속 올린다. data/images/_work/STOP 파일이 생기면 멈춘다.
//   node --env-file=.env.local scripts/images-upload.mjs --status staged --names "글렌파클라스 105|글렌드로낙 12년"

import { Client } from "basic-ftp";
import { MongoClient } from "mongodb";
import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const STATUS = arg("--status", "verified");
const RATE = Number(arg("--rate", 30));            // 분당 장수
const LIMIT = Number(arg("--limit", 1e9));
const NAMES = arg("--names") ? new Set(arg("--names").split("|")) : null;
const WATCH = process.argv.includes("--watch");
const UNTIL = arg("--until") ? new Date(arg("--until")).getTime() : Infinity;
const MAX_FAILS = 3;                                // 한 사진이 이만큼 실패하면 더는 되풀이하지 않는다
const PAUSE_EVERY = 50, PAUSE_MS = 20000, RECONNECT_EVERY = 100;

const ROOT = "data/images";
const REMOTE = "/app/img/wine/catalog";
const STOP = `${ROOT}/_work/STOP`;
const LOG = `${ROOT}/_work/upload.log`;
const BASE = process.env.FTP_PUBLIC_BASE.replace(/\/+$/, "");
const urlOf = (remotePath) => `${BASE}${remotePath}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(`${ROOT}/_work`, { recursive: true });
const log = (s) => { const line = `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${s}`; console.log(line); try { appendFileSync(LOG, line + "\n"); } catch {} };

let ftp = null;
async function connect() {
  if (ftp) { try { ftp.close(); } catch {} }
  ftp = new Client(30000);
  await ftp.access({ host: process.env.YOGIBO_FTP, user: process.env.YOGIBO_FTP_ID, password: process.env.YOGIBO_FTP_PW, secure: false });
}

async function check(url, wantBytes) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`공개 주소 ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  if (!/image\/webp/.test(ct)) throw new Error(`형식 ${ct || "없음"}`);
  const n = Buffer.from(await r.arrayBuffer()).length;
  if (n !== wantBytes) throw new Error(`크기 불일치 ${n} ≠ ${wantBytes}`);
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const interval = Math.round(60000 / RATE);
const total = { ok: 0, fail: 0 };

/** 한 번 훑는다 — 기록을 새로 읽어, 올릴 것을 다 올린다. 올린(시도한) 장수를 돌려준다. */
async function pass() {
  const manifest = readManifest();
  const touched = new Set();
  const save = () => mergeSave(manifest, touched);

  let todo = Object.values(manifest).filter((e) => e.status === STATUS && e.file && e.hash && existsSync(`${ROOT}/${e.file}`) && (e.uploadFails || 0) < MAX_FAILS);
  if (NAMES) todo = todo.filter((e) => NAMES.has(e.name));

  // 앞서 올렸는데 기록에 못 적고 끊긴 것 — DB 가 이미 그 공개 주소를 가리키면 올린 것으로 맞춘다 (DB 갱신이 맨 마지막 단계다)
  if (todo.length) {
    const have = new Map((await col.find({ name: { $in: todo.map((e) => e.name) } }, { projection: { name: 1, image: 1 } }).toArray()).map((d) => [d.name, d.image]));
    let fixed = 0;
    todo = todo.filter((e) => {
      const url = urlOf(`${REMOTE}/${e.category}/${e.hash[0]}/${e.hash}.webp`);
      if (have.get(e.name) !== url) return true;
      e.status = "live"; e.liveUrl = url; e.liveAt = new Date().toISOString(); touched.add(e.name); fixed++;
      return false;
    });
    if (fixed) { await save(); log(`기록 보정 — DB 에 이미 반영된 ${fixed}장을 올린 것으로 맞춤`); }
  }
  todo = todo.slice(0, LIMIT);
  if (!todo.length) return 0;
  log(`올릴 것 ${todo.length}장 (상태 ${STATUS}) · 분당 ${RATE}장 · 호스팅 ${REMOTE}`);

  const live = new Set(Object.values(manifest).filter((e) => e.status === "live" && e.liveUrl).map((e) => e.liveUrl));
  let n = 0, ok = 0, fail = 0, consecutive = 0, sinceConnect = 0, outage = false;
  const recent = [];                                           // 연달아 실패한 사진 — 호스팅 장애일 수 있다
  await connect();                                             // 오래 쉬었다면 연결이 끊겼을 수 있다 — 훑을 때마다 새로 잇는다

  for (const e of todo) {
    if (existsSync(STOP)) { log("STOP 파일이 있어 멈춥니다"); break; }
    const t0 = Date.now();
    const local = `${ROOT}/${e.file}`;
    const bytes = statSync(local).size;
    const stagingPath = `${REMOTE}/_staging/${e.category}/${e.hash}.webp`;
    const finalDir = `${REMOTE}/${e.category}/${e.hash[0]}`;
    const finalPath = `${finalDir}/${e.hash}.webp`;
    const finalUrl = urlOf(finalPath);

    try {
      if (sinceConnect >= RECONNECT_EVERY) { await connect(); sinceConnect = 0; }
      if (!live.has(finalUrl)) {
        await ftp.ensureDir(`${REMOTE}/_staging/${e.category}`);
        await ftp.uploadFrom(local, stagingPath);
        await check(urlOf(stagingPath), bytes);                 // 올린 것이 온전한가
        await ftp.ensureDir(finalDir);
        await ftp.rename(stagingPath, finalPath);               // 공개 폴더로 이동 — 전송 없음
        await check(finalUrl, bytes);                           // 이동한 자리에서도 확인
        live.add(finalUrl);
      }
      const prev = (await col.findOne({ name: e.name }, { projection: { image: 1 } }))?.image || null;
      await col.updateOne({ name: e.name }, {
        $set: {
          image: finalUrl, imageSource: e.source, imageOrigin: e.origin, imageHash: e.hash,
          imageW: e.w, imageH: e.h, imageBytes: e.bytes, imageHostedAt: new Date(), imageCheckedAt: new Date(),
          ...(prev && prev !== finalUrl && !/cafe24\.com/.test(prev) ? { imagePrev: prev } : {}),
        },
      });
      e.status = "live"; e.liveUrl = finalUrl; e.liveAt = new Date().toISOString(); delete e.uploadError;
      ok++; consecutive = 0; recent.length = 0;
    } catch (err) {
      fail++; consecutive++; recent.push(e);
      e.uploadError = String(err.message).slice(0, 120); e.uploadFails = (e.uploadFails || 0) + 1;
      log(`  ✗ ${e.name} — ${e.uploadError}`);
      try { await connect(); sinceConnect = 0; } catch {}
    }
    touched.add(e.name);
    if (consecutive >= 10) {
      // 사진 문제가 아니라 호스팅 문제로 본다 — 이 사진들의 실패 횟수는 물리고 쉬었다 다시 한다
      for (const x of recent) { x.uploadFails = Math.max(0, (x.uploadFails || 1) - 1); touched.add(x.name); }
      log("연속 실패 10번 — 호스팅 장애로 보고 이번 훑기를 멈춥니다. 5분 뒤 다시 합니다.");
      outage = true; break;
    }
    n++; sinceConnect++;
    if (n % 20 === 0) { await save(); log(`  … ${n}/${todo.length} — 올림 ${ok} · 실패 ${fail}`); }
    if (n % PAUSE_EVERY === 0) await sleep(PAUSE_MS);           // 일정 장수마다 숨 돌리기
    const spent = Date.now() - t0;
    if (spent < interval) await sleep(interval - spent);         // 분당 장수 맞추기
  }
  await save();
  total.ok += ok; total.fail += fail;
  log(`이번 훑기 끝. 올림 ${ok} · 실패 ${fail} / ${todo.length}장 (누적 올림 ${total.ok} · 실패 ${total.fail})`);
  try { ftp.close(); } catch {}
  return outage ? -1 : n;
}

for (;;) {
  let n = 0;
  try { n = await pass(); } catch (err) { log(`훑기 중 오류: ${String(err.message).slice(0, 160)}`); n = 0; await sleep(120000); }
  if (!WATCH) break;
  if (existsSync(STOP) || Date.now() > UNTIL) { log("감시를 마칩니다"); break; }
  if (n <= 0) await sleep(n < 0 ? 300000 : 60000);               // 새로 확인된 사진이 생기기를 기다린다 (장애면 5분)
}

log(`끝. 누적 올림 ${total.ok} · 실패 ${total.fail}`);
try { ftp?.close(); } catch {}
await client.close();
process.exit(0);
