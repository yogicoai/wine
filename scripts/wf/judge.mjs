export const meta = {
  name: 'dailyshot-alias-judge',
  description: '데일리샷 후보 중 같은 술이 있는지 판정하고, 제안된 짝을 반박으로 검증한다',
  phases: [
    { title: '판정', detail: '묶음 파일을 읽고 후보 중 같은 술을 고른다' },
    { title: '검증', detail: '제안된 짝마다 반박 시도 둘 — 살아남은 것만 채택' },
  ],
}

const JUDGE = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ours: { type: 'string' },
          verdict: { type: 'string', enum: ['match', 'none'] },
          target: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['ours', 'verdict', 'why'],
      },
    },
  },
  required: ['decisions'],
}

const REFUTE = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    why: { type: 'string' },
  },
  required: ['refuted', 'why'],
}

const RULES = `당신은 한국 주류 판매 데이터를 대조합니다.

주어진 JSON 파일에는 항목마다 이런 것이 들어 있습니다.
  ours     우리 카탈로그의 술 이름
  cat      주종, band 값대(1~5), producer 생산자
  asked    데일리샷에 물어본 검색어
  cands    그 검색으로 나온 판매 상품 후보들 (이름·값·용량)

후보 중에 "우리 술과 완전히 같은 병"이 있는지 항목마다 판정하세요.

■ 틀리게 붙이는 것이 못 붙이는 것보다 훨씬 나쁩니다.
이 값은 목표가 알림에 쓰입니다. 엉뚱한 값이 붙으면 사용자는 오지 않을 알림을 기다립니다.
확신이 없으면 무조건 none 입니다.

■ none 으로 버려야 하는 것
- 후보에 우리 이름에 없는 제품군 낱말이 붙은 것.
  예) 우리 "강소백" → 후보 "강소백 청춘"은 다른 술입니다.
  실제 사고: "로얄 살루트 21년"에 "로얄살루트 21년 몰트"가 붙어 11만 원 비싼 다른 병 값이 떴습니다.
- 세트·패키지·전용잔·기획·묶음·바이알·미니어처·증정
- 브랜드가 다른 것. 예) "강소백 단순 고량주" → "연태 고량주"는 다른 회사입니다.
- 숙성 연수·빈티지·출시 연도가 어긋나는 것 (12년 vs 15년, 2017 vs 2023)
- 용량만 다른 것: 후보가 1L·375ml·500ml·200ml 뿐이면 none. 700ml/750ml 만 같은 병으로 봅니다.
  (와인·사케·맥주는 각각 750ml·720ml·500ml 안팎이 기본이니 주종에 맞게 판단하세요.)
- 우리 이름 자체가 술이 아닌 것(쇼핑몰 제목 찌꺼기, 잔·굿즈)
- band(값대)와 후보 값이 크게 어긋나는 것도 의심하세요. band 1은 가장 싼 쪽, 5는 가장 비싼 쪽입니다.

■ match 로 붙여도 되는 것
- 띄어쓰기·표기만 다른 같은 병. "몽키 숄더" → "몽키숄더", "레드브레스트" → "레드 브레스트"
- 판매처가 갈래말만 더 붙인 같은 병. "틸링 싱글몰트" → "틸링 싱글몰트 아이리시 위스키"
- 판매처가 용량을 이름 끝에 붙인 같은 병. "발렌타인 17년" → "발렌타인 17년 700ml"
- 영문·로마자 이름의 한글 표기. "Springbank 10 Year Old" → "스프링뱅크 10년"

match 이면 target 에 후보 이름을 **글자 그대로** 적으세요. 고쳐 쓰거나 줄이지 마세요.
파일에 있는 모든 항목에 대해 결정을 내야 합니다. why 는 한 줄, 한국어.`

const files = args || []
if (!files.length) return { error: '넘어온 묶음 파일이 없습니다' }

phase('판정')

const results = await pipeline(
  files,
  (file, _x, i) =>
    agent(
      `${RULES}\n\n판정할 파일: ${file}\n먼저 Read 로 그 파일을 읽고, 들어 있는 모든 항목을 판정해 반환하세요.`,
      { label: `판정 ${i + 1}`, phase: '판정', schema: JUDGE }
    ),

  async (judged) => {
    if (!judged?.decisions) return []
    const proposed = judged.decisions.filter((d) => d.verdict === 'match' && d.target)
    if (!proposed.length) return []

    const checked = await parallel(
      proposed.map((d) => () =>
        parallel(
          ['제품군이 갈리는가', '용량·연수·빈티지가 맞는가'].map((lens) => () =>
            agent(
              `아래 짝이 "완전히 같은 병"이라는 주장을 반박해 보세요. 관점: ${lens}\n\n` +
                `우리 이름: ${d.ours}\n판매처 이름: ${d.target}\n제안 근거: ${d.why}\n\n` +
                `다른 병이라고 볼 근거가 조금이라도 있으면 refuted=true 입니다. ` +
                `제품군을 가르는 낱말(몰트·리저브·청춘·프리미엄·에디션 등)이 한쪽에만 있거나, ` +
                `숙성 연수·빈티지·용량이 어긋나거나, 세트·패키지로 보이면 반박하세요. ` +
                `확신이 없으면 refuted=true. why 는 한 줄, 한국어.`,
              { label: '반박', phase: '검증', schema: REFUTE }
            )
          )
        ).then((votes) => {
          const ok = votes.filter(Boolean)
          return { ...d, survives: ok.length === 2 && ok.every((v) => !v.refuted), votes: ok.map((v) => v.why) }
        })
      )
    )
    return checked.filter(Boolean)
  }
)

const flat = results.filter(Boolean).flat()
const confirmed = flat.filter((x) => x.survives)
const rejected = flat.filter((x) => !x.survives)

log(`제안 ${flat.length}건 · 검증 통과 ${confirmed.length}건 · 반박되어 버림 ${rejected.length}건`)

return {
  confirmed: confirmed.map((x) => ({ ours: x.ours, target: x.target, why: x.why })),
  rejected: rejected.map((x) => ({ ours: x.ours, target: x.target, votes: x.votes })),
}
