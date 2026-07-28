"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

// 내 정보 — 회원가입이 붙기 전의 레이아웃 초안.
//
// 로그인이 아직 없으므로 "이 자리에 무엇이 들어갈지"를 먼저 세워 둔다.
// 지금 보여 줄 수 있는 값(스캔 수·셀러·취향)은 실제 데이터로 채우고,
// 로그인이 있어야 가능한 것은 준비 중으로 표시한다.
// 이렇게 해 두면 인증만 붙이면 화면은 그대로 살아난다.
export default function AccountDrawer({ open, onClose, onOpenCellar, onToast }) {
  const [stats, setStats] = useState(null);

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

  const soon = () => onToast?.("로그인 기능은 준비 중입니다.");

  return (
    <>
      <div className="drawer-dim" onClick={onClose} />
      <aside className="drawer">
        <h3>내 정보</h3>

        {/* 로그인 전 — 자리만 잡아 둔다 */}
        <div className="acct-card">
          <div className="acct-avatar">
            <Icon name="user" size={26} stroke={1.2} />
          </div>
          <div className="acct-who">
            <b>로그인하지 않음</b>
            <span>지금 기록은 이 기기에만 저장됩니다</span>
          </div>
        </div>

        <div className="acct-auth">
          <button className="btn primary" onClick={soon}>카카오로 시작하기</button>
          <button className="btn" onClick={soon}>네이버로 시작하기</button>
        </div>
        <p className="drawer-note">
          주류 서비스는 만 19세 이상 확인이 필요합니다. 소셜 로그인의 생년월일로 1차 확인 후,
          정식 서비스에서는 본인인증을 연동할 예정입니다.
        </p>

        {/* 활동 — 지금도 보여 줄 수 있는 값 */}
        <div className="acct-section">활동</div>
        <div className="acct-stats">
          <div><b>{stats ? stats.scans : "–"}</b><span>스캔</span></div>
          <div><b>{stats ? stats.have : "–"}</b><span>보유 병</span></div>
          <div><b>{stats ? stats.drunk : "–"}</b><span>마신 술</span></div>
          <div><b>{stats ? stats.notes : "–"}</b><span>노트</span></div>
        </div>

        {/* 취향 */}
        <div className="acct-section">취향</div>
        <div className="acct-row">
          <div>
            <b>{stats?.taste || "아직 파악되지 않았습니다"}</b>
            <span>
              {stats?.answered
                ? `문답 ${stats.answered}개 · 별점 기록이 쌓이면 정교해집니다`
                : "찾기 · 추천 화면에서 O · X 여덟 문항으로 시작할 수 있습니다"}
            </span>
          </div>
        </div>

        {/* 이후 로그인이 붙으면 살아나는 자리 */}
        <div className="acct-section">계정</div>
        <ul className="acct-list">
          <li><span>만 19세 인증</span><em>미인증</em></li>
          <li><span>이번 달 스캔</span><em>{stats ? `${stats.scans}회 / 무제한` : "–"}</em></li>
          <li><span>구독</span><em>무료</em></li>
          <li><span>기기 간 기록 동기화</span><em className="soon">로그인 필요</em></li>
          <li><span>알림</span><em>셀러 화면에서 설정</em></li>
        </ul>

        <button className="drawer-link as-btn" onClick={() => { onClose?.(); onOpenCellar?.(); }}>
          나의 셀러로 이동 <em>›</em>
        </button>
        <a className="drawer-link" href="/guide">
          기능 설명서 보기 <em>›</em>
        </a>

        <p className="drawer-note">
          로그인을 붙이면 위 항목이 기기가 아니라 계정에 묶입니다. 지금 쌓는 기록은 그때 계정으로
          옮길 수 있도록 남겨 둡니다.
        </p>
      </aside>
    </>
  );
}
