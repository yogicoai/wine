// 번역 파이프라인 공용 — 어떤 필드를 어떻게 문장 단위로 쪼개고 다시 조립하는가, 번역 검증.
import { createHash } from "node:crypto";

// 번역 작업 폴더 — 프로젝트 밖에 둔다 (가상환경·모델이 프로젝트 안에 있으면 개발 서버와 Defender 가 훑느라 PC 가 느려진다)
export const MT_DIR = process.env.MT_DIR || "C:/Users/Yogibo Design/mt-work";

// 번역층(i18n.{en,ja})에 겹칠 수 있는 필드 (lib/catalog.js 의 TEXT_FIELDS·TEXT_ARRAYS 와 같다 — name 은 제외: 이름은 기계번역하지 않는다)
export const STR_FIELDS = ["type", "region", "country", "basis", "tastingNotes", "story", "winery", "pairingTip", "avoidPairing", "trivia", "servingTemp", "servingNote", "aging"];
export const ARR_STR = ["tips"];
// 구조를 유지하며 번역할 키 (emoji·year·shopKeyword 는 그대로 둔다 — shopKeyword 는 한국어 쇼핑 검색어다)
export const OBJ_FIELDS = { specs: ["label", "value"], history: ["event"], foodPairing: ["food", "why"] };
export const ALL_FIELDS = [...STR_FIELDS, ...ARR_STR, ...Object.keys(OBJ_FIELDS)];

export const HANGUL = /[가-힣]/;
export const uid = (text) => createHash("sha1").update(text).digest("hex").slice(0, 12);

// 한국어 문장 나누기 — 한글·괄호·% 뒤의 마침표 다음 공백에서만 자른다 ("Old No. 7", "44.6%" 은 자르지 않는다)
export function splitSentences(text) {
  const parts = String(text).split(/(?<=[가-힣)\]"'%\d][.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length <= 260) { out.push(p); continue; }
    // 너무 긴 문장은 쉼표 뒤에서 나눈다
    let cur = "";
    for (const seg of p.split(/(?<=,)\s+/)) { if ((cur + " " + seg).length > 200 && cur) { out.push(cur.trim()); cur = seg; } else cur = cur ? `${cur} ${seg}` : seg; }
    if (cur) out.push(cur.trim());
  }
  return out;
}
export const joinSentences = (arr, lang) => arr.join(lang === "ja" ? "" : " ");

/**
 * 필드 값을 훑으며 문자열 조각마다 fn(조각) 을 부른다. fn 이 null 을 돌려주면 그 필드는 통째로 null (번역 안 함).
 * 한글이 없는 조각(숫자·영문)은 그대로 둔다.
 */
export function mapField(field, value, fn, lang) {
  const tr = (s) => {
    if (typeof s !== "string" || !s.trim()) return s;
    if (!HANGUL.test(s)) return s;
    const sents = splitSentences(s);
    const outs = [];
    for (const x of sents) { const o = HANGUL.test(x) ? fn(x) : x; if (o == null) return null; outs.push(o); }
    return joinSentences(outs, lang);
  };
  if (STR_FIELDS.includes(field)) return typeof value === "string" ? tr(value) : null;
  if (ARR_STR.includes(field)) {
    if (!Array.isArray(value)) return null;
    const r = value.map(tr); return r.some((x) => x == null) ? null : r;
  }
  const keys = OBJ_FIELDS[field];
  if (keys && Array.isArray(value)) {
    const r = [];
    for (const it of value) {
      if (!it || typeof it !== "object") return null;
      const o = { ...it };
      for (const k of keys) if (typeof it[k] === "string") { const t = tr(it[k]); if (t == null) return null; o[k] = t; }
      r.push(o);
    }
    return r;
  }
  return null;
}

// ── 후처리·검증 ──
const NUM = /\d+(?:[.,]\d+)*/g;
const norm = (s) => String(s).normalize("NFKC");
const nums = (s) => (norm(s).match(NUM) || []).map((x) => x.replace(/,/g, ""));

/** 번역 결과를 다듬는다: 같은 이름이 괄호로 두 번 나오는 것, 구두점 앞 공백 */
export function tidy(out, lang) {
  let s = norm(out).replace(/\s+/g, " ").trim();
  // "Foley Wines (Foley Wines)" → "Foley Wines"
  s = s.replace(/([^()]{2,60}?)\s*[(（]\s*\1\s*[)）]/g, "$1");
  s = s.replace(/\s+([,.;:!?%])/g, "$1");
  if (lang === "ja") s = s.replace(/\s*([、。！？])\s*/g, "$1").replace(/\.\s*$/, "。");
  return s;
}

/** 번역이 믿을 만한가 — 아니면 이유를 돌려준다. 믿을 수 없으면 쓰지 않고 한국어 원문으로 둔다. */
export function check(src, out, lang) {
  if (!out || !out.trim()) return "빈 결과";
  if (HANGUL.test(out)) return "한글이 남음";
  if (lang === "ja" && !/[぀-ヿ一-鿿]/.test(out) && HANGUL.test(src) && !/^[A-Za-z0-9\s.,'’&()\-%/:+]+$/.test(out)) return "일본어가 아님";
  const sl = src.length, ol = out.length;
  if (sl >= 14 && (ol < sl * (lang === "ja" ? 0.35 : 0.8) || ol > sl * 5)) return `길이 비율 ${ol}/${sl}`;
  // 숫자는 하나도 빠지거나 바뀌면 안 된다 (연도·도수·비율)
  const so = nums(out); const sn = nums(src);
  for (const n of sn) if (n.length >= 2 && !so.includes(n)) return `숫자 ${n} 가 빠짐`;
  for (const n of so) if (n.length >= 3 && !sn.includes(n) && !/^(19|20)\d\d$/.test(n)) return `없던 숫자 ${n}`;
  // 같은 낱말 세 개가 세 번 이상 되풀이되면 반복 오류
  const w = out.toLowerCase().split(/\s+/); const seen = {};
  for (let i = 0; i + 2 < w.length; i++) { const k = w.slice(i, i + 3).join(" "); seen[k] = (seen[k] || 0) + 1; if (seen[k] >= 3 && w.length > 8) return "반복"; }
  // 원문의 영문 고유명사(대문자로 시작하는 낱말)는 그대로 남아야 한다
  for (const m of src.match(/[A-Z][A-Za-z'’\-]{3,}/g) || []) if (!norm(out).toLowerCase().includes(m.toLowerCase()) && lang === "en") return `고유명사 ${m} 가 바뀜`;
  return null;
}

/**
 * 문자 n-gram 일치도 — 원문과 "번역을 다시 한국어로 옮긴 것"이 얼마나 닮았나 (0~1).
 * 공백·구두점을 걷고 1~4-gram 의 F1 을 평균한다. 번역이 의미를 바꿨다면 되돌린 글이 원문과 달라진다.
 */
export function chrf(a, b) {
  const norm = (t) => String(t).normalize("NFKC").toLowerCase().replace(/[sp{P}p{S}]/gu, "");
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  let tot = 0, cnt = 0;
  for (let n = 1; n <= 4; n++) {
    if (x.length < n || y.length < n) continue;
    const gx = new Map(), gy = new Map();
    for (let i = 0; i + n <= x.length; i++) { const g = x.slice(i, i + n); gx.set(g, (gx.get(g) || 0) + 1); }
    for (let i = 0; i + n <= y.length; i++) { const g = y.slice(i, i + n); gy.set(g, (gy.get(g) || 0) + 1); }
    let ov = 0; for (const [g, c] of gx) ov += Math.min(c, gy.get(g) || 0);
    const p = ov / Math.max(1, y.length - n + 1), r = ov / Math.max(1, x.length - n + 1);
    tot += p + r ? (2 * p * r) / (p + r) : 0; cnt++;
  }
  return cnt ? tot / cnt : 0;
}
