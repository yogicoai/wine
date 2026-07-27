"use client";
import { catOf } from "@/lib/cats";
import Icon from "./Icon";
import CatIcon from "./CatIcon";

export default function HistoryDrawer({ open, sessions, noDb, onClose, onOpenSession, onDelete }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-dim" onClick={onClose} />
      <aside className="drawer">
        <h3>스캔 히스토리</h3>
        {noDb && (
          <p className="drawer-note">
            MONGODB_URI 가 설정되지 않아 히스토리가 저장되지 않습니다. .env.local 을 확인하세요.
          </p>
        )}
        {!sessions.length && !noDb && (
          <div className="drawer-empty">아직 스캔 기록이 없습니다.<br />첫 번째 술을 스캔해 보세요.</div>
        )}
        <a className="drawer-link" href="/guide">
          기능 설명서 보기 <em>›</em>
        </a>

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
                <div className="hist-name">{s.result?.name || "인식 실패"}</div>
                <div className="hist-meta">
                  {cat.label} · {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  {s.demo ? " · 데모" : ""}
                </div>
              </div>
              <span
                className="hist-del"
                role="button"
                title="삭제"
                aria-label="삭제"
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
