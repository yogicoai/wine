# 보틀 렌즈 — 디자인 에셋 생성 프롬프트 팩

힉스필드(또는 다른 이미지 생성 툴)에 붙여넣는 용도. 영어 프롬프트가 결과가 안정적이라 영어로 작성.

## 공통 스타일 (모든 프롬프트 끝에 그대로 붙이기)

```
Luxury editorial style, dark wine-cellar mood, deep charcoal-brown background (#14100d),
warm candle-like rim lighting, muted antique gold accents (#cfa864), subtle film grain,
high-end liquor magazine aesthetic, photorealistic, centered composition, no text, no watermark
```

> ⚠️ 실제 브랜드(참이슬·발렌타인 등) 라벨/로고가 나오게 하지 마세요. 상표권 문제 + 어차피 범용 이미지가 필요합니다. 라벨은 "blank cream label" 처리.
> 💡 한 번 마음에 드는 결과가 나오면 그 **시드(seed)를 고정**하고 주종 단어만 바꿔서 12종을 뽑으면 톤이 통일됩니다.

---

## 1. 주종별 병 이미지 12종 (결과 화면 히어로 배경) — 최우선

납품 규격: **1024×1024 이상, 배경은 #14100d에 가까운 어두운 톤**(앱 배경과 자연스럽게 섞이도록), 파일명은 아래 표 그대로 PNG.

템플릿 — `{BOTTLE}` 만 교체:

```
A single elegant {BOTTLE}, standing centered on a dark reflective surface,
blank cream-colored label with no text, dramatic side lighting, shallow depth of field,
photographed like a premium liquor advertisement
+ (공통 스타일)
```

| 파일명 | {BOTTLE} 에 넣을 문구 |
|---|---|
| `wine.png` | Bordeaux-style red wine bottle with deep burgundy glass |
| `sake.png` | Japanese sake bottle (720ml issho-bin style), frosted pale green glass |
| `whisky.png` | single malt whisky bottle with amber liquid and cork stopper |
| `traditional.png` | Korean traditional liquor bottle in milky ceramic (makgeolli/cheongju style onggi bottle) |
| `beer.png` | craft beer bottle, brown glass with condensation droplets |
| `brandy.png` | cognac bottle with wide rounded body and amber liquid |
| `baijiu.png` | Chinese baijiu bottle in white porcelain with red silk ribbon |
| `tequila.png` | artisanal tequila bottle with agave-embossed clear glass |
| `rum.png` | dark aged rum bottle with heavy squat body |
| `gin.png` | botanical gin bottle in deep teal glass with tall neck |
| `soju.png` | Korean soju bottle in signature green glass, 360ml |
| `spirits.png` | mysterious unmarked distilled spirit bottle, clear glass |

저장 위치: `public/bottles/` → 코드에서 카테고리별 자동 매핑 예정.

---

## 2. 브랜드 로고 / 앱 아이콘

**앱 아이콘 (1024×1024, 정사각)**

```
Minimal luxury app icon: a wine bottle silhouette inside a camera lens aperture ring,
antique gold line art on deep charcoal-brown background, engraved emblem style,
flat vector look, elegant serif-era crest feeling, centered, generous margins
+ (공통 스타일의 색상 부분만 적용)
```

**가로형 로고/워드마크 배경 없이 쓰기 어려우면**: 아이콘만 받고 "Bottle Lens" 텍스트는 앱에서 폰트(Cormorant Garamond)로 렌더 — 지금 헤더가 이미 그 방식이라 텍스트 포함 로고는 불필요.

---

## 3. OG 이미지 (링크 공유 미리보기, 1200×630)

```
Wide banner: three elegant liquor bottles (wine, whisky, sake) in a dark candle-lit cellar,
golden light rays scanning across the center bottle like a camera focus beam,
large empty space on the left third for headline text overlay
+ (공통 스타일)
```

텍스트는 넣지 말고 왼쪽 여백만 확보 → "보틀 렌즈" 문구는 코드에서 오버레이.

---

## 4. 빈 상태 / 실패 상태 일러스트 (선택)

**히스토리 비어있음 (800×800)**

```
Empty vintage wine cellar shelf with soft dust particles in warm light,
one empty glass waiting, melancholic but inviting, minimal illustration style
+ (공통 스타일)
```

**라벨 인식 실패 (800×800)**

```
A blurred out-of-focus bottle silhouette behind frosted glass,
a golden magnifying glass in front, gentle humorous mood, minimal illustration style
+ (공통 스타일)
```

---

## 5. 공유 카드 배경 (인스타 스토리용 1080×1920, 피드용 1080×1080)

```
Vertical luxury certificate background: dark charcoal-brown paper texture with subtle grain,
thin antique gold double border frame, small engraved grape-and-wheat crest at top center,
large empty center area for content, bottom area with delicate gold divider line
+ (공통 스타일)
```

→ 이 배경 위에 결과 데이터(술 이름, 레이더, 별점)를 코드에서 캔버스로 합성해 "공유 카드"를 만듭니다.

---

## 생성하지 않아도 되는 것 (코드에서 처리)

- 카메라/갤러리/히스토리/삭제 등 **작은 UI 아이콘** → 생성형 이미지는 픽셀이 뭉개져서 부적합. 라인 SVG 아이콘으로 코드에서 교체 예정 (현재 이모지 → SVG 세트로 업그레이드는 제가 처리)
- 로딩 스피너, 레이더 차트, 신뢰도 미터 → 전부 SVG/CSS

## 납품 체크리스트

- [ ] bottles 12종 → `public/bottles/`
- [ ] 앱 아이콘 1024 → `public/icon.png`
- [ ] OG 1200×630 → `public/og.png`
- [ ] (선택) 빈 상태 2종 → `public/empty-history.png`, `public/not-found.png`
- [ ] (선택) 공유 카드 배경 2종 → `public/card-story.png`, `public/card-square.png`
