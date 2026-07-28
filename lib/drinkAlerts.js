// 음용 적기 알림 — "사두고 잊어버린 술"을 제때 꺼내게 해 준다.
//
// 셀러에 담아 둔 술의 음용 적기는 이미 계산해서 화면에 보여 주고 있다.
// 다만 사용자가 셀러를 열어 봐야만 알 수 있었다. 여기서는 반대로 우리가 먼저 알린다.
// 판정은 순수 계산이고 DB만 읽으므로 비용은 들지 않는다.
import { getDb } from "./mongodb";
import { drinkWindowState } from "./cellar";

// 알릴 상태와 문구 (마시기 좋음/아직 이름 은 굳이 알리지 않는다)
const NOTIFY = {
  peak: (it) => `${it.name} — 지금이 가장 좋을 때입니다`,
  soon: (it) => `${it.name} — 적기가 곧 끝납니다`,
  past: (it) => `${it.name} — 권장 음용 시기를 지났습니다`,
};

/**
 * 알려야 할 항목을 찾는다. 같은 술을 같은 해에 같은 이유로 두 번 알리지 않는다.
 * @param {{ max?: number }} opts
 */
export async function checkDrinkWindows({ max = 5 } = {}) {
  const db = await getDb();
  if (!db) return { items: [], checked: 0, skipped: "noDb" };

  const year = new Date().getFullYear();
  const owned = await db
    .collection("cellar")
    .find(
      { status: "have", bottles: { $gt: 0 } },
      { projection: { name: 1, bottles: 1, drinkFrom: 1, drinkPeak: 1, drinkUntil: 1 } }
    )
    .limit(500)
    .toArray();

  const notices = db.collection("drink_notices");
  const due = [];

  for (const it of owned) {
    const state = drinkWindowState(it, year);
    if (!state || !NOTIFY[state.key]) continue;

    const noticeKey = `${it._id}:${state.key}:${year}`;
    // 이미 올해 같은 이유로 알렸으면 넘어간다
    const inserted = await notices.updateOne(
      { noticeKey },
      { $setOnInsert: { noticeKey, cellarId: it._id.toString(), state: state.key, year, notifiedAt: new Date() } },
      { upsert: true }
    );
    if (!inserted.upsertedCount) continue;

    due.push({ id: it._id.toString(), name: it.name, bottles: it.bottles, state: state.key, text: NOTIFY[state.key](it) });
    if (due.length >= max) break;
  }

  // 피크 → 마감 임박 → 지남 순으로 보여 주는 게 자연스럽다
  const order = { peak: 0, soon: 1, past: 2 };
  due.sort((a, b) => order[a.state] - order[b.state]);

  return { items: due, checked: owned.length };
}

/** 알림 문구 — 여러 건이면 대표 한 병만 쓰고 나머지는 수로 줄인다 */
export function drinkPayload(items) {
  if (!items.length) return null;
  const [top] = items;
  const more = items.length - 1;

  return {
    title: top.state === "peak" ? "지금 열기 좋은 술이 있습니다" : "셀러를 확인해 주세요",
    body: top.text + (more > 0 ? ` 외 ${more}병` : ""),
    url: "/?cellar=1",
    tag: "drink-window",
  };
}
