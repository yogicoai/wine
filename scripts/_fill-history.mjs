// 역사(history)가 비어 있던 항목 채우기 — 확인된 것만 적는다.
//
// 감사에서 3건이 걸렸다. 셋 다 브랜드 연혁이 널리 기록돼 있지 않은 제품이라
// 예전 작성 때 비워 둔 것이다. 웹으로 확인되는 만큼만 적고, 모르는 연도는 쓰지 않는다.
// 지어낸 연혁은 없느니만 못하다.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync("c:/Users/WeMA1/Desktop/wine-main/.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const FILL = [
  {
    name: "페페 로페즈 골드",
    // 확인: 벨루가 주류 DB·국내 수입사 소개. 1966년 캘리포니아 주류상 제이콥스가 만든 브랜드.
    history: [
      { year: "1966", event: "캘리포니아의 주류 유통업자 제이콥스가 미국 시장을 겨냥해 브랜드를 만들었습니다." },
      { year: "현재", event: "멕시코 할리스코주에서 생산되며 멕시코 정부의 NOM 인증을 받고 있습니다." },
    ],
  },
  {
    name: "Toktok Bokbunjaju",
    // 확인: 전통주애·다나와 상품 정보. 전북 순창 참주가, 750ml 7도, 탄산 들어간 복분자주.
    history: [
      { year: "Present", event: "Made by Chamjuga in Sunchang, Jeollabuk-do — a county long known for fermentation — and sold nationwide in 750ml bottles." },
    ],
  },
];

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const col = client.db(env.MONGODB_DB || "winelens").collection("catalog");

for (const f of FILL) {
  const doc = await col.findOne({ name: f.name }, { projection: { _id: 1, name: 1 } });
  if (!doc) { console.log(`⚠ 없음: ${f.name}`); continue; }
  await col.updateOne({ _id: doc._id }, { $set: { "result.history": f.history } });
  console.log(`✓ ${f.name} — 연혁 ${f.history.length}줄`);
}

// 남는 것은 목록만 보여 준다. 근거를 못 찾은 것에 연혁을 지어 넣지 않는다.
const rest = await col.find(
  { tier: "full", $or: [{ "result.history": { $size: 0 } }, { "result.history": { $exists: false } }] },
  { projection: { name: 1, category: 1 } }
).toArray();
console.log(`\n아직 연혁이 없는 항목 ${rest.length}건: ${rest.map((d) => d.name).join(" · ") || "없음"}`);
console.log("(근거를 찾지 못한 것은 비워 둔다 — 지어낸 연혁은 없느니만 못하다)");
await client.close();
