// 이용 안내 — 앱마다 다른 가이드.
//
// 소스는 하나지만 앱은 여섯이다. 사케 앱의 안내에 "빈티지"가 나오면 안 되고,
// 위스키 앱의 안내에 "디캔팅"이 나오면 안 된다. 그래서 공통 뼈대(스캔·찾기·보관함)에
// 앱별 고유 카드(GUIDE)를 얹는 구조로 만든다. 공통 문구는 t()를 거쳐 앱 어휘를 따른다.
// (예전 이 자리의 내부 기능 설명서는 docs/archive/ 에 보관)
import Link from "next/link";
import { APP, BRAND_NAME, BRAND_MOTTO } from "@/lib/appProfile";
import { t } from "@/lib/i18n";
import { catalogStats } from "@/lib/catalog";

export const metadata = { title: `이용 안내 — ${APP.name}` };

// 앱별 고유 안내 — 이 앱만의 특징 카드들 (전통술 앱은 영어)
const GUIDE = {
  wine: {
    intro: "라벨을 찍으면 와인의 이야기·가격·페어링을 그 자리에서 읽어드립니다.",
    features: [
      ["🍷", "빈티지를 압니다", "같은 와인도 해마다 다릅니다. 빈티지별 가격을 비교하고, 마시기 좋은 시기(음용 적기)를 그래프로 보여드립니다."],
      ["⏱", "디캔팅·칠링 타이머", "탄닌이 강한 와인은 열어 두어야 합니다. 시간을 걸어 두면 다른 화면으로 옮겨도 이어지고, 끝나면 알림이 옵니다."],
      ["🍽", "푸드 페어링 + 장보기", "어울리는 안주를 이유와 함께 권하고, 바로 살 수 있는 곳까지 잇습니다."],
      ["🥂", "어떤 잔에 마실지", "보르도 잔과 부르고뉴 잔이 왜 다른지, 이 와인엔 어느 쪽인지 알려드립니다."],
    ],
    tip: "식당 와인 리스트를 통째로 찍으면 가성비 순으로 정리해 드립니다 — 메뉴판 가격이 시중가의 몇 배인지도요.",
  },
  sake: {
    intro: "사케 라벨을 찍으면 등급·양조장·맛과 온도까지 그 자리에서 읽어드립니다.",
    features: [
      ["🌡", "온도가 맛을 바꿉니다", "같은 사케도 차게(冷)와 데워서(燗)가 다른 술입니다. 이 병에 맞는 온도와 마시는 법을 알려드립니다."],
      ["🍶", "어떤 그릇에", "오초코·마스·와인잔 — 향이 화려한 다이긴조는 와인잔에서 제대로 열립니다."],
      ["✨", "신선할 때 마시는 술", "사케는 재우는 술이 아닙니다. 제조시기를 읽는 법과 보관 요령을 함께 드립니다."],
      ["🍣", "이자카야 메뉴판 스캔", "메뉴판을 통째로 찍으면 적힌 사케를 전부 읽어 가성비 순으로 세워드립니다."],
    ],
    tip: "라벨의 정미율 숫자가 낮을수록 쌀을 많이 깎은 술입니다 — 23은 최상급이라는 뜻입니다.",
  },
  beer: {
    intro: "맥주 라벨을 찍으면 스타일·양조장·어울리는 안주를 그 자리에서 읽어드립니다.",
    features: [
      ["🍺", "스타일을 압니다", "라거와 IPA와 스타우트는 다른 음료입니다. 쓴맛·홉향·몰트 네 축으로 이 맥주의 성격을 그려드립니다."],
      ["❄️", "신선도가 생명", "맥주는 재우는 술이 아닙니다. 온도와 잔, 거품 따르는 법까지 챙겨드립니다."],
      ["🍗", "안주 매칭 + 장보기", "치킨에 어울리는 맥주, 이 맥주에 어울리는 안주 — 이유와 함께, 살 수 있는 곳까지."],
      ["🏷", "취향 문답", "쌉싸름함·홉향 몇 가지만 답하면 냉장고에 채울 다음 맥주를 골라드립니다."],
    ],
    tip: "펍 메뉴판을 통째로 찍으면 적힌 맥주를 전부 읽어 스타일별로 정리해 드립니다.",
  },
  tradition: {
    intro: "Point your camera at any Korean bottle — we read the label and tell you what you're holding.",
    features: [
      ["🏺", "Made for newcomers", "Makgeolli, yakju, soju — explained for someone who has never had Korean alcohol, down to what nuruk is."],
      ["🥂", "Drinking culture included", "Pour for others first, receive with both hands — the etiquette that comes with the bottle."],
      ["🌡", "Freshness & temperature", "Fresh makgeolli is alive: refrigerate, drink within weeks, invert gently before opening. We keep track for you."],
      ["🍜", "Food pairing that makes sense", "Pajeon with makgeolli on a rainy day is a national ritual. We explain why, and where to buy the food."],
    ],
    tip: "The Korean name in parentheses matches the label on the bottle — hold it up and compare.",
  },
  whisky: {
    intro: "위스키 라벨을 찍으면 증류소·캐스크·마시는 법을 그 자리에서 읽어드립니다.",
    features: [
      ["🥃", "피트를 압니다", "스페이사이드의 과일향과 아일라의 스모크는 다른 세계입니다. 네 축으로 이 병의 성격을 그려드립니다."],
      ["💧", "가수(加水)와 잔", "물 몇 방울이 향을 여는 이유, 튤립 잔과 록 글라스의 차이를 알려드립니다."],
      ["📦", "병입 후엔 익지 않습니다", "숙성은 캐스크에서 끝났습니다. 개봉 후 보관 요령을 함께 드립니다."],
      ["🍫", "안주 매칭", "다크 초콜릿·치즈·육포 — 위스키의 결을 살리는 조합을 이유와 함께."],
    ],
    tip: "바 메뉴판을 찍으면 적힌 위스키를 전부 읽어 가격 대비 가치 순으로 세워드립니다.",
  },
  spirits: {
    intro: "증류주 라벨을 찍으면 원료·산지·마시는 법을 그 자리에서 읽어드립니다.",
    features: [
      ["🍸", "여섯 갈래를 한 앱에", "브랜디·진·럼·데킬라·백주·리큐르 — 병만 찍으면 어느 갈래인지부터 알려드립니다."],
      ["🍋", "칵테일 문법", "진토닉·마가리타·하이볼 — 이 병으로 만들 수 있는 가장 쉬운 한 잔을 권합니다."],
      ["🧊", "니트냐 온더락이냐", "병마다 정답이 다릅니다. 온도와 잔, 곁들일 안주까지."],
      ["🏷", "가격대 감각", "이 병이 어느 급인지, 선물로 괜찮은지 — 가격대와 함께 읽어드립니다."],
    ],
    tip: "라벨이 외국어뿐이어도 괜찮습니다 — 찍으면 한국에서 통용되는 이름과 시세로 찾아드립니다.",
  },
};

export default async function GuidePage() {
  const g = GUIDE[APP.key] || GUIDE.wine;
  const stats = await catalogStats().catch(() => null);
  const full = stats?.full ?? null;

  return (
    <main className="app">
      <header className="hdr">
        <Link className="hdr-home" href="/">
          <span className="hdr-lockup">
            <span className="hdr-logo">
              {BRAND_NAME.split(" ")[0]} <em>{BRAND_NAME.split(" ").slice(1).join(" ")}</em>
            </span>
            <span className="hdr-sub">{BRAND_MOTTO}</span>
          </span>
        </Link>
      </header>

      <div className="result">
        <div className="hero">
          <div className="hero-cat">{t("이용 안내")}</div>
          <h1 className="hero-name" style={{ fontSize: 30 }}>{APP.name}</h1>
          <p className="hero-meta">{g.intro}</p>
          {full != null && (
            <p className="hero-meta" style={{ marginTop: 6 }}>
              {t("지금 {n}종의 술이 정식 분석되어 있습니다", { n: full.toLocaleString() })}
            </p>
          )}
        </div>

        {/* 공통 사용법 — 어휘는 t()가 앱에 맞게 바꾼다 (셀러/술창고/냉장고/진열장) */}
        <div className="card">
          <div className="card-title">{t("이렇게 씁니다")}</div>
          <ul className="tips-list">
            <li>{t("라벨을 찍으면 몇 초 안에 분석이 나옵니다. 작은 글씨는 화면을 벌려 확대해서 찍으세요.")}</li>
            <li>{t("찾기 탭에서 이름으로 검색하거나, 취향 문답에 답하면 맞는 술을 추천받습니다.")}</li>
            <li>{t("마음에 든 술은 {c}에 담아두세요. 시세가 내려가면 특가 알림을 드립니다.", { c: t("셀러") })}</li>
            <li>{t("기록 탭에는 스캔한 술이 차곡차곡 남습니다.")}</li>
            <li>{t("내 정보에서 술 정보 언어(한국어·영어·일본어)를 고를 수 있습니다.")}</li>
          </ul>
        </div>

        {/* 이 앱만의 특징 */}
        <div className="card">
          <div className="card-title">{t("이 앱의 특징")}</div>
          <div className="pair-list">
            {g.features.map(([emoji, title, body]) => (
              <div className="pair" key={title}>
                <div className="emo">{emoji}</div>
                <div className="pair-body">
                  <b>{title}</b>
                  <span>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">{t("알아두면 좋은 것")}</div>
          <p>{g.tip}</p>
        </div>

        <div className="result-actions">
          <Link className="btn primary" href="/" style={{ textAlign: "center", lineHeight: 1.4 }}>
            {t("시작하기")}
          </Link>
        </div>
      </div>
    </main>
  );
}
