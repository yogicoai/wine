// 자동 확인 — 눈으로 볼 필요가 없는 사진을 걸러 낸다.
//
// 데일리샷 사진은 우리 술과 짝이 이름까지 꽉 맞으면(부피·연도·도수·일반 낱말을 걷은 이름이 같으면)
// 그 상품 페이지의 사진이라 같은 병이다. 사람이 아닌 에이전트가 열어 보는 일이 사실상 확인할 게 없다.
// 반대로 출처가 불확실한 것은 눈으로 본다 — 네이버쇼핑 사진(검색으로 붙인 것이라 엉뚱한 병일 수 있다),
// 이름이 덜 맞는 짝, 같은 해시를 여러 술이 쓰는 사진(자리표시 이미지의 흔적).
//
//   node --env-file=.env.local scripts/images-autoverify.mjs          보기만
//   node --env-file=.env.local scripts/images-autoverify.mjs --apply  verified 로 올림
import { MongoClient } from "mongodb";
import { mergeSave, readManifest } from "./_manifest-lib.mjs";

const APPLY = process.argv.includes("--apply");
const GENERIC = /(위스키|와인|사케|맥주|보드카|데킬라|리큐르|브랜디|꼬냑|코냑|막걸리)/g;
const core = (s) =>
  String(s || "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|리터|%|도)/gi, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(GENERIC, " ")
    // 사케는 우리 표기(긴조 · 센주)로 바꿔 넣는다 — 데일리샷 표기(긴죠 · 센쥬)와 같은 이름으로 본다(2026-10-29, 195장이 이것뿐인 차이로 걸렸다)
    .replace(/죠/g, "조").replace(/쥬/g, "주")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");

const m = readManifest();
const touched = new Set();
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ "sourceFacts.dailyshot.name": { $exists: true } }, { projection: { name: 1, "sourceFacts.dailyshot.name": 1 } }).toArray();
const dsName = new Map(docs.map((d) => [d.name, d.sourceFacts.dailyshot.name]));

// 같은 해시를 서로 다른 이름의 술이 쓰는지
const byHash = {};
for (const e of Object.values(m)) if (e.hash) (byHash[e.hash] ||= new Set()).add(core(e.name));

let auto = 0, toLook = 0, shared = 0, notTight = 0, naver = 0;
for (const e of Object.values(m)) {
  if (e.status !== "staged") continue;
  if (e.source !== "dailyshot") { toLook++; naver++; continue; }
  const ds = dsName.get(e.name);
  const tight = ds && core(e.name) && core(e.name) === core(ds);
  const sharedHash = byHash[e.hash] && byHash[e.hash].size > 1;   // 서로 다른 이름이 같은 사진을 쓴다
  if (tight && !sharedHash) {
    auto++;
    if (APPLY) { touched.add(e.name); e.status = "verified"; e.seen = "자동: 데일리샷 상품과 이름이 꽉 맞음"; e.verifiedAt = new Date().toISOString(); e.verifiedBy = "auto"; }
  } else {
    toLook++; if (sharedHash) shared++; else notTight++;
  }
}
console.log(`자동 통과 ${auto}장 · 눈으로 볼 것 ${toLook}장 (네이버 사진 ${naver} · 이름이 덜 맞는 짝 ${notTight} · 같은 해시를 여러 술이 씀 ${shared})`);
if (APPLY) { await mergeSave(m, touched); console.log("기록을 갱신했습니다"); }
else console.log("눈으로만 봤습니다. 반영하려면 --apply");
await client.close();
process.exit(0);
