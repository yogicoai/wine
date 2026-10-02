export const meta = {
  name: 'image-check',
  description: '규격을 맞춘 상품 사진을 열어 보고, 이름의 그 상품이 맞는지 판정한다',
  phases: [{ title: '확인', detail: '묶음마다 사진을 Read 로 열어 판정하고 결과 JSON 을 쓴다' }],
}

const SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    items: { type: 'number' },
    match: { type: 'number' },
    mismatch: { type: 'number' },
    unclear: { type: 'number' },
    notProduct: { type: 'number' },
    note: { type: 'string' },
  },
  required: ['file', 'items'],
}

const RULES = `당신은 주류 상품 사진 검수자입니다. 사진 파일을 직접 열어 보고, 그것이 항목 이름의 그 상품이 맞는지 판정합니다.

■ 원칙 — 틀린 사진이 공개되는 것이 사진이 없는 것보다 훨씬 나쁩니다. 의심스러우면 unclear 입니다.

■ 입력
입력 파일(JSON)을 Read 로 읽습니다. 항목마다 name(카탈로그 이름), category(주종), file(사진 경로)이 있습니다.
사진은 Read 도구로 파일 경로를 열면 이미지로 보입니다. 한 응답에서 Read 를 4~5개씩 동시에 호출해 한꺼번에 열고 (한 장씩 차례로 열면 같은 일이 몇 배 느리고 비쌉니다), 사진마다 따로 판정하세요.

■ 판정 (verdict)
- match       사진 속 병·캔·박스가 이름의 그 제품임이 라벨·상표·모양으로 확인된다. 브랜드가 읽히고, 제품명·숙성연수·종류가 이름과 모순되지 않는다.
- mismatch    다른 브랜드이거나 다른 제품이다 (다른 연수·종류·라인·용량 구성). 이름과 어긋난다.
- unclear     상품 사진이긴 한데 라벨이 안 읽히거나, 이름과 같은 제품인지 판단할 수 없다.
- not_product 상품 사진이 아니다 — 배너·로고·여러 병을 늘어놓은 사진·잔·안주·사람·빈 이미지·"이미지 준비중" 같은 자리표시.

■ 주의해서 볼 것
- 같은 브랜드의 다른 제품을 가려내세요. 연수(12년/15년), 라인(오리지널/리저브), 맛(오리지널/레몬), 용량 구성(낱병/세트)이 이름과 같은가.
- 여러 병이 한 사진에 있으면 flags 에 "multi-bottle" 을 적고, 그중 이름의 제품이 중심이면 match, 아니면 mismatch/unclear.
- 빨간 "19" 배지, 워터마크, 판매처 로고, 가격·할인 문구가 남아 있으면 flags 에 적습니다 (adult-badge / watermark / text-overlay).
- 사진이 심하게 흐리거나 잘렸으면 flags 에 "low-quality" 를 적습니다.
- 이름이 영문이거나 로마자라도 사진의 라벨과 비교해 보세요. 한글 표기가 달라도 같은 제품일 수 있습니다.

■ 결과 — 입력 경로의 "/in/" 을 "/out/" 으로 바꾼 경로에 Write 도구로 JSON 배열을 씁니다 (유효한 JSON)
[ { "name": "<입력의 name 그대로>", "verdict": "match|mismatch|unclear|not_product", "seen": "사진에서 읽은 상표·제품명 (읽은 그대로, 짧게)", "flags": [], "note": "판정 이유 한 줄" } ]
모든 항목에 대해 결정을 내야 합니다. 반환값에는 요약(항목 수, 판정별 개수)만 돌려줍니다.`

// args: 입력 파일 경로의 배열, 또는 { prefix: 'img', count: 129 } — data/images/_work/in/<prefix>-001.json … 로 푼다.
let files = []
if (Array.isArray(args)) files = args
else if (args && Array.isArray(args.files)) files = args.files   // 남은 묶음만 골라 넘길 때 (scripts/_remaining.mjs)
else if (args && args.prefix && args.count) {
  const from = Number(args.from || 1)
  for (let i = from; i < from + Number(args.count); i++) files.push(`data/images/_work/in/${args.prefix}-${String(i).padStart(3, '0')}.json`)
}
if (!files.length) return { error: '넘어온 입력 파일이 없습니다' }

phase('확인')

const run = (inPath, label) =>
  agent(
    `${RULES}\n\n입력 파일: ${inPath}\n결과 파일: ${inPath.replace('/in/', '/out/')}\n\n먼저 입력 파일을 Read 하고, 사진을 하나씩 열어 판정해 결과 파일을 쓰세요.`,
    { label, phase: '확인', schema: SUMMARY }
  )

// args.lanes: 동시에 돌릴 에이전트 수 (research.mjs 와 같다). 정하지 않으면 pipeline 으로 한꺼번에 돌린다.
const lanes = Number((args && args.lanes) || 0)
let results
if (lanes > 0) {
  const queues = Array.from({ length: lanes }, (_, k) => files.map((p, i) => ({ p, i })).filter((x) => x.i % lanes === k))
  const byLane = await parallel(
    queues.map((q, k) => async () => {
      const got = []
      let nulls = 0
      for (const x of q) {
        const r = await run(x.p, `사진 ${x.i + 1}`)
        got.push({ i: x.i, r })
        if (r === null) { if (++nulls >= 2) { log(`레인 ${k + 1} 연속 실패 — 멈춥니다`); break } } else nulls = 0
      }
      return got
    })
  )
  results = new Array(files.length).fill(null)
  for (const lane of byLane.filter(Boolean)) for (const g of lane) results[g.i] = g.r
} else {
  results = await pipeline(files, (inPath, _x, i) => run(inPath, `사진 ${i + 1}`))
}

const ok = results.filter(Boolean)
const sum = (k) => ok.reduce((a, r) => a + (Number(r[k]) || 0), 0)
log(`묶음 ${files.length}개 중 완료 ${ok.length}개 — 사진 ${sum('items')}장 · 맞음 ${sum('match')} · 다름 ${sum('mismatch')} · 불명 ${sum('unclear')} · 상품 아님 ${sum('notProduct')}`)

return {
  done: ok.length,
  total: files.length,
  items: sum('items'),
  match: sum('match'),
  mismatch: sum('mismatch'),
  unclear: sum('unclear'),
  notProduct: sum('notProduct'),
  failedFiles: files.filter((_, i) => !results[i]),
}
