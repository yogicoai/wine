"use client";
import { useEffect, useState } from "react";
import { renderShareCard } from "@/lib/shareCard";
import { t } from "@/lib/i18n";

// 결과를 이미지 한 장으로 만들어 공유한다.
// 휴대폰에서는 기본 공유 시트(카톡·인스타·메시지)가 열리고, PC에서는 파일로 저장된다.
export default function ShareCard({ result, thumb, onToast }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ url: null, blob: null, error: null });

  // 미리보기용 URL은 닫을 때 정리한다
  useEffect(() => {
    return () => {
      if (state.url) URL.revokeObjectURL(state.url);
    };
  }, [state.url]);

  async function build() {
    setOpen(true);
    setState({ url: null, blob: null, error: null });
    try {
      const blob = await renderShareCard(result, thumb);
      if (!blob) throw new Error(t("이미지를 만들지 못했습니다."));
      setState({ url: URL.createObjectURL(blob), blob, error: null });
    } catch {
      setState({ url: null, blob: null, error: t("이미지를 만들지 못했습니다.") });
    }
  }

  function filename() {
    const safe = String(result.name || "bottle").replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
    return `${safe}.png`;
  }

  async function share() {
    if (!state.blob) return;
    const file = new File([state.blob], filename(), { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: result.name });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // 사용자가 취소한 것은 오류가 아니다
      }
    }
    download();
  }

  function download() {
    if (!state.url) return;
    const a = document.createElement("a");
    a.href = state.url;
    a.download = filename();
    a.click();
    onToast?.(t("이미지를 저장했습니다."));
  }

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <>
      <button className="btn" onClick={build}>
        {t("이미지로 공유")}
      </button>

      {open && (
        <>
          <div className="drawer-dim" onClick={() => setOpen(false)} />
          <div className="share-modal" role="dialog" aria-label={t("공유 카드 미리보기")}>
            <div className="share-head">
              <b>{t("공유 카드")}</b>
              <button className="share-x" aria-label={t("닫기")} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div className="share-preview">
              {state.error ? (
                <div className="share-msg err">{state.error}</div>
              ) : state.url ? (
                <img src={state.url} alt={t("{name} 공유 카드", { name: result.name })} />
              ) : (
                <div className="share-msg">{t("카드를 만드는 중…")}</div>
              )}
            </div>

            <div className="share-actions">
              <button className="btn" onClick={download} disabled={!state.url}>
                {t("저장")}
              </button>
              <button className="btn primary" onClick={share} disabled={!state.url}>
                {canShareFiles ? t("공유하기") : t("이미지 내려받기")}
              </button>
            </div>
            <div className="shop-note" style={{ textAlign: "center" }}>
              {t("인스타그램 · 카카오톡에 그대로 올릴 수 있는 1080×1350 이미지입니다.")}
            </div>
          </div>
        </>
      )}
    </>
  );
}
