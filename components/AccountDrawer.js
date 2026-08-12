"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import TimerVisual from "./TimerVisual";
import FontScale from "./FontScale";
import { FONT_SCALE } from "@/lib/features";
import useActiveTimers from "./useActiveTimer";
import { clearTimer, progressOf, formatRemain } from "@/lib/timer";
import { t } from "@/lib/i18n";
import { LOCALES, getContentLocale, setContentLocale } from "@/lib/locale";
import { APP_LOCALES } from "@/lib/appProfile";
import { MULTILINGUAL } from "@/lib/features";
import { APP } from "@/lib/appProfile";

// 내 정보 — 회원가입이 붙기 전의 레이아웃 초안.
//
// 로그인이 아직 없으므로 "이 자리에 무엇이 들어갈지"를 먼저 세워 둔다.
// 지금 보여 줄 수 있는 값(스캔 수·셀러·취향)은 실제 데이터로 채우고,
// 로그인이 있어야 가능한 것은 준비 중으로 표시한다.
// 이렇게 해 두면 인증만 붙이면 화면은 그대로 살아난다.
export default function AccountDrawer({ open, onClose, onOpenCellar, onOpenWine, onToast }) {
  const [stats, setStats] = useState(null);
  // 술 정보 언어 — SSR 과 쿠키가 어긋나지 않게 마운트 뒤에 읽는다
  const [lang, setLang] = useState(null);
  // 알림은 앱 최상단이 책임진다 — 여기서는 보기만 한다
  const { timers } = useActiveTimers();

  useEffect(() => {
    setLang(getContentLocale());
  }, []);

  function pickLang(key) {
    if (key === lang) return;
    // 번역이 준비되지 않은 언어는 고를 수 없다 — 반쯤 번역된 화면이
    // 아무것도 없는 것보다 나쁘다 (lib/features.js 에 이유를 적어 두었다)
    if (!MULTILINGUAL && !APP_LOCALES.includes(key)) return;
    setContentLocale(key);
    setLang(key);
    // 안내는 고른 언어로 — 그 언어를 읽는 사람에게 하는 말이다
    onToast?.(
      key === "ko"
        ? "한국어로 바꿉니다."
        : key === "en"
          ? "Switching to English."
          : "日本語に切り替えます。"
    );
    // 화면 글자까지 바꾸려면 서버가 처음부터 그 언어로 그려야 한다.
    // 지금 화면만 갈아 끼우면 서버가 그린 것과 어긋나 화면이 깨진다.
    // 토스트를 잠깐 보여 준 뒤 새로고침한다 — 언어는 자주 바꾸는 설정이 아니다.
    setTimeout(() => window.location.reload(), 450);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;

    Promise.all([
      fetch("/api/sessions").then((r) => r.json()).catch(() => ({})),
      fetch("/api/cellar").then((r) => r.json()).catch(() => ({})),
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
    ]).then(([sessions, cellar, prefs]) => {
      if (!alive) return;
      const items = cellar.items || [];
      setStats({
        scans: sessions.sessions?.length || 0,
        have: items.filter((i) => i.status === "have").reduce((s, i) => s + (i.bottles || 0), 0),
        wish: items.filter((i) => i.status === "wish").length,
        drunk: items.filter((i) => i.status === "drunk").length,
        notes: items.reduce((s, i) => s + (i.notes?.length || 0), 0),
        taste: prefs.summary || cellar.taste?.summary || null,
        answered: prefs.profile?.answered || 0,
      });
    });

    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  const soon = () => onToast?.(t("로그인 기능은 준비 중입니다."));

  return (
    <>
      <div className="drawer-dim" onClick={onClose} />
      <aside className="drawer">
        {/* 배경을 눌러도 닫히지만, 한 손으로 쓰는 모바일에서는 눌러야 할 곳이 보여야 한다 */}
        <button className="drawer-close" onClick={onClose} aria-label={t("닫기")}>
          <Icon name="close" size={16} />
        </button>
        <h3>{t("내 정보")}</h3>

        {/* 술 정보 언어 — 번역층(i18n.en/ja)이 준비된 술은 고른 언어로 나온다.
            선택은 쿠키라 서버의 카탈로그 조회까지 전달된다 (lib/locale.js) */}
        <div className="acct-section">{t("언어")}</div>
        <div className="acct-lang" role="group" aria-label={t("언어")}>
          {LOCALES.map((l) => {
            const ready = MULTILINGUAL || APP_LOCALES.includes(l.key);
            return (
              <button
                key={l.key}
                className={`lang-chip ${lang === l.key ? "on" : ""} ${ready ? "" : "is-soon"}`}
                aria-pressed={lang === l.key}
                disabled={!ready}
                onClick={() => pickLang(l.key)}
              >
                {l.label}
                {!ready && <i className="lang-soon">{t("준비 중")}</i>}
              </button>
            );
          })}
        </div>
        <p className="drawer-note" style={{ marginTop: 6 }}>
          MULTILINGUAL
            ? t("화면과 술 정보에 함께 적용됩니다. 번역이 준비되지 않은 술은 한국어로 나옵니다.")
            : t("영어·일본어는 술 정보 번역을 준비하는 중입니다. 준비되면 여기서 고를 수 있습니다.")
        </p>

        {/* 로그인 전 — 자리만 잡아 둔다 */}
        <div className="acct-card">
          <div className="acct-avatar">
            <Icon name="user" size={26} stroke={1.2} />
          </div>
          <div className="acct-who">
            <b>{t("로그인하지 않음")}</b>
            <span>{t("지금 기록은 이 기기에만 저장됩니다")}</span>
          </div>
        </div>

        <div className="acct-auth">
          <button className="btn primary" onClick={soon}>{t("카카오로 시작하기")}</button>
          <button className="btn" onClick={soon}>{t("네이버로 시작하기")}</button>
        </div>
        <p className="drawer-note">
          {t("주류 서비스는 만 19세 이상 확인이 필요합니다. 소셜 로그인의 생년월일로 1차 확인 후, 정식 서비스에서는 본인인증을 연동할 예정입니다.")}
        </p>

        {/* 진행 중인 준비 — 자리를 뜨는 시간이라 여기서 확인할 수 있어야 한다.
            여러 개를 동시에 둘 수 있으므로 전부 늘어놓는다. */}
        {timers.length > 0 && (
          <>
            <div className="acct-section">{t("진행 중")}</div>
            {timers.map((tm) => (
              <div className="acct-timer" key={tm.id}>
                <div className="acct-timer-stage">
                  <TimerVisual kind={tm.kind} progress={progressOf(tm)} mini />
                </div>
                <div className="acct-timer-body">
                  {/* 이름을 누르면 그 술로 간다 — 준비 중인 술이 궁금해지는 게 자연스럽다 */}
                  <button
                    className="acct-timer-name"
                    onClick={() => {
                      onClose?.();
                      onOpenWine?.(tm.name);
                    }}
                  >
                    {tm.name}
                  </button>
                  <span>{t("{label} 진행 중", { label: t(tm.label) })}</span>
                  <i style={{ width: `${progressOf(tm) * 100}%` }} />
                </div>
                <div className="acct-timer-right">
                  <div className="acct-timer-clock">{formatRemain(tm.remain)}</div>
                  <button className="acct-timer-stop" onClick={() => clearTimer(tm.id)}>
                    {t("중단")}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 활동 — 지금도 보여 줄 수 있는 값 */}
        <div className="acct-section">{t("활동")}</div>
        <div className="acct-stats">
          <div><b>{stats ? stats.scans : "–"}</b><span>{t("스캔")}</span></div>
          <div><b>{stats ? stats.have : "–"}</b><span>{t("보유 병")}</span></div>
          <div><b>{stats ? stats.drunk : "–"}</b><span>{t("마신 술")}</span></div>
          <div><b>{stats ? stats.notes : "–"}</b><span>{t("노트")}</span></div>
        </div>

        {/* 취향 */}
        <div className="acct-section">{t("취향")}</div>
        <div className="acct-row">
          <div>
            <b>{stats?.taste || t("아직 파악되지 않았습니다")}</b>
            <span>
              {stats?.answered
                ? t("문답 {n}개 · 별점 기록이 쌓이면 정교해집니다", { n: stats.answered })
                : t("찾기 · 추천 화면에서 O · X 여덟 문항으로 시작할 수 있습니다")}
            </span>
          </div>
        </div>

        {/* 화면 설정 — 글자 크기는 레이아웃이 깨져 지금은 내보내지 않는다 (lib/features.js) */}
        {FONT_SCALE && (
          <>
            <div className="acct-section">{t("화면")}</div>
            <FontScale />
          </>
        )}

        {/* 이후 로그인이 붙으면 살아나는 자리 */}
        <div className="acct-section">{t("계정")}</div>
        <ul className="acct-list">
          <li><span>{t("만 19세 인증")}</span><em>{t("미인증")}</em></li>
          <li><span>{t("이번 달 스캔")}</span><em>{stats ? t("{n}회 / 무제한", { n: stats.scans }) : "–"}</em></li>
          <li><span>{t("구독")}</span><em>{t("무료")}</em></li>
          <li><span>{t("기기 간 기록 동기화")}</span><em className="soon">{t("로그인 필요")}</em></li>
          <li><span>{t("알림")}</span><em>{t("셀러 화면에서 설정")}</em></li>
        </ul>

        <button className="drawer-link as-btn" onClick={() => { onClose?.(); onOpenCellar?.(); }}>
          {t("나의 셀러로 이동")} <em>›</em>
        </button>
        {/* 이용 안내 — 앱마다 내용이 다르다 (app/guide) */}
        <a className="drawer-link" href="/guide">
          {t("이용 안내")} <em>›</em>
        </a>

        <p className="drawer-note">
          {t("로그인을 붙이면 위 항목이 기기가 아니라 계정에 묶입니다. 지금 쌓는 기록은 그때 계정으로 옮길 수 있도록 남겨 둡니다.")}
        </p>
      </aside>
    </>
  );
}
