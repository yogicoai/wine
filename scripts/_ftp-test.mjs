// Cafe24 FTP 가 실제로 되는지 한 바퀴 — 접속 → 목록 → 시험 파일 올림 → 공개 주소로 받음 → 지움.
// 기존 파일은 건드리지 않는다. 비밀번호는 출력하지 않는다.
import { Client } from "basic-ftp";
import { Readable } from "node:stream";

const host = process.env.YOGIBO_FTP, user = process.env.YOGIBO_FTP_ID, password = process.env.YOGIBO_FTP_PW;
const dir = "/app/img/wine/";
const base = process.env.FTP_PUBLIC_BASE.replace(/\/+$/, "");
const name = `_probe_${Date.now()}.txt`;

const c = new Client(15000);
try {
  await c.access({ host, user, password, secure: false });
  console.log("접속 OK");
  await c.ensureDir(dir);
  const list = await c.list();
  const files = list.filter((x) => x.isFile);
  const bytes = files.reduce((a, x) => a + x.size, 0);
  console.log(`${dir}  파일 ${files.length}개 · ${(bytes / 1048576).toFixed(1)}MB · 하위 폴더 ${list.filter((x) => x.isDirectory).length}개`);
  files.slice(0, 3).forEach((x) => console.log("   예:", x.name, x.size + "B"));

  await c.uploadFrom(Readable.from(Buffer.from("probe")), name);
  console.log("시험 파일 업로드 OK");
  const url = `${base}${dir}${name}`;
  const r = await fetch(url);
  console.log(`공개 주소 ${r.status} ${r.ok ? "OK" : "실패"} → ${url.replace(base, "…")}`);
  await c.remove(name);
  console.log("시험 파일 삭제 OK");
} catch (e) {
  console.log("실패:", e.message);
} finally {
  c.close();
}
process.exit(0);
