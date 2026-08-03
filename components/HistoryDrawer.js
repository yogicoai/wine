"use client";
import { catOf } from "@/lib/cats";
import Icon from "./Icon";
import CatIcon from "./CatIcon";
import { t } from "@/lib/i18n";

export default function HistoryDrawer({ open, sessions, noDb, onClose, onOpenSession, onDelete }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-dim" onClick={onClose} />
      <aside className="drawer">
        {/* 배경을 눌러도 닫히지만, 한 손으로 쓰는 모바일에서는 눌러야 할 곳이 보여야 한다 */}
        <button className="drawer-close" onClick={onClose} aria-label={t("닫기")}>
          <Icon name="close" size={16} />
        </button>
        <h3>{t("스캔 히스토리")}</h3>
        {noDb && (
          <p className="drawer-note">
            {t("MONGODB_URI 가 설정되지 않아 히스토리가 저장되지 않습니다. .env.local 을 확인하세요.")}
          </p>
        )}
        {!sessions.length && !noDb && (
          <div className="empty-state">
            <img src="/icons/cat/wine.png" alt="" />
            <b>{t("아직 스캔 기록이 없습니다")}</b>
            <span>{t("첫 번째 술을 찍어 보세요.")}</span>
          </div>
        )}
        {sessions.map((s) => {
          const cat = catOf(s.result?.category);
          return (
            <button key={s._id} className="hist-item" onClick={() => onOpenSession(s._id)}>
              {s.thumb ? (
                <img className="hist-thumb" src={s.thumb} alt="" />
              ) : (
                <div className="hist-thumb">
                  <CatIcon category={s.result?.category} size={26} />
                </div>
              )}
              <div>
                <div className="hist-name">{s.result?.name || t("인식 실패")}</div>
                <div className="hist-meta">
                  {t(cat.label)} · {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  {s.demo ? ` · ${t("데모")}` : ""}
                </div>
              </div>
              <span
                className="hist-del"
                role="button"
                title={t("삭제")}
                aria-label={t("삭제")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s._id);
                }}
              >
                <Icon name="close" size={15} />
              </span>
            </button>
          );
        })}
      </aside>
    </>
  );
}
