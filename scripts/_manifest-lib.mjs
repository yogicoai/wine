// 사진 기록(manifest.json) 을 여러 스크립트가 동시에 건드려도 서로의 변경을 지우지 않게 하는 도우미.
//
// 문제: 업로더·판정 적용·자동 통과·모으기가 각자 기록 전체를 메모리에 들고 있다가 통째로 덮어쓰면,
//       나중에 쓴 쪽이 먼저 쓴 쪽의 변경을 지운다 (판정 결과가 사라지거나, 올린 사진이 도로 "확인됨"으로 돌아간다).
// 해결: 저장할 때마다 (1) 잠금을 잡고 (2) 디스크의 최신 기록을 다시 읽어 (3) 내가 바꾼 항목만 덮어 쓰고 (4) 쓴다.
//       그러니 각 스크립트는 자기가 바꾼 이름(touched)만 기억하면 된다.
import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, statSync, writeFileSync } from "node:fs";

// 잠금은 빈 폴더 하나라 rmdirSync 로 지운다. rmSync(recursive) 는 Node 24 에서 C++ 로 바뀌었는데, 한글이 든 경로
// (10-27 에 저장소를 Dropbox 의 한글 폴더로 옮김)에서 프로세스를 통째로 죽인다 — 0xC0000409, 오류 문구도 없이 (2026-10-29).
// 그 바람에 잠금 폴더가 남아 사진 받기 · 올리기가 저장할 때마다 말없이 꺼졌다.
const unlock = () => { try { rmdirSync(LOCK); } catch {} };

export const MANIFEST = "data/images/manifest.json";
const LOCK = "data/images/.manifest.lock";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readManifest() {
  for (let i = 0; i < 8; i++) {
    try { return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {}; }
    catch (e) { if (i === 7) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80 + i * 40); }   // 다른 프로세스가 바꾸는 순간이면 잠깐 뒤 다시
  }
}

async function withLock(fn) {
  mkdirSync("data/images", { recursive: true });
  const t0 = Date.now();
  for (;;) {
    try { mkdirSync(LOCK); break; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(LOCK).mtimeMs > 30000) unlock(); } catch {}   // 죽은 프로세스의 잠금
      if (Date.now() - t0 > 60000) throw new Error("manifest 잠금을 얻지 못했습니다");
      await sleep(80 + Math.random() * 160);
    }
  }
  try { return await fn(); } finally { unlock(); }
}

/** local 의 touched(이름 집합) 항목만 디스크 최신 기록에 반영해 저장한다. */
export async function mergeSave(local, touched) {
  if (!touched || !touched.size) return;
  let names = [];
  await withLock(async () => {
    names = [...touched];                                       // 잠금을 잡은 시점의 목록 — 저장하는 동안 새로 더해진 이름은 다음 저장 몫이다
    const disk = readManifest();
    for (const name of names) { if (local[name]) disk[name] = local[name]; }
    writeFileSync(`${MANIFEST}.tmp`, JSON.stringify(disk));
    for (let i = 0; ; i++) {
      try { renameSync(`${MANIFEST}.tmp`, MANIFEST); break; }
      catch (e) { if (i >= 8) throw e; await sleep(60 + i * 40); }   // 읽는 중이면 윈도우가 잠깐 막는다
    }
  });
  for (const n of names) touched.delete(n);
}
