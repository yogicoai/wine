// 채택된 이름 짝을 표에 얹는다. 검산은 다음 단계(_alias-verify.mjs)가 새 프로세스에서 한다.
//   node scripts/_alias-add.mjs <채택.json>
// JSON 모듈은 한 프로세스 안에서 다시 읽히지 않으므로 얹기와 검산을 나눠야 한다.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("채택 파일을 적어 주세요");
const TABLE = "data/dailyshot-alias.json";

const picks = JSON.parse(readFileSync(file, "utf8"));
const table = JSON.parse(readFileSync(TABLE, "utf8"));
let added = 0;
for (const p of picks) {
  if (!p.ours || !p.target) continue;
  if (table[p.ours] === p.target) continue;
  table[p.ours] = p.target;
  added++;
}
writeFileSync(TABLE, JSON.stringify(table, null, 1) + "\n", "utf8");
console.log(`표에 ${added}건 얹음 — 지금 ${Object.keys(table).length}건`);
