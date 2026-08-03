const fs=require('fs');const {MongoClient}=require('mongodb');
const g=k=>(fs.readFileSync('.env.local','utf8').match(new RegExp('^'+k+'=(.*)$','m'))||[])[1]?.trim();
(async()=>{const c=new MongoClient(g('MONGODB_URI'));await c.connect();
const col=c.db(g('MONGODB_DB')||'winelens').collection('catalog');
const r=await col.find({category:'sake',tier:{$ne:'stub'},priceBand:null},{projection:{name:1}}).toArray();
r.forEach(d=>console.log(' ',d.name));
await c.close();})();
