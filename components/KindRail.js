"use client";
import { APP, UI } from "@/lib/appProfile";
import { t } from "@/lib/i18n";

// 종류 색 카드 줄 — 위스키 렌즈 홈의 "종류로 둘러보기"와 같은 모양(영문 이름 · 한글 이름 · 몇 종).
//
// 카드마다 제 색 + 그 술의 잔 · 병(힉스필드, 배경 없이 뽑음). 누르면 목록 탭을 그 종류로 걸러 연다 —
// 종류는 술 종류 칸(result.type) · 이름에 걸리는 말로 고른다(lib/browse.js).
// 종류 목록은 앱 설정(lib/apps/<키>.js 의 theme.light.kinds)에 있고, 밝은 디자인 앱에만 보인다.
const KINDS = UI === "light" ? APP.theme.light?.kinds || [] : [];

export default function KindRail({ onPick, counts = null, onAll = null }) {
  if (!KINDS.length) return null;
  return (
    <section className="section kind-section" aria-label={t("종류로 둘러보기")}>
      <div className="section-head">
        <h2 className="h2">{t("종류로 둘러보기")}</h2>
        {onAll && (
          <button className="link-more" onClick={onAll}>{t("전체")}</button>
        )}
      </div>
      <div className="kind-rail">
        {KINDS.map((k) => (
          <button key={k.term} className="kind-card" style={{ "--kc": k.color }} onClick={() => onPick(k.term)}>
            <strong>{k.en}</strong>
            <span>{t(k.label)}</span>
            <small>{counts?.[k.term] != null ? t("{n}종", { n: counts[k.term].toLocaleString() }) : `${t("둘러보기")} ›`}</small>
            <img src={k.img} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  );
}
