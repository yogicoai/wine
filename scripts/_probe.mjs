// searchAndMatch 안에서 정말 터지는지 본다 — try/catch 를 우회해 직접 부른다.
const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const q = process.argv[2] || "놉 크릭 9년";
const r = await fetch(`${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=20`, { headers: HEAD });
const j = await r.json();
const rows = (j?.results || []).slice(0, 6);
console.log(`검색어: ${q}  —  결과 ${j?.results?.length || 0}개`);
rows.forEach((x) => console.log(`   ${x.name}   ${Number(x.price) ? Number(x.price).toLocaleString() + "원" : ""}`));
process.exit(0);
