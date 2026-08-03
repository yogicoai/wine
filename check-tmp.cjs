const fs=require('fs');const {MongoClient}=require('mongodb');
const g=k=>(fs.readFileSync('.env.local','utf8').match(new RegExp('^'+k+'=(.*)$','m'))||[])[1]?.trim();
(async()=>{const c=new MongoClient(g('MONGODB_URI'));await c.connect();
const col=c.db(g('MONGODB_DB')||'winelens').collection('catalog');

const full=await col.countDocuments({tier:{$ne:'stub'}});
const en=await col.countDocuments({tier:{$ne:'stub'},'i18n.en':{$exists:true}});
const ja=await col.countDocuments({tier:{$ne:'stub'},'i18n.ja':{$exists:true}});
console.log('정식 '+full+' · 영어층 '+en+' · 일본어층 '+ja+' · 남은 '+(full-en));

// 번역해야 할 글자량
const docs=await col.find({tier:{$ne:'stub'},'i18n.en':{$exists:false}},{projection:{result:1}}).limit(300).toArray();
const FIELDS=['tastingNotes','story','winery','pairingTip','avoidPairing','trivia','servingNote','aging','basis'];
let chars=0, listChars=0;
for(const d of docs){
  const r=d.result||{};
  FIELDS.forEach(f=>chars+=String(r[f]||'').length);
  (r.foodPairing||[]).forEach(p=>chars+=String(p.food||'').length+String(p.why||'').length);
  (r.history||[]).forEach(h=>chars+=String(h.event||'').length);
  (r.tips||[]).forEach(t=>chars+=String(t||'').length);
  // 목록 화면에만 쓰이는 짧은 칸
  listChars+=String(r.name||'').length+String(r.type||'').length+String(r.region||'').length;
}
const per=Math.round(chars/docs.length), perList=Math.round(listChars/docs.length);
console.log('한 종당 글자수 — 상세 전체 '+per+'자 / 목록에 쓰는 것만 '+perList+'자');
console.log('남은 '+(full-en)+'종 × 2개 언어 = 상세 '+Math.round(per*(full-en)*2/10000)+'만자 / 목록만 '+Math.round(perList*(full-en)*2/10000)+'만자');

console.log('\n=== 화면에서 본 중복 ===');
const dup=await col.find({name:/사유리/},{projection:{name:1,tier:1,category:1}}).toArray();
dup.forEach(d=>console.log('  '+d.name+'  ['+(d.tier||'full')+'] '+d.category));
await c.close();})();
