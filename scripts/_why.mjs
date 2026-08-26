// 왜 안 붙는지 — 색인에서 후보를 찾아 어느 규칙에 걸리는지 본다.
import { getDb } from "../lib/mongodb.js";
const q = process.argv[2] || "틸링";
const db = await getDb();
const rows = await db.collection("dailyshot").find({ name: new RegExp(q) }, { projection: { _id: 0, name: 1, volume: 1, price: 1, low: 1, lowAt: 1, category: 1, subcategory: 1 } }).limit(8).toArray();
rows.forEach((r) => console.log(JSON.stringify(r, null, 0)));
if (!rows.length) console.log("색인에 없음");
process.exit(0);
