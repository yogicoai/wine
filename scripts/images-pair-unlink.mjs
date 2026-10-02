// 사진 눈 확인이 "다른 제품"이라고 판정한 데일리샷 짝의 연결을 끊는다.
//
// 데일리샷 사진이 이름과 다른 제품(같은 브랜드의 다른 변종·라인·한정판)으로 판정됐다면, 그 짝에서 가져온
// 도수·국가·용량·종류도 다른 제품의 값일 수 있다. 사진만 거르고 짝을 두면 조사 에이전트가 그 값을 "신뢰할 만한
// 판매처 정보"로 읽고, 빈칸 채우기도 그 값을 쓴다. 그래서 연결을 끊고 근거를 남긴다.
//
//   node --env-file=.env.local scripts/images-pair-unlink.mjs           보기만
//   node --env-file=.env.local scripts/images-pair-unlink.mjs --apply   DB 와 아직 읽지 않은 입력 묶음에 반영
//
// · 대상: manifest 에서 status rejected · 출처 dailyshot · 사유가 mismatch 로 시작하는 것 (불명·상품 아님은 건드리지 않는다)
// · DB: sourceFacts.dailyshot 을 지우고 sourceFacts.dailyshotUnlinked 에 옛 짝(이름·주소)과 사유를 남긴다
// · 입력 묶음(data/research/_work/in/*.json): 해당 항목의 dailyshot 을 null 로 — 이미 읽은 묶음은 영향 없다
import { MongoClient } from "mongodb";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { readManifest } from "./_manifest-lib.mjs";

const APPLY = process.argv.includes("--apply");
const m = readManifest();
const rows = Object.values(m).filter((e) => e.status === "rejected" && e.rejectedSource === "dailyshot" && String(e.rejectReason || "").startsWith("mismatch"));
console.log(`짝이 다른 제품으로 판정된 데일리샷 연결 ${rows.length}건`);

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");

const names = new Set();
let linked = 0;
for (const e of rows) {
  const d = await col.findOne({ name: e.name }, { projection: { "sourceFacts.dailyshot.name": 1, "sourceFacts.dailyshot.url": 1, "verified.at": 1 } });
  const ds = d?.sourceFacts?.dailyshot;
  if (!ds) continue;                                   // 이미 끊었거나 짝이 없다
  linked++; names.add(e.name);
  console.log(`  ${e.name}  ⇢  ${String(ds.name).slice(0, 40)}${d.verified?.at ? "  (이미 조사됨)" : ""}\n      ${String(e.rejectNote || "").slice(0, 100)}`);
  if (APPLY) {
    await col.updateOne({ name: e.name }, {
      $unset: { "sourceFacts.dailyshot": "" },
      $set: { "sourceFacts.dailyshotUnlinked": { name: ds.name, url: ds.url, reason: String(e.rejectNote || "").slice(0, 160), at: new Date() } },
    });
  }
}
console.log(`끊을 연결 ${linked}건`);

if (APPLY && names.size) {
  const dir = "data/research/_work/in";
  let patched = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    let arr; try { arr = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")); } catch { continue; }
    let touched = false;
    for (const it of arr) if (names.has(it.name) && it.dailyshot) { it.dailyshot = null; touched = true; }
    if (touched) { writeFileSync(`${dir}/${f}`, JSON.stringify(arr, null, 1), "utf8"); patched++; }
  }
  console.log(`입력 묶음 ${patched}개에서 해당 항목의 판매처 정보를 뺐습니다`);
}
if (!APPLY) console.log("보기만 했습니다. 반영하려면 --apply");
await client.close();
process.exit(0);
