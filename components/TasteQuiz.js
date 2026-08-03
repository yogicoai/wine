"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

// 취향 문답 — 여덟 개를 O / X 로만 묻는다.
// 슬라이더나 다중 선택은 정확하지만 아무도 끝까지 하지 않는다.
export default function TasteQuiz({ onDone, onToast }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setQuestions(d.questions || []);
        if (d.answers) setAnswers(d.answers); // 다시 할 때는 지난 답을 채워 둔다
      })
      .catch(() => onToast?.(t("문항을 불러오지 못했습니다."), true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!questions.length) {
    return <div className="quiz-card"><div className="shop-note">{t("불러오는 중…")}</div></div>;
  }

  const q = questions[step];
  const last = step === questions.length - 1;

  function answer(pick) {
    const next = { ...answers, [q.id]: pick };
    setAnswers(next);
    if (last) save(next);
    else setStep(step + 1);
  }

  function skip() {
    const next = { ...answers };
    delete next[q.id];
    setAnswers(next);
    if (last) save(next);
    else setStep(step + 1);
  }

  async function save(finalAnswers) {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const d = await res.json();
      if (d.noDb) return onToast?.(t("취향을 저장할 수 없습니다 (DB 미설정)."), true);
      onDone?.(d);
    } catch {
      onToast?.(t("취향을 저장하지 못했습니다."), true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="quiz-card">
      <div className="quiz-progress">
        {questions.map((_, i) => (
          <i key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>

      <div className="quiz-step">
        {step + 1} / {questions.length}
      </div>

      <h3 className="quiz-q">{t(q.text)}</h3>
      {q.hint && <p className="quiz-hint">{t(q.hint)}</p>}

      <div className="quiz-ox">
        <button
          className={`ox ox-o ${answers[q.id] === "yes" ? "on" : ""}`}
          onClick={() => answer("yes")}
          disabled={saving}
          aria-label={t("그렇다")}
        >
          <span>O</span>
          {t("그렇다")}
        </button>
        <button
          className={`ox ox-x ${answers[q.id] === "no" ? "on" : ""}`}
          onClick={() => answer("no")}
          disabled={saving}
          aria-label={t("아니다")}
        >
          <span>✕</span>
          {t("아니다")}
        </button>
      </div>

      <div className="quiz-foot">
        {step > 0 && (
          <button className="mini-btn" onClick={() => setStep(step - 1)} disabled={saving}>
            {t("이전")}
          </button>
        )}
        <button className="mini-btn" onClick={skip} disabled={saving}>
          {saving ? t("저장 중…") : last ? t("모르겠어요 · 완료") : t("모르겠어요")}
        </button>
      </div>
    </div>
  );
}
