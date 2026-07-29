// 이름 정리(nameClean) 도입 뒤 저장·조회가 제대로 도는지 확인한다.
// 괄호로 원어가 붙어 와도 한 칸에 모이고, 두 형태 모두로 찾아져야 한다.
const fs = require("fs");
const { MongoClient } = require("mongodb");
const uri = fs.readFileSync(".env.local", "utf8").match(/MONGODB_URI=(.*)/)[1].trim();

const displayName = (raw) => {
  const s = String(raw || "").trim();
  const m = s.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (!m) return s;
  const name = m[1].trim();
  if (name.length < 2) return s;
  if (/^\d+(\.\d+)?\s*(ml|mL|L|도|%|년)$/i.test(m[2].trim())) return s;
  return name;
};
const catalogKey = (name, vintage) =>
  displayName(name).toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]/gu, "").normalize("NFKC") +
  "|" + (vintage || "");

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const col = c.db("winelens").collection("catalog");

  // 실제로 저장된 정식 항목 중 표본을 골라, 두 형태의 이름으로 모두 찾아지는지 본다
  const samples = await col
    .find({ tier: { $ne: "stub" }, category: "wine" }, { projection: { name: 1, key: 1, vintage: 1 } })
    .limit(400)
    .toArray();

  let bad = 0;
  for (const d of samples) {
    const plain = catalogKey(d.name, d.vintage);
    const withParen = catalogKey(`${d.name} (Original Name)`, d.vintage);
    if (d.key !== plain) { console.log("키 불일치:", d.name, d.key, "!=", plain); bad++; }
    if (plain !== withParen) { console.log("괄호 형태가 다른 키:", d.name); bad++; }
  }
  console.log(`표본 ${samples.length}건 검사 —`, bad ? `문제 ${bad}건` : "모두 정상");

  // 이름에 괄호가 남아 있는 항목이 있는지
  const paren = await col
    .find({ name: /\([^)]+\)\s*$/ }, { projection: { name: 1, tier: 1 } })
    .limit(20)
    .toArray();
  console.log("\n이름 끝에 괄호가 남은 항목:", paren.length);
  paren.forEach((d) => console.log("  ", d.tier || "full", d.name));

  await c.close();
})();
