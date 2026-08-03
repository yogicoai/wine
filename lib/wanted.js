// 미매칭 수집 — "무엇을 채워야 하는가"를 데이터가 알려 주게 한다.
//
// 지금까지 카탈로그는 짐작으로 채웠다. 유명한 와인을 넣었지만, 실제 메뉴판에는
// 수입사 하우스 와인이 올라온다. 사용자가 찾았는데 우리가 못 준 이름이야말로
// 가장 정확한 "다음에 넣을 목록"이다.
//
// 와인 리스트에서 대조에 실패한 항목, 판독은 됐지만 DB에 없던 라벨이 여기 쌓인다.
import { getDb } from "./mongodb";
import { catalogKey } from "./catalog";
import { APP } from "./appProfile";

/**
 * 못 찾은 이름을 기록한다. 같은 이름은 횟수만 올라간다.
 * @param {Array<{name: string, vintage?: string|null, price?: number|null}>} entries
 * @param {string} source 어디서 놓쳤나 (winelist | label | search)
 */
export async function recordWanted(entries, source = "winelist") {
  const db = await getDb();
  if (!db || !entries?.length) return 0;

  const col = db.collection("wanted");
  let recorded = 0;

  for (const e of entries) {
    const name = String(e?.name || "").trim();
    if (name.length < 3) continue; // 판독 조각은 기록해도 쓸 수 없다

    const key = catalogKey(name, null);
    if (!key || key === "|") continue;

    await col.updateOne(
      { key, app: APP.key },
      {
        $set: { key, app: APP.key, name, lastSeenAt: new Date(), lastSource: source },
        $inc: { count: 1 },
        $addToSet: { sources: source },
        // 메뉴가는 술의 급을 짐작하는 단서가 된다 (시중가의 2~3배 관행)
        ...(e.price ? { $min: { menuPriceLow: e.price }, $max: { menuPriceHigh: e.price } } : {}),
        $setOnInsert: { firstSeenAt: new Date() },
      },
      { upsert: true }
    );
    recorded++;
  }
  return recorded;
}

/** 많이 놓친 순서 — 카탈로그에 다음으로 넣을 목록이 된다 */
export async function listWanted({ limit = 100 } = {}) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .collection("wanted")
    .find({ app: APP.key }, { projection: { _id: 0 } })
    .sort({ count: -1, lastSeenAt: -1 })
    .limit(limit)
    .toArray();
  return rows;
}

/** 카탈로그에 채워 넣은 이름은 목록에서 지운다 */
export async function resolveWanted(names) {
  const db = await getDb();
  if (!db || !names?.length) return 0;
  const keys = names.map((n) => catalogKey(n, null)).filter(Boolean);
  const r = await db.collection("wanted").deleteMany({ key: { $in: keys }, app: APP.key });
  return r.deletedCount;
}
