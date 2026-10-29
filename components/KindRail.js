"use client";
import { APP, UI } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

// 종류 색 카드 줄 — 홈 촬영 판 아래. 위스키 렌즈 홈의 "종류 색 카드"(2026-10-28)를 와인 · 사케에 옮긴 것.
//
// 카드마다 제 색 + 그 술의 잔 · 병(힉스필드, 배경 없이 뽑음). 누르면 찾기 화면을 그 종류로 바로 찾아 연다 —
// 검색은 술 종류 칸(result.type)까지 보므로 "스파클링", "다이긴조" 같은 말이 그대로 걸린다.
// 종류 목록은 앱 설정(lib/apps/<키>.js 의 theme.light.kinds)에 있고, 밝은 디자인 앱에만 보인다.
const KINDS = UI === "light" ? APP.theme.light?.kinds || [] : [];

export default function KindRail({ onPick }) {
  if (!KINDS.length) return null;
  return (
    <section className="kind-section" aria-label={t("종류로 둘러보기")}>
      <div className="kind-head">{t("종류로 둘러보기")}</div>
      <div className="kind-rail">
        {KINDS.map((k) => (
          <button key={k.term} className="kind-card" style={{ "--kc": k.color }} onClick={() => onPick(k.term)}>
            <strong>{t(k.label)}</strong>
            <span>{k.en}</span>
            <small>{t("둘러보기")} ›</small>
            <img src={k.img} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  );
}
