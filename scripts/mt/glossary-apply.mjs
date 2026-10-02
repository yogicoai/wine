// 용어집 번역 — 기계번역이나 모델 없이, 사람이 쓴 용어집(scripts/mt/glossary-*.tsv)과 정해진 틀로만 영어·일본어 번역층을 만든다.
//
//   node --env-file=.env.local scripts/mt/glossary-apply.mjs            보기만
//   node --env-file=.env.local scripts/mt/glossary-apply.mjs --apply    DB 에 적기
//
// 대상
//  · 판매처 구조화 정보로 채운 와인(enrichedBy == dailyshot-structured): type · region · specs(품종·용량·평점) · tastingNotes · pairingTip · basis
//  · 모든 문서의 country (나라 이름 지도)
// 용어집에 없는 낱말이 하나라도 있으면 그 필드는 넣지 않는다 — 한국어 원문으로 남는다 (틀린 번역보다 낫다). 빠진 용어는 목록으로 낸다.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const ENGINE = "glossary-v1";
const rd = (p) => readFileSync(p, "utf8").split("\n").filter((l) => l.trim());

const G = { desc: new Map(), food: new Map(), grape: new Map(), region: new Map(), type: new Map(), label: new Map(), country: new Map() };
for (const l of rd("scripts/mt/glossary-wine-desc.tsv")) { const [ko, en, ja] = l.split("\t"); G.desc.set(ko, { en, ja }); }
for (const l of rd("scripts/mt/glossary-wine-misc.tsv")) { const [k, ko, en, ja] = l.split("\t"); G[k].set(ko, { en, ja }); }
// 나라 이름
const COUNTRY = `프랑스 France フランス|이탈리아 Italy イタリア|스페인 Spain スペイン|미국 United States アメリカ|칠레 Chile チリ|아르헨티나 Argentina アルゼンチン|호주 Australia オーストラリア|오스트레일리아 Australia オーストラリア|뉴질랜드 New Zealand ニュージーランド|독일 Germany ドイツ|포르투갈 Portugal ポルトガル|남아프리카공화국 South Africa 南アフリカ|남아공 South Africa 南アフリカ|오스트리아 Austria オーストリア|대한민국 South Korea 韓国|한국 South Korea 韓国|일본 Japan 日本|캐나다 Canada カナダ|헝가리 Hungary ハンガリー|루마니아 Romania ルーマニア|몰도바 Moldova モルドバ|그리스 Greece ギリシャ|슬로베니아 Slovenia スロベニア|중국 China 中国|대만 Taiwan 台湾|영국 United Kingdom イギリス|스코틀랜드 Scotland スコットランド|아일랜드 Ireland アイルランド|스위스 Switzerland スイス|우루과이 Uruguay ウルグアイ|조지아 Georgia ジョージア|레바논 Lebanon レバノン|이스라엘 Israel イスラエル|크로아티아 Croatia クロアチア|불가리아 Bulgaria ブルガリア|멕시코 Mexico メキシコ|쿠바 Cuba キューバ|자메이카 Jamaica ジャマイカ|바베이도스 Barbados バルバドス|과테말라 Guatemala グアテマラ|파나마 Panama パナマ|베네수엘라 Venezuela ベネズエラ|브라질 Brazil ブラジル|페루 Peru ペルー|콜롬비아 Colombia コロンビア|도미니카공화국 Dominican Republic ドミニカ共和国|네덜란드 Netherlands オランダ|벨기에 Belgium ベルギー|덴마크 Denmark デンマーク|스웨덴 Sweden スウェーデン|노르웨이 Norway ノルウェー|핀란드 Finland フィンランド|폴란드 Poland ポーランド|체코 Czech Republic チェコ|러시아 Russia ロシア|태국 Thailand タイ|베트남 Vietnam ベトナム|인도 India インド|필리핀 Philippines フィリピン|인도네시아 Indonesia インドネシア|터키 Turkey トルコ|튀르키예 Türkiye トルコ|모로코 Morocco モロッコ|레위니옹 Réunion レユニオン|마르티니크 Martinique マルティニーク|스리랑카 Sri Lanka スリランカ|가이아나 Guyana ガイアナ|모리셔스 Mauritius モーリシャス|푸에르토리코 Puerto Rico プエルトリコ|리투아니아 Lithuania リトアニア|라오스 Laos ラオス|트리니다드토바고 Trinidad and Tobago トリニダード・トバゴ`;
for (const e of COUNTRY.split("|")) { const [ko, ...r] = e.split(" "); const ja = r.pop(); G.country.set(ko, { en: r.join(" "), ja }); }
// 이름에 공백이 있는 나라와 영문 표기
for (const [ko, en, ja] of [["남아프리카 공화국", "South Africa", "南アフリカ"], ["트리니다드 토바고", "Trinidad and Tobago", "トリニダード・トバゴ"], ["싱가포르", "Singapore", "シンガポール"], ["니카라과", "Nicaragua", "ニカラグア"], ["South Korea", "South Korea", "韓国"]]) G.country.set(ko, { en, ja });

const missing = new Map();   // 빠진 용어 → 횟수 (종류별)
const miss = (kind, term) => { const k = `${kind}:${term}`; missing.set(k, (missing.get(k) || 0) + 1); };
const peek = (kind, term, lang) => G[kind].get(term.trim())?.[lang] ?? null;
const get = (kind, term, lang) => { const g = G[kind].get(term.trim()); if (!g) { miss(kind, term.trim()); return null; } return g[lang]; };
const SEP = { en: ", ", ja: "、" };
const COLON = { en: ": ", ja: "：" };

// 목록 한 줄 "A, B(100%)" → 번역 (품종·시음 단어·음식)
function list(str, kind, lang, { pct = false } = {}) {
  const out = [];
  for (let raw of String(str).split(",")) {
    raw = raw.trim(); if (!raw) continue;
    let suffix = "";
    if (pct) { const m = /^(.*?)\s*\((\d+%)\)$/.exec(raw); if (m) { raw = m[1]; suffix = ` (${m[2]})`; } }
    let t = peek(kind, raw, lang);
    if (t == null && kind === "grape") t = peek("type", raw, lang);   // 포도 목록에 종류 이름이 섞이는 경우
    if (t == null) { miss(kind, raw); return null; }
    out.push(t + suffix);
  }
  return out.length ? out.join(SEP[lang]) : null;
}
const parts = (s, kind, lang) => { const o = []; for (const p of String(s).split(/\s*·\s*/)) { let t = peek(kind, p, lang); if (t == null && kind === "type") t = peek("grape", p, lang); if (t == null) { miss(kind, p); return null; } o.push(t); } return o.join(" · "); };

function translateField(f, v, lang) {
  if (f === "country") return typeof v === "string" ? get("country", v, lang) : null;
  if (f === "type") return typeof v === "string" ? parts(v, "type", lang) : null;
  if (f === "region") return typeof v === "string" ? (G.region.has(v.trim()) ? get("region", v, lang) : parts(v, "region", lang)) : null;
  if (f === "tastingNotes") {
    if (typeof v !== "string") return null;
    const secs = [];
    for (const sec of v.split(" / ")) {
      const m = /^(향|맛|여운):\s*(.+)$/.exec(sec.trim()); if (!m) return null;
      const lab = get("label", m[1], lang), body = list(m[2], "desc", lang); if (lab == null || body == null) return null;
      secs.push(`${lab}${COLON[lang]}${body}`);
    }
    return secs.join(" / ");
  }
  if (f === "pairingTip") {
    const m = typeof v === "string" && /^판매처가 추천하는 음식:\s*(.+)$/.exec(v); if (!m) return null;
    const body = list(m[1], "food", lang); if (body == null) return null;
    return lang === "en" ? `Foods the retailer recommends: ${body}` : `販売店のおすすめ料理：${body}`;
  }
  if (f === "basis") {
    if (v !== "판매처(데일리샷)의 구조화 정보 기준이며 웹 조사로 따로 확인하지는 않았습니다.") return null;
    return lang === "en" ? "Based on the retailer's (Dailyshot) structured product data; not separately verified through web research." : "販売店（Dailyshot）の構造化された商品情報に基づくもので、ウェブ調査による個別の確認は行っていません。";
  }
  if (f === "specs") {
    if (!Array.isArray(v)) return null;
    const out = [];
    for (const it of v) {
      const label = get("label", it.label ?? "", lang); if (label == null) return null;
      let value = it.value;
      if (it.label === "품종") value = list(it.value, "grape", lang, { pct: true });
      else if (it.label === "Vivino 평점") {
        const m = /^([\d.]+) \(평가 ([\d,]+)건(?:, (\d{4}-\d{2}) 기준)?\)$/.exec(it.value); if (!m) return null;
        value = lang === "en" ? `${m[1]} (${m[2]} ratings${m[3] ? `, as of ${m[3]}` : ""})` : `${m[1]}（評価${m[2]}件${m[3] ? `、${m[3]}時点` : ""}）`;
      } else if (it.label === "용량") value = String(it.value);
      else return null;
      if (value == null) return null;
      out.push({ ...it, label, value });
    }
    return out;
  }
  return null;
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const col = client.db(process.env.MONGODB_DB || "winelens").collection("catalog");
const docs = await col.find({ notDrink: { $ne: true }, dupeOf: { $in: [null, ""] }, result: { $exists: true } }, { projection: { name: 1, result: 1, i18n: 1, enrichedBy: 1 } }).toArray();

const WINE_FIELDS = ["type", "region", "specs", "tastingNotes", "pairingTip", "basis"];
const ops = [], per = { en: {}, ja: {} }, samples = [];
for (const d of docs) {
  const fields = d.enrichedBy === "dailyshot-structured" ? [...WINE_FIELDS, "country"] : ["country"];
  const set = {}, done = { en: [], ja: [] };
  for (const lang of ["en", "ja"]) for (const f of fields) {
    const v = d.result?.[f]; if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (d.i18n?.[lang]?.[f] != null) continue;
    const t = translateField(f, v, lang);
    if (t == null) continue;
    set[`i18n.${lang}.${f}`] = t; done[lang].push(f); per[lang][f] = (per[lang][f] || 0) + 1;
  }
  if (!Object.keys(set).length) continue;
  const upd = { $set: { ...set } };
  for (const lang of ["en", "ja"]) if (done[lang].length) { upd.$set[`i18nMeta.${lang}.engine`] = ENGINE; upd.$set[`i18nMeta.${lang}.at`] = new Date(); (upd.$addToSet ||= {})[`i18nMeta.${lang}.fields`] = { $each: done[lang] }; }
  ops.push({ updateOne: { filter: { _id: d._id }, update: upd } });
  if (samples.length < 2 && d.enrichedBy === "dailyshot-structured" && done.en.length >= 4) samples.push({ name: d.name, set });
}
console.log(`문서 ${docs.length}개 중 번역층을 채울 문서 ${ops.length}개`);
console.log("영어 필드:", JSON.stringify(per.en)); console.log("일본어 필드:", JSON.stringify(per.ja));
const ms = [...missing].sort((a, b) => b[1] - a[1]);
console.log(`\n용어집에 없어 건너뛴 용어 ${ms.length}종 (많이 나온 순):`);
console.log(ms.slice(0, 40).map(([k, n]) => `${k}(${n})`).join(" | "));
for (const s of samples) { console.log(`\n■ ${s.name}`); for (const [k, v] of Object.entries(s.set)) console.log(`   ${k}: ${JSON.stringify(v).slice(0, 190)}`); }
if (APPLY && ops.length) { const r = await col.bulkWrite(ops, { ordered: false }); console.log(`\n적었습니다 — ${r.modifiedCount}종`); }
else if (!APPLY) console.log("\n보기만 했습니다. 적으려면 --apply");
await client.close();
process.exit(0);
