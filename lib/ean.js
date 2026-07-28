// 바코드 번호 정규화·검증 — 화면과 서버가 같은 규칙을 써야 하므로 따로 둔다.
// (DB를 건드리지 않는 순수 함수라 브라우저에서도 그대로 쓸 수 있다)

/** EAN-13 / UPC-A 만 받는다. 그 외 형식은 술병에 쓰이지 않는다. */
export function normalizeBarcode(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12) return `0${digits}`; // UPC-A → EAN-13 로 맞춰 한 형태로 보관
  return digits.length === 13 ? digits : null;
}

/** EAN-13 체크digit 검증 — 잘못 읽은 값을 걸러 낸다 */
export function isValidBarcode(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = code
    .slice(0, 12)
    .split("")
    .reduce((acc, ch, i) => acc + Number(ch) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** 읽은 값이 쓸 만한가 — 아니면 계속 스캔한다 */
export function usableBarcode(raw) {
  const code = normalizeBarcode(raw);
  return code && isValidBarcode(code) ? code : null;
}
