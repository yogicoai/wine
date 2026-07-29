// AI가 읽어 온 이름에는 원어가 괄호로 붙어 오는 일이 잦다.
//   "샤또 뒤크뤼 보카이유 (Château Ducru-Beaucaillou)"
// 이걸 그대로 저장하면 손으로 넣은 "샤또 뒤크뤼 보카이유"와 다른 술이 되어
// 카탈로그에 같은 술이 두 번 앉는다. 화면에도 길게 나와 읽기 나쁘다.
//
// 그래서 보여 줄 이름과 찾을 때 쓸 말을 나눈다.

/**
 * "이름 (Original Name)" 을 둘로 가른다.
 * @returns {{name: string, original: string|null}}
 */
export function splitName(raw) {
  const s = String(raw || "").trim();
  if (!s) return { name: "", original: null };

  // 맨 뒤에 붙은 괄호 한 덩어리만 떼어 낸다.
  // "1865 (원 팔육오)" 처럼 이름 가운데 있는 괄호는 건드리지 않는다.
  const m = s.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (!m) return { name: s, original: null };

  const name = m[1].trim();
  const inside = m[2].trim();

  // 괄호를 떼면 이름이 너무 짧아지거나(원어가 본체인 경우) 숫자뿐이면 그대로 둔다
  if (name.length < 2) return { name: s, original: null };
  // 용량·도수 표기는 이름의 일부다 — "무통 카데 (750ml)"
  if (/^\d+(\.\d+)?\s*(ml|mL|L|도|%|년)$/i.test(inside)) return { name: s, original: null };

  return { name, original: inside };
}

/** 보여 줄 이름 */
export function displayName(raw) {
  return splitName(raw).name;
}
