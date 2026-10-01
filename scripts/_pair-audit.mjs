// 붙은 쌍 중 의심스러운 것을 추린다 — 우리 이름과 붙은 상품 이름의 낱말을 견준다.
//   node scripts/_pair-audit.mjs whisky
// 자동 판정이 아니라 사람 눈에 보일 후보를 줄이는 것이다.
import { readFileSync } from "node:fs";

const cat = process.argv[2] || "whisky";
const pairs = JSON.parse(readFileSync(`scripts/_pairs-${cat}.json`, "utf8"));

const STOP = new Set([
  "위스키", "싱글", "몰트", "싱글몰트", "스카치", "버번", "블렌디드", "라이", "700ml", "750ml", "1l",
  "구형", "신형", "리뉴얼", "와인", "보드카", "럼", "진", "데킬라", "리큐르", "브랜디", "코냑", "꼬냑",
  "스트레이트", "켄터키", "아이리시", "재패니즈", "맥주", "캔", "병", "더", "the",
]);

const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
function toks(s) {
  return String(s)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|l|리터)\b/gi, " ")
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9가-힣*]+/)
    .filter((t) => t && !STOP.has(t));
}

const flagged = [];
for (const p of pairs) {
  const ours = toks(p.q || p.ours), theirs = toks(p.theirs);
  const fo = flat(p.q || p.ours), ft = flat(p.theirs);
  const extra = theirs.filter((t) => !fo.includes(t));   // 그쪽에만 있는 낱말
  const lack = ours.filter((t) => !ft.includes(t));      // 우리에만 있는 낱말
  if (extra.length || lack.length) flagged.push({ ...p, extra, lack });
}

console.log(`${cat} — 붙은 ${pairs.length}쌍 중 낱말이 어긋나는 것 ${flagged.length}쌍\n`);
for (const f of flagged) {
  console.log(`우리  ${f.ours}`);
  console.log(`쪽    ${f.theirs}   ${f.won.toLocaleString()}원${f.vol ? " · " + f.vol : ""}`);
  console.log(`      그쪽에만 [${f.extra.join(" ")}]  우리에만 [${f.lack.join(" ")}]\n`);
}
