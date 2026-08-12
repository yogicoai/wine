"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { placeKind, mapLink, shortAddress, linkLabel, menuSearchUrl } from "@/lib/places";

// 근처에서 이 술을 마시거나 살 수 있는 곳.
//
// 왜 지역을 직접 받는가.
// 네이버 지역검색은 좌표를 받지 않는다. 지역 이름이 질의에 없으면 전국이 섞여
// 나온다. 좌표를 지역 이름으로 바꾸려면 역지오코딩이 따로 필요한데 그것은 다른
// 유료 API다. 위치 권한을 물어 놓고 결국 이름을 되묻는 것보다, 처음부터
// 한 번 적고 기억해 두는 편이 낫다.
//
// 무엇을 말할 수 있는가.
// 지역검색은 가게 이름과 분류만 준다. 그 가게가 이 술을 들여놨는지는 알 수 없다.
// 그래서 "이 술이 있는 곳"이라 하지 않고 "이런 술을 다루는 곳"이라 적는다.

const AREA_KEY = "bl_area";

export default function NearbyPlaces({ category, name }) {
  const [area, setArea] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 한 번 적은 지역은 기억한다. 술을 볼 때마다 다시 적게 하지 않는다.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AREA_KEY) || "";
      setArea(saved);
      setInput(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!area || area.length < 2) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/places?area=${encodeURIComponent(area)}&category=${encodeURIComponent(category || "")}`)
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [area, category]);

  function submit(e) {
    e.preventDefault();
    const v = input.trim();
    if (v.length < 2) return;
    setArea(v);
    try {
      localStorage.setItem(AREA_KEY, v);
    } catch {}
  }

  const drink = data?.places?.drink || [];
  const buy = data?.places?.buy || [];
  // 못 찾은 것과 못 물어본 것은 다르다. 키가 없어 부르지도 못했으면서
  // "그 동네에는 없습니다"라고 하면 거짓말이 된다 — 실제로 그렇게 나갔다.
  const cannotAsk = data?.reason === "키 없음";
  const empty = !loading && area && !cannotAsk && drink.length === 0 && buy.length === 0;

  return (
    <div className="card">
      <div className="card-title">{t("근처에서 마실 수 있는 곳")}</div>

      <form className="area-form" onSubmit={submit}>
        <input
          className="area-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("동네나 역 이름 (예: 성수동, 강남역)")}
          aria-label={t("지역")}
        />
        <button className="btn" type="submit" disabled={input.trim().length < 2}>
          {t("주변 찾기")}
        </button>
      </form>

      {!area && (
        <p className="shop-note">
          {t("지역을 적으면 그 근처 와인바와 와인을 파는 곳을 찾아 드립니다.")}
        </p>
      )}

      {loading && (
        <div className="shop-list">
          {[0, 1, 2].map((i) => (
            <div className="shop-item skel" key={i}>
              <span className="sk-lines">
                <span className="sk sk-line" />
                <span className="sk sk-line short" />
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && drink.length > 0 && (
        <PlaceList label={t(data?.terms?.drinkLabel || "근처 술집")} places={drink} area={area} />
      )}
      {!loading && buy.length > 0 && (
        <PlaceList label={t("가까운 주류 판매점")} places={buy} area={area} />
      )}

      {empty && (
        <p className="shop-note">
          {t("{area} 근처에서는 찾지 못했습니다. 더 넓은 지역 이름으로 다시 찾아보세요.", { area })}
        </p>
      )}

      {!loading && cannotAsk && (
        <p className="shop-note err">
          {t("지금은 주변 가게를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.")}
        </p>
      )}

      {!loading && (drink.length > 0 || buy.length > 0) && (
        <div className="shop-note">
          {/* 재고를 아는 것처럼 보이면 안 된다. 우리가 아는 것은 가게의 분류뿐이다. */}
          {t("가게 분류로 찾은 곳이라 이 와인이 있는지는 가게에 확인해 주세요.")}
        </div>
      )}
    </div>
  );
}

function PlaceList({ label, places, area }) {
  return (
    <>
      <div className="place-label">{label}</div>
      <div className="place-list">
        {places.map((p, i) => (
          // 줄 전체를 <a> 로 감쌀 수 없다 — 안에 링크를 또 넣어야 하는데
          // 링크 안의 링크는 브라우저가 받아 주지 않는다.
          <div className="place-item" key={i}>
            <a className="place-head" href={mapLink(p)} target="_blank" rel="noreferrer">
              <div className="place-main">
                <span className="place-name">{p.name}</span>
                <span className="place-kind">{placeKind(p)}</span>
              </div>
              <span className="place-addr">{shortAddress(p.address)}</span>
            </a>
            <div className="place-links">
              {/* 메뉴는 우리가 받아 올 수 없다. 대신 메뉴가 있는 곳으로 데려다준다. */}
              {p.link && (
                <a href={p.link} target="_blank" rel="noreferrer">{t(linkLabel(p.link))}</a>
              )}
              <a href={menuSearchUrl(p.name, area)} target="_blank" rel="noreferrer">
                {t("메뉴 후기")}
              </a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
