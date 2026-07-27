# 주종 엠블럼 스프라이트 프롬프트 (한 장에 12개)

한 번 생성해서 제가 잘라 쓰는 방식입니다. 12번 따로 뽑는 것보다 **톤이 완벽하게 통일**되고 시간도 절약됩니다.

## 잘라 쓰려면 이 규칙이 중요합니다

프롬프트에 **격자 규격을 명시**해야 제가 정확히 자를 수 있습니다. 아래 프롬프트에 이미 넣어뒀습니다.

- **정사각 캔버스** (1024×1024 또는 2048×2048)
- **4열 × 3행 = 12칸**, 칸마다 아이콘 1개, 간격 균일
- **투명 배경** (안 되면 단색 `#14100d`)
- 칸 안에서 가운데 정렬, 여백 넉넉히
- **글자·번호·테두리선 없이** (격자선이 그려지면 자를 때 지저분해집니다)

---

## 프롬프트 A — 주종 엠블럼 12종 (가장 중요)

```
A 4x3 grid sheet of 12 separate liquor emblem icons, evenly spaced,
each icon centered in its own invisible cell with generous padding.
Engraved line-art style, antique gold single color (#d4b278),
transparent background, thick clean strokes, symmetrical,
vintage wine-label engraving aesthetic, flat vector look.

Row 1 left to right: a Bordeaux wine bottle with a wine glass,
a Japanese sake bottle with a small cup, a square whisky bottle with a rocks glass,
a Korean earthenware onggi liquor jar.

Row 2 left to right: a beer glass with foam and a hop cone,
a cognac bottle with a snifter glass, a Chinese porcelain baijiu bottle with a ribbon,
a tequila bottle with an agave plant.

Row 3 left to right: a rum bottle with a palm leaf,
a gin bottle with juniper berries, a Korean soju bottle with a shot glass,
a milky makgeolli bowl with a kettle.

No text, no numbers, no grid lines, no borders, no shadows, no background.
```

**격자 순서 (제가 자를 때 쓰는 기준)**

| | 1열 | 2열 | 3열 | 4열 |
|---|---|---|---|---|
| **1행** | 와인 | 사케 | 위스키 | 전통주 |
| **2행** | 맥주 | 브랜디 | 백주 | 데킬라 |
| **3행** | 럼 | 진 | 소주 | 막걸리 |

> 순서가 섞여 나와도 괜찮습니다. 제가 보고 맞춰서 자르겠습니다.

---

## 프롬프트 B — 나머지 4종 + 여분 (2×2)

주종이 16종이라 위 12개에 더해 **보드카·리큐르·하이볼·기타**가 필요합니다.

```
A 2x2 grid sheet of 4 separate liquor emblem icons, evenly spaced,
each centered in its own invisible cell with generous padding.
Engraved line-art style, antique gold single color (#d4b278),
transparent background, thick clean strokes, symmetrical,
vintage wine-label engraving aesthetic, flat vector look.

Top left: a frosted vodka bottle with an ice cube.
Top right: a curvy liqueur bottle with a cocktail glass and a citrus slice.
Bottom left: a tall highball can with a fizzy glass and a lemon wedge.
Bottom right: an unmarked distillation flask with a single droplet.

No text, no numbers, no grid lines, no borders, no shadows, no background.
```

| | 1열 | 2열 |
|---|---|---|
| **1행** | 보드카 | 리큐르 |
| **2행** | 하이볼·RTD | 기타 |

---

## 프롬프트 C — 상태 일러스트 2종 (선택, 각각 따로)

이건 크기가 커서 한 장에 하나씩 뽑는 게 낫습니다.

```
[빈 셀러]
An empty vintage wine cellar shelf lit by warm candlelight, soft dust motes in the air,
one empty wine glass waiting on the shelf, deep espresso-brown background (#14100d),
muted antique gold highlights, minimal illustration, melancholic but inviting, no text
```

```
[인식 실패]
A blurred out-of-focus bottle silhouette behind frosted glass, a golden magnifying glass
in front of it, deep espresso-brown background (#14100d), muted antique gold highlights,
minimal illustration, gently humorous, no text
```

---

## UI 아이콘은 안 만드셔도 됩니다

카메라·갤러리·와인잔·서랍 같은 **작은 버튼 아이콘은 이미 SVG로 직접 그려 넣었습니다.**
화면에서 이모지가 깨져 보이던 문제(카메라가 윈도우 폴더 아이콘으로 나오던 것)도 이걸로 해결됐습니다.
생성 이미지는 20px 크기로 줄이면 뭉개지기 때문에, 작은 아이콘은 SVG가 맞습니다.

---

## 받은 뒤 절차

1. 생성된 스프라이트를 `public/icons/` 안에 아무 이름으로 저장 (예: `sprite-12.png`, `sprite-4.png`)
2. 저에게 "넣었어"라고 알려주시면
3. 제가 격자를 확인해 12(+4)개로 자르고, `public/icons/wine.png` 같은 이름으로 저장한 뒤
4. 코드에서 이모지를 이미지로 교체하고 크기·정렬까지 맞추겠습니다

자를 때 배경이 투명이면 여백을 자동으로 감지해 딱 맞게 잘라낼 수 있습니다.
