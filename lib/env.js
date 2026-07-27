// 환경변수는 편집 과정에서 앞뒤 공백·줄바꿈 찌꺼기가 붙기 쉽다.
// 특히 HTTP 헤더로 들어가는 값(API 키 등)은 공백 하나에도 요청이 거부되므로 항상 정리해서 읽는다.
export function env(name, fallback = "") {
  const value = process.env[name];
  return (value ?? fallback).trim();
}
