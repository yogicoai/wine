// 최저가부터 여러 판매처를 나란히 본다 — 품절이 섞여 있는지 확인한다.
const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const itemId = process.argv[2];
const r = await fetch(`${API}/item-sellers/?item_id=${itemId}&service_type=1&ordering=price&page=1&page_size=12`, { headers: HEAD });
const j = await r.json();
console.log(`파는 곳 ${j.count}곳 — 값이 싼 순서로 열둘`);
(j.results || []).forEach((x, i) => {
  const p = Number(x.item?.price) || 0;
  const 도착 = x.seller?.expected_arrival_date || "";
  console.log(`${String(i + 1).padStart(2)}. ${String(p.toLocaleString()).padStart(9)}원  ${도착.padEnd(10)} ${x.seller?.name || ""} (${x.seller?.region || ""})`);
});
process.exit(0);
