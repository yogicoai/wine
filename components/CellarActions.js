"use client";
import { useState } from "react";
import TastingNote from "./TastingNote";

// 결과 화면 → 셀러에 담기 / 위시리스트 / 마신 기록 남기기
export default function CellarActions({ result, thumb, onToast, onChanged }) {
  const [saved, setSaved] = useState(null); // { id, status }
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  async function add(status) {
    setBusy(true);
    try {
      const res = await fetch("/api/cellar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, thumb, status }),
      });
      const d = await res.json();
      if (d.noDb) return onToast?.("MongoDB가 연결되지 않아 저장할 수 없습니다.", true);
      setSaved({ id: d.id, status });
      onChanged?.();
      onToast?.(
        status === "wish"
          ? "위시리스트에 담았습니다."
          : d.merged
            ? `보유 ${d.bottles}병으로 늘렸습니다.`
            : "셀러에 담았습니다."
      );
      return d.id;
    } catch {
      onToast?.("저장에 실패했습니다.", true);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(note) {
    setBusy(true);
    try {
      // 셀러에 없으면 먼저 담고 기록
      const id = saved?.id || (await add("have"));
      if (!id) return;
      const res = await fetch(`/api/cellar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const d = await res.json();
      if (!d.saved) throw new Error();
      setNoteOpen(false);
      onChanged?.();
      onToast?.("테이스팅 노트를 기록했습니다.");
    } catch {
      onToast?.("기록에 실패했습니다.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">나의 셀러</div>

      {noteOpen ? (
        <TastingNote
          category={result.category}
          saving={busy}
          onCancel={() => setNoteOpen(false)}
          onSave={saveNote}
        />
      ) : (
        <>
          <div className="cellar-actions">
            <button className="cellar-btn" disabled={busy} onClick={() => add("have")}>
              <b>🍾</b>
              <span>보유 중</span>
              <em>셀러에 담기</em>
            </button>
            <button className="cellar-btn" disabled={busy} onClick={() => add("wish")}>
              <b>☆</b>
              <span>위시리스트</span>
              <em>특가 알림 받기</em>
            </button>
            <button className="cellar-btn" disabled={busy} onClick={() => setNoteOpen(true)}>
              <b>✎</b>
              <span>마셨어요</span>
              <em>테이스팅 노트</em>
            </button>
          </div>
          {saved && (
            <div className="shop-note">
              셀러에 저장됨 · 상단 🍷 아이콘에서 확인하고 목표가를 설정할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
