export const meta = {
  name: 'liquor-research',
  description: '술 정보를 웹 자료로 대조·보강해 확인된 정보만 결과 파일로 남긴다',
  phases: [{ title: '조사', detail: '입력 파일마다 웹 검색·열람으로 대조하고 결과 JSON 을 쓴다' }],
}

const SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    entries: { type: 'number' },
    verified: { type: 'number' },
    partial: { type: 'number' },
    unidentified: { type: 'number' },
    notDrink: { type: 'number' },
    corrections: { type: 'number' },
    removed: { type: 'number' },
    searches: { type: 'number' },
    note: { type: 'string' },
  },
  required: ['file', 'entries'],
}

const RULES = `당신은 주류 정보 사실 검증자입니다. 우리 앱(보틀 렌즈)의 술 정보를 웹 자료로 대조하고 보강해, 정확한 것만 남깁니다.

■ 가장 중요한 원칙 — 틀린 정보 하나가 빈칸보다 훨씬 나쁩니다
- 출처에서 직접 읽어 확인한 사실만 씁니다. 연도·장소·인물·소유 관계·공정·숫자는 특히 그렇습니다. 기억이나 추측으로 채우지 마세요.
- 확인하지 못했으면 빼거나 표현을 약하게 합니다. 지어내지 마세요.
- 출처의 문장을 그대로 옮기지 마세요. 사실만 가져와 우리 말로 새로 씁니다. 판매처·블로그 글을 베끼지 않습니다.
- 근거로 쓴 출처 URL은 실제로 열어 본 것만 기록합니다.

■ 준비
0) 결과 파일이 이미 있고 유효한 JSON 이면 다시 조사하지 마세요. Read 로 열어 보고, 있으면 그 파일의 요약(항목 수, 상태별 개수, 고친 수, 뺀 수)만 돌려주고 끝냅니다.
1) ToolSearch 로 "select:WebSearch,WebFetch" 를 불러와 웹 도구를 씁니다. 한국어·영어·일본어 검색이 모두 됩니다.
2) 입력 파일을 Read 로 읽습니다. 항목마다 이런 것이 있습니다.
   name       카탈로그 이름 — 결과에 글자 그대로 되돌려 적어야 합니다 (고치지 마세요)
   category   주종 (whisky·wine·sake·beer·traditional·soju·makgeolli·brandy·baijiu·rum·gin·tequila·liqueur·vodka·highball)
   current    우리가 지금 갖고 있는 정보 — 틀렸을 수 있습니다. 비어 있으면 처음부터 조사합니다.
   dailyshot  판매처(데일리샷)의 구조화 정보 — 종류·용량·도수·국가는 신뢰할 만합니다. 없을 수도 있습니다.
   priceBand  가격대 1~5 (참고용)

■ 항목마다 할 일
A. 어떤 술인지 특정합니다 — 생산자/브랜드, 정확한 제품명(한글·원어), 종류, 도수, 용량, 원산지(국가·지역), 빈티지·숙성연수, 원료(품종·쌀·몰트 등).
   · 두 곳 이상에서 일치하면 확정, 한 곳뿐이면 단일 출처, 어긋나면 더 권위 있는 쪽을 따릅니다.
     권위 순서: 생산자 공식 사이트 > 전문 데이터베이스 > 판매처 상품 정보 > 백과사전 > 블로그·커뮤니티.
   · 같은 이름의 다른 제품(빈티지·캐스크·라인·세컨드 라벨·등급)과 혼동하지 마세요.
   · 좋은 출처 예시 — 위스키: 증류소 공식, whiskybase.com, thewhiskyexchange.com, masterofmalt.com, scotchwhisky.com
     와인: 생산자 공식, vivino.com, wine-searcher.com, 위키백과(산지)
     사케: 양조장 공식(일본어), sakenowa.com, 일본주 전문 DB
     맥주: 양조장 공식, untappd.com, ratebeer.com, 위키백과
     전통주·소주·막걸리: 전통주갤러리 thesool.com, 양조장 공식, 농림축산식품부 자료, 나무위키
     스피리츠(브랜디·럼·진·보드카·데킬라·리큐르·백주): 브랜드 공식, 위키백과, distiller.com
B. current 의 사실 주장을 하나씩 대조합니다 — 맞으면 두고, 틀리면 고치고(corrections), 확인하지 못했으면 빼거나 약하게 씁니다(removed).
C. 내용을 우리 형식(아래 result)으로 씁니다. 확인된 사실만. 맛·향은 공식 설명이나 널리 알려진 평을 우리 말로 요약하고, 근거가 약하면 일반적인 스타일 서술로 낮춥니다.
D. 가능한 한 자세히 — 확인된 범위에서 specs 를 풍부하게 (품종 배합, 숙성 통, 정미율, 원료, 증류소·양조장 위치, 수상, 생산 방식 등).
E. 비용을 지킵니다. 항목당 검색(WebSearch)은 6회, 열람(WebFetch)은 10회를 넘기지 마세요 (앞선 가동에서 한 묶음이 열람을 120번 넘게 부른 일이 있습니다 — 같은 사이트의 페이지를 하나씩 계속 넘기며 훑은 것입니다).
   · 알고 싶은 사실(도수·원료·정미율·창업 연도·소유 관계 등)을 WebFetch 의 prompt 에 이름 지어 한 번에 물어 짧게 받으세요. "이 페이지의 정보를 알려 줘" 식으로 묻지 않습니다.
   · 서로 독립적인 검색·열람(예: 서로 다른 사이트 세 곳)은 한 응답에서 도구 호출을 여러 개 동시에 하세요. 하나씩 차례로 부르면 같은 일이 몇 배 느리고 비쌉니다.
   · 확인이 안 되면 약하게 쓰거나 빼고 넘어갑니다. 한 항목에 오래 매달리지 마세요.

■ 이름이 모호하거나 술이 아니면
- 정체를 못 밝히면 status "unidentified", 술이 아니면 "not_a_drink". result 는 {} 로 두고 notes 에 이유를 적습니다. 지어내지 마세요.

■ 결과 형식 — 입력 파일 경로의 "/in/" 을 "/out/" 으로 바꾼 경로에 Write 도구로 JSON 을 씁니다 (유효한 JSON 이어야 합니다)
{
  "entries": [
    {
      "name": "<입력의 name 그대로>",
      "status": "verified" | "partial" | "unidentified" | "not_a_drink",
      "identity": { "officialName": "...", "producer": "...", "country": "...", "region": "...", "type": "...", "alcohol": "40%", "volumeMl": [700], "vintageOrAge": "..." },
      "result": {
        // 확인했거나 새로 쓴 필드만. 안 바꾼 필드는 넣지 마세요. 처음부터 쓰는 항목은 아래를 가능한 한 채웁니다.
        "producer": "문자열", "type": "문자열", "region": "문자열", "country": "문자열", "alcohol": "문자열",
        "vintage": "문자열 또는 null",
        "tastingNotes": "문자열 (160자 안팎)",
        "specs": [{"label": "...", "value": "..."}],          // 최대 10개, 확인된 것만
        "history": [{"year": "...", "event": "..."}],         // 확인된 것만
        "story": "문자열 (1~3문장, 220자 안팎)",
        "winery": "문자열 — 만든 곳 소개",
        "trivia": "문자열 — 확인된 이야기만",
        "foodPairing": [{"emoji": "🧀", "food": "...", "why": "...", "shopKeyword": "..."}],   // 3개
        "pairingTip": "...", "avoidPairing": "...", "servingTemp": "...", "servingNote": "...", "aging": "...",
        "tips": ["...", "..."], "similar": ["다른 술 이름", "..."],
        "drinkFrom": "연도", "drinkPeak": "연도", "drinkUntil": "연도",            // 와인만
        "knowledge": "rich" | "moderate" | "limited",
        "confidence": 0~100, "basis": "한 줄 — 무엇을 근거로 썼는지", "beginner": 0~100, "tags": ["..."]
      },
      "corrections": [{"field": "...", "was": "이전 값", "now": "고친 값", "why": "...", "source": "URL"}],
      "removed": [{"field": "...", "claim": "뺀 주장", "why": "확인 못 함 / 틀림"}],
      "imageCandidates": [{"url": "병 사진의 직접 주소 (.jpg/.png/.webp)", "page": "그 사진이 있던 페이지 주소", "note": "무슨 사진인지 한 줄"}],
      "sources": [{"url": "...", "title": "...", "used": ["alcohol", "region", "story"]}],
      "notes": "어긋남·한계·특이사항"
    }
  ]
}
- imageCandidates: 조사하며 열어 본 페이지(생산자 공식·수입사·판매처·전문 데이터베이스)에서 이 제품의 병 사진을 직접 봤을 때만 적습니다 (최대 2개). 그 페이지에 실제로 있던 주소만 적고, 주소를 짐작하거나 지어내지 마세요. 못 봤으면 빈 배열 [] 입니다. 사진을 찾으려고 따로 검색하지는 않습니다 — 조사 중에 본 것만 적습니다. 배경 사진·여러 병 사진·잔이나 안주 사진은 적지 않습니다.
- knowledge: rich = 권위 있는 출처 둘 이상으로 확인 / moderate = 한 출처이거나 일반 지식과 일치 / limited = 거의 확인 못 함 (이때는 서술을 줄입니다).
- 문체는 "~합니다", 짧고 구체적으로. "최고의"·"완벽한" 같은 과장과 번역투는 쓰지 않습니다. 이모지는 foodPairing 의 emoji 에만 씁니다.
- 모든 글은 한국어로 씁니다. current 가 영어로 되어 있어도 한국어로 새로 씁니다. 상표·고유명사는 한글 표기에 원어를 괄호로 덧붙입니다.
- country 는 나라 이름 하나만 씁니다 (주된 생산국). 여러 나라가 얽히면 주된 생산국 하나만 쓰고 나머지 사정은 specs 나 notes 에 적습니다. region 은 여러 곳을 써도 됩니다.
- 확인하지 못해 필드 전체를 빼야 할 때는 result 에 그 필드를 null 로 넣습니다 (그래야 DB 에서도 지워집니다). 일부 문장만 빼는 경우에는 그 필드를 고쳐 쓴 값으로 넣습니다.
- foodPairing 은 3개, tips 는 최대 3개, similar 는 최대 4개 이름입니다. similar 는 같은 계열·같은 산지의 실제 제품만 적습니다.
- 도수(alcohol)는 병에 표기된 값입니다. 해마다·배치마다 다르면 범위로 적고 specs 에 이유를 적습니다. 같은 이름의 다른 도수 제품(예: 101 프루프 판)과 혼동하지 마세요.
- 결과 파일을 쓴 뒤, 반환값에는 요약(항목 수, 상태별 개수, 고친 수, 뺀 수, 검색 횟수)만 돌려줍니다. 내용은 반환하지 않습니다.`

// args: 입력 파일 경로의 배열, 또는 { prefix: 'wh', count: 102 } — data/research/_work/in/<prefix>-001.json … 로 푼다.
let files = []
if (Array.isArray(args)) files = args
else if (args && Array.isArray(args.files)) files = args.files   // 남은 묶음만 골라 넘길 때 (scripts/_remaining.mjs)
else if (args && args.prefix && args.count) {
  const from = Number(args.from || 1)
  for (let i = from; i < from + Number(args.count); i++) files.push(`data/research/_work/in/${args.prefix}-${String(i).padStart(3, '0')}.json`)
}
if (!files.length) return { error: '넘어온 입력 파일이 없습니다' }

phase('조사')

const run = (inPath, label) =>
  agent(
    `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${inPath.replace('/in/', '/out/')}\n\n먼저 입력 파일을 Read 하고, 모든 항목을 조사해 결과 파일을 쓰세요.`,
    { label, phase: '조사', schema: SUMMARY }
  )

// args.lanes: 동시에 돌릴 에이전트 수. 워크플로 하나의 동시 실행은 엔진이 10개로 정해 두어 pipeline 으로는 줄일 수 없다.
// 레인 k 가 k, k+lanes, k+2·lanes … 번째 묶음을 차례로 처리한다. 정하지 않으면 전부 pipeline 으로 한꺼번에 돌린다.
// 사용률 때문에 속도를 조절해야 하는 가동에서 쓴다.
const lanes = Number((args && args.lanes) || 0)
let results
if (lanes > 0) {
  const queues = Array.from({ length: lanes }, (_, k) => files.map((p, i) => ({ p, i })).filter((x) => x.i % lanes === k))
  const byLane = await parallel(
    queues.map((q, k) => async () => {
      const got = []
      let nulls = 0
      for (const x of q) {
        const r = await run(x.p, `조사 ${x.i + 1}`)
        got.push({ i: x.i, r })
        // 연달아 두 번 실패하면 이 레인을 멈춘다 — 한도에 막힌 상태에서 큐 전체를 실패로 태워 버리지 않게
        if (r === null) { if (++nulls >= 2) { log(`레인 ${k + 1} 연속 실패 — 멈춥니다 (남은 ${q.length - got.length}개는 결과 파일이 없는 채로 남는다)`); break } } else nulls = 0
      }
      return got
    })
  )
  results = new Array(files.length).fill(null)
  for (const lane of byLane.filter(Boolean)) for (const g of lane) results[g.i] = g.r
} else {
  results = await pipeline(files, (inPath, _x, i) => run(inPath, `조사 ${i + 1}`))
}

const ok = results.filter(Boolean)
const sum = (k) => ok.reduce((a, r) => a + (Number(r[k]) || 0), 0)
log(`묶음 ${files.length}개 중 완료 ${ok.length}개 — 항목 ${sum('entries')} · 확정 ${sum('verified')} · 부분 ${sum('partial')} · 특정 못 함 ${sum('unidentified')} · 술 아님 ${sum('notDrink')} · 고침 ${sum('corrections')} · 뺌 ${sum('removed')}`)

return {
  done: ok.length,
  total: files.length,
  entries: sum('entries'),
  verified: sum('verified'),
  partial: sum('partial'),
  unidentified: sum('unidentified'),
  notDrink: sum('notDrink'),
  corrections: sum('corrections'),
  removed: sum('removed'),
  failedFiles: files.filter((_, i) => !results[i]),
  notes: ok.map((r) => r.note).filter(Boolean).slice(0, 12),
}
