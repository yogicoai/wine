# 보틀 렌즈 — 아이콘 생성 프롬프트 (힉스필드용)

영어 프롬프트가 결과가 안정적이라 영어로 작성했습니다. 그대로 복사해서 넣으시면 됩니다.

## 공통 규칙 (꼭 지켜주세요)

1. **한 세트는 같은 시드(seed)로** — 마음에 드는 결과가 나오면 시드를 고정하고 대상 단어만 바꿔야 12개가 한 세트처럼 보입니다.
2. **배경은 투명(transparent) 또는 단색 `#14100d`** — 앱 배경에 자연스럽게 얹힙니다.
3. **정사각 1024×1024**, 여백 넉넉히, 가운데 정렬.
4. **선을 두껍게** — 작은 크기(48px)로 줄여도 뭉개지지 않아야 합니다.
5. 실제 브랜드 로고·상표는 넣지 마세요 (상표권 문제).

---

## A. 주종 엠블럼 12종 ★ 최우선

현재 이모지(🍷🥃🍶…)로 되어 있는 자리를 대체합니다. 결과 화면 상단 배지, 셀러 목록 썸네일에 쓰입니다.

**공통 스타일 문구** — 아래 템플릿의 `{BOTTLE}`만 바꿔 12번 생성:

```
A minimal emblem icon of {BOTTLE}, engraved line-art style,
antique gold single color (#d4b278) on transparent background,
thick clean strokes, centered, generous margin, symmetrical,
vintage wine-label engraving aesthetic, flat vector look,
no text, no background, no shadow
```

| 파일명 | `{BOTTLE}` |
|---|---|
| `wine.png` | a Bordeaux wine bottle with a wine glass beside it |
| `sake.png` | a Japanese sake bottle (tokkuri) with a small sake cup |
| `whisky.png` | a square whisky bottle with a rocks glass |
| `traditional.png` | a Korean earthenware onggi liquor jar with a small bowl |
| `beer.png` | a beer glass with foam and a hop cone |
| `brandy.png` | a cognac bottle with a snifter glass |
| `baijiu.png` | a Chinese porcelain baijiu bottle with a ribbon |
| `tequila.png` | a tequila bottle with an agave plant |
| `rum.png` | a rum bottle with a palm leaf |
| `gin.png` | a gin bottle with juniper berries and a botanical sprig |
| `soju.png` | a Korean soju bottle with a small shot glass |
| `spirits.png` | an unmarked distillation flask with a droplet |

저장 위치: `public/icons/` → 제가 카테고리별로 자동 매핑하겠습니다.

---

## B. 앱 아이콘 / 파비콘 ★

홈 화면 설치 아이콘, 브라우저 탭 아이콘으로 씁니다.

```
A luxury app icon: a wine bottle silhouette centered inside a camera lens
aperture ring, antique gold (#d4b278) engraved line art on a deep
espresso-brown background (#14100d), crest emblem style, perfectly centered,
thick strokes, generous padding, flat vector look, subtle metallic sheen,
no text, no watermark
```

저장: `public/icon.png` (1024×1024)

---

## C. UI 액션 아이콘 6종 (선택)

헤더와 버튼의 이모지(📷🍷🗂️)를 대체합니다. **없어도 무방합니다** — 필요하시면 제가 SVG로 그려도 됩니다.

```
A minimal UI icon of {SUBJECT}, single-weight line art,
antique gold (#d4b278) on transparent background, 2px-equivalent thick strokes,
geometric, centered in a square, 20% padding, no fill, no text, no background
```

| 파일명 | `{SUBJECT}` |
|---|---|
| `camera.png` | a camera shutter |
| `cellar.png` | a wine glass |
| `history.png` | stacked archive cards |
| `timer.png` | an hourglass |
| `star.png` | a five-pointed star outline |
| `tag.png` | a price tag |

저장: `public/icons/ui/`

---

## D. 상태 일러스트 2종 (선택)

```
[빈 셀러]
An empty vintage wine cellar shelf with soft dust motes in warm candlelight,
one empty glass waiting on the shelf, deep espresso-brown background,
muted antique gold highlights, minimal illustration, melancholic but inviting,
no text
```

```
[인식 실패]
A blurred out-of-focus bottle silhouette behind frosted glass,
a golden magnifying glass in front of it, deep espresso-brown background,
muted antique gold highlights, minimal illustration, gently humorous, no text
```

저장: `public/empty-cellar.png`, `public/not-found.png` (각 800×800)

---

## E. 공유 카드 배경 2종 (나중에)

공유 카드 기능을 만들 때 씁니다. 이 배경 위에 술 이름·레이더·별점을 코드로 합성합니다.

```
A luxury certificate background: deep espresso-brown paper texture with fine grain,
thin antique gold double-line border frame, a small engraved grape-and-wheat crest
at top center, large empty area in the middle, a delicate gold divider line near the bottom,
no text, no watermark
```

- 인스타 스토리용: 1080×1920 → `public/card-story.png`
- 피드용: 1080×1080 → `public/card-square.png`

---

## 받으신 뒤

`public/` 아래 위 경로대로 넣어주시고 알려주시면, 제가 코드에서 이모지를 이미지로 교체하고 크기·정렬을 맞추겠습니다. **A(주종 12종)와 B(앱 아이콘)만 있어도 인상이 크게 달라집니다.**
