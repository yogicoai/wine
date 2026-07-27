# 보틀 렌즈 (Bottle Lens) — Next.js + MongoDB

술 라벨을 촬영/업로드하면 Claude 비전이 주종(12종)·빈티지·가격·테이스팅·페어링을 분석해
세션별 인포그래픽으로 보여주는 웹 앱. (클라이언트 인수인계 문서 `winelens (1).md` 기반 재구축)

## 원본(단일 HTML) 대비 구조 변경

| 항목 | 원본 | 이 프로젝트 |
|---|---|---|
| Claude 호출 | 브라우저 fetch 직접 호출 (키 localStorage) | **서버 API 라우트 + 공식 `@anthropic-ai/sdk`** (키 서버 env) |
| 세션 기록 | localStorage `wl_sessions` (40개) | **MongoDB** `sessions` 컬렉션 (40개 유지) |
| 설정 | 브라우저 설정 드로어 | `.env.local` (모델/웹검색 토글) |

## 실행

```bash
npm install
# .env.local 에 값 입력 (ANTHROPIC_API_KEY, MONGODB_URI)
npm run dev   # http://localhost:5700
```

- `ANTHROPIC_API_KEY` 미설정 → **데모 모드** (샘플 4종 순환, UI 확인용)
- `MONGODB_URI` 미설정 → 분석은 되지만 히스토리 저장 안 됨
- 카메라(getUserMedia)는 localhost 또는 HTTPS에서만 동작

## 분석 파이프라인 (lib/claude.js)

```
POST /api/analyze
  └─ callClaude(base64)
       ├─ (WEB_SEARCH=1 && 미고장) requestClaude(useWeb=true)   ← web_search 서버 도구
       │     └─ WebSearchError(400/빈응답/잘림)이면 ↓ 자동 폴백
       └─ requestClaude(useWeb=false)                            ← 모델 지식만
             └─ parseJson → repairJson(잘린 JSON 복구)
```

- 모델별 web_search 버전: Sonnet 5/Opus 4.8 = `web_search_20260209`, Haiku 4.5 = `web_search_20250305`
- `pause_turn` 은 assistant 응답만 이어붙여 최대 4회 재요청
- web_search 미지원 계정(400)이면 프로세스 생존 동안 검색 비활성화(`webSearchBroken`)
- 401/429/529 등 검색과 무관한 오류는 폴백하지 않고 사용자에게 안내

## 남은 작업

- [ ] 힉스필드(Higgsfield) 디자인 자산 적용 — 주종별 포토리얼 병 이미지를 `public/bottles/<category>.png` 로 넣고 히어로에 매핑
- [ ] 데모 샘플 12종으로 확장 (현재 4종: wine/whisky/sake/soju)
- [ ] 배포 (Vercel 권장 — 환경변수 동일하게 설정)
