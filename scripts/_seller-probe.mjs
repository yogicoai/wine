// 최저가 판매처 응답에 무엇이 들어 있는지 통째로 본다 — 링크를 만들 단서를 찾는다.
const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const itemId = process.argv[2];
const r = await fetch(`${API}/item-sellers/?item_id=${itemId}&service_type=1&ordering=price&page=1&page_size=2`, { headers: HEAD });
const j = await r.json();
console.log("count =", j.count);
console.log(JSON.stringify(j.results?.[0], null, 2).slice(0, 2600));
process.exit(0);
