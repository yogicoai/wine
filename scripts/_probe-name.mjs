// 이름 몇 개를 데일리샷에 물어 뭐라고 부르는지 본다. 없는 건지, 표기가 다른 건지 가른다.
//   node scripts/_probe-name.mjs "이름1" "이름2" ...
const API = "https://api.dailyshot.co";
const HEAD = { "dailyshot-web": "1", "encrypted-web": "1" };
const SKIP = /세트|패키지|기획|잔|바이알|\d+종|\d+개/;

for (const n of process.argv.slice(2)) {
  const toks = n.split(/\s+/).filter(Boolean);
  // 생산자 자리만 남기려고 앞 두 낱말, 그다음 한 낱말로 줄여 본다
  const tries = [...new Set([toks.slice(0, 2).join(" "), toks[0]])].filter(Boolean);
  console.log(`▸ ${n}`);
  let shown = false;
  for (const q of tries) {
    try {
      const r = await fetch(`${API}/items/search/?q=${encodeURIComponent(q)}&page=1&page_size=6`, { headers: HEAD });
      const hits = ((await r.json())?.results || []).filter((x) => !SKIP.test(x.name)).slice(0, 3);
      if (hits.length) {
        console.log(`   [${q}]`);
        hits.forEach((x) => console.log(`      ${x.name}   ${Number(x.price).toLocaleString()}원`));
        shown = true;
        break;
      }
    } catch {}
    await new Promise((s) => setTimeout(s, 200));
  }
  if (!shown) console.log("   데일리샷에 그 이름으로 파는 것이 없음");
  await new Promise((s) => setTimeout(s, 250));
}
process.exit(0);
