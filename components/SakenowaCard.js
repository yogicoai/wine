"use client";
import { t } from "@/lib/i18n";
import { FLAVOR_AXES } from "@/lib/sakenowa";

// 일본 현지의 맛 좌표와 인기 순위 (출처: さけのわ).
//
// 위쪽 "플레이버 시그니처"와 나란히 두는 이유.
// 그것은 AI 가 라벨과 등급을 보고 짐작한 값이고, 이것은 실제로 마신 사람들의
// 평가에서 나온 값이다. 축도 다르다 — 우리는 바디·감칠맛·산도·당도 넷이고
// 저쪽은 화려함·방순함·중후함·온화함·드라이·경쾌함 여섯이다.
// 억지로 하나로 합치면 둘 다 흐려지므로 각각 제 모습으로 둔다.
export default function SakenowaCard({ info }) {
  if (!info?.flavor) return null;
  const f = info.flavor;

  return (
    <div className="card">
      <div className="card-title">{t("일본 현지 평가")}</div>

      {/* 순위는 100위까지만 매겨진다. 그 안에 들면 그것만으로 이야기가 된다. */}
      {info.rank && (
        <div className="sake-rank">
          <b>{t("일본 인기 {n}위", { n: info.rank })}</b>
          <span>{t("사케 애호가 평가 기준")}</span>
        </div>
      )}

      <div className="sake-flavor">
        {FLAVOR_AXES.map((a) => {
          const v = Math.max(0, Math.min(1, Number(f[a.key]) || 0));
          return (
            <div className="sake-axis" key={a.key}>
              <span className="sake-axis-name">{t(a.ko)}</span>
              <span className="sake-axis-bar">
                <i style={{ width: `${Math.round(v * 100)}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      {info.tags?.length > 0 && (
        <div className="sake-tags">
          {info.tags.map((tag, i) => (
            <span className="sake-tag" key={i}>{t(tag)}</span>
          ))}
        </div>
      )}

      <div className="shop-note">
        {/* 남의 자료를 쓰면 어디서 왔는지 밝힌다 */}
        {t("실제로 마신 사람들의 평가에서 뽑은 값입니다 · 출처 さけのわ")}
        {info.brand ? ` · ${info.brand}` : ""}
        {info.brewery ? ` (${info.brewery})` : ""}
      </div>
    </div>
  );
}
