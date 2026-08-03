"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";

// 주종별 향 태그 — 직접 타이핑 없이 탭으로 기록할 수 있게
const AROMAS = {
  wine: ["블랙베리", "체리", "자두", "제비꽃", "삼나무", "바닐라", "가죽", "흙", "후추", "감초"],
  whisky: ["피트", "훈연", "꿀", "바닐라", "말린과일", "오크", "시트러스", "카라멜", "요오드", "스파이스"],
  sake: ["멜론", "배", "쌀", "바나나", "흰꽃", "감칠맛", "미네랄", "요구르트"],
  beer: ["홉", "시트러스", "솔", "몰트", "카라멜", "커피", "바나나", "정향"],
  default: ["과일", "꽃", "허브", "곡물", "오크", "스파이스", "달콤", "훈연"],
};

export default function TastingNote({ category, onSave, onCancel, saving }) {
  const [rating, setRating] = useState(0);
  const [aroma, setAroma] = useState([]);
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [consumed, setConsumed] = useState(true);

  const tags = AROMAS[category] || AROMAS.default;

  function toggle(a) {
    setAroma((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a].slice(0, 8)));
  }

  return (
    <div className="note-form">
      <div className="note-row">
        <label>{t("마신 날")}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="note-row">
        <label>{t("내 평점")}</label>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star ${rating >= n ? "on" : ""}`}
              onClick={() => setRating(n === rating ? 0 : n)}
              aria-label={t("{n}점", { n })}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="note-block">
        <label>{t("내가 느낀 향·맛")}</label>
        <div className="chip-row">
          {tags.map((a) => (
            <button
              key={a}
              className={`chip chip-btn ${aroma.includes(a) ? "chip-on" : ""}`}
              onClick={() => toggle(a)}
            >
              {t(a)}
            </button>
          ))}
        </div>
      </div>

      <div className="note-block">
        <label>{t("메모")}</label>
        <textarea
          rows={3}
          value={text}
          placeholder={t("누구와, 어떤 자리에서, 어땠는지 남겨보세요.")}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <label className="note-check">
        <input type="checkbox" checked={consumed} onChange={(e) => setConsumed(e.target.checked)} />
        {t("보유 재고에서 1병 차감")}
      </label>

      <div className="result-actions">
        <button className="btn" onClick={onCancel} disabled={saving}>{t("취소")}</button>
        <button
          className="btn primary"
          disabled={saving}
          onClick={() => onSave({ date, rating, aroma, text, consumed })}
        >
          {saving ? t("저장 중…") : t("기록 저장")}
        </button>
      </div>
    </div>
  );
}
