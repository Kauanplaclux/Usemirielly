import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {createAPI} from '../lib/api.mjs';
import {hashPassword,verifyPassword} from '../lib/auth.mjs';
import {financials} from '../lib/domain.mjs';
let db,pool,handle,cookie;
const pass=randomBytes(24).toString('base64url');
async function request(path,body,auth=true,method='POST'){
 const headers={};if(auth&&cookie)headers.cookie=cookie;if(body!==undefined)headers['content-type']='application/json';
 return handle(new Request('https://test.local/api/'+path,{method:body===undefined?'GET':method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{ip:'test'});
}
before(async()=>{db=new NetlifyDB({logger:()=>{}});const connectionString=await db.start();await db.applyMigrations('netlify/database/migrations');pool=getDatabase({connectionString}).pool;handle=createAPI(pool,{passwordHash:hashPassword(pass)});const r=await request('login',{password:pass},false);assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];});
after(async()=>{await pool?.end();await db?.stop();});
test('hash rejects incorrect and malformed credentials',()=>{const hash=hashPassword(pass);assert.ok(verifyPassword(pass,hash));assert.equal(verifyPassword('wrong',hash),false);assert.equal(verifyPassword(pass,'invalid'),false);});
test('public catalog contains no purchase costs; private operations need a session',async()=>{const r=await request('catalog',undefined,false);assert.equal(r.status,200);const body=await r.json();assert.ok(body.products.length===8);assert.equal(JSON.stringify(body).includes('cost_cents'),false);assert.equal((await request('admin',undefined,false)).status,401);assert.equal((await request('products',{},false)).status,401);});
test('sale, restock, idempotency, insufficient stock and void preserve history and costs',async()=>{
 const p=(await (await request('admin')).json()).products[0],v=p.variants[0],old=v.stock;assert.ok(old>=1);
 const body={variant_id:v.id,kind:'venda',quantity:1,price_cents:10000,label_cents:50,bag_cents:150,sweet_cents:50,other_cents:0,reserve_percent:20,request_id:randomUUID()};
 assert.equal((await request('movement',body)).status,200);assert.equal((await request('movement',body)).status,200);
 let data=await (await request('admin')).json();assert.equal(data.products.find(x=>x.id===p.id).variants.find(x=>x.id===v.id).stock,old-1);assert.equal(data.sales.length,1);assert.equal(data.sales[0].cost_cents,v.cost_cents);
 assert.equal((await request('movement',{...body,quantity:99999,request_id:randomUUID()})).status,409);
 const newCost=2000;assert.equal((await request('movement',{variant_id:v.id,kind:'entrada',quantity:2,cost_cents:newCost,request_id:randomUUID()})).status,200);
 data=await (await request('admin')).json();const costAfter=Math.round(((old-1)*v.cost_cents+2*newCost)/(old+1));assert.equal(data.products.find(x=>x.id===p.id).variants.find(x=>x.id===v.id).cost_cents,costAfter);assert.equal(data.sales[0].cost_cents,v.cost_cents);
 const saleId=data.sales[0].id;assert.equal((await request('void-sale',{id:saleId})).status,200);assert.equal((await request('void-sale',{id:saleId})).status,409);data=await (await request('admin')).json();assert.equal(data.sales.length,0);assert.equal(data.products.find(x=>x.id===p.id).variants.find(x=>x.id===v.id).stock,old+2);assert.ok(data.movements.some(x=>x.kind==='estorno'));
});
test('parallel sales cannot sell the same last piece twice',async()=>{
 const data=await (await request('admin')).json();const p=data.products.find(x=>x.name==='Vestido Botânica'),v=p.variants.find(x=>x.stock===1);
 const b={variant_id:v.id,kind:'venda',quantity:1,price_cents:p.price_cents,label_cents:0,bag_cents:0,sweet_cents:0,other_cents:0,reserve_percent:20};
 const results=await Promise.all([request('movement',{...b,request_id:randomUUID()}),request('movement',{...b,request_id:randomUUID()})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
});
test('expenses and reinvestment use actual results and cannot reserve a loss',()=>{
 const sales=[{quantity:2,price_cents:10000,cost_cents:5000,label_cents:50,bag_cents:150,sweet_cents:50,other_cents:0,reserve_percent:20}],expenses=[{amount_cents:1000}];
 const m=financials(sales,expenses,[]);assert.equal(m.revenue,20000);assert.equal(m.commercial,10000);assert.equal(m.result,8500);assert.equal(m.reserve,1900);assert.equal(m.available,6600);
 const loss=financials(sales,[{amount_cents:20000}],[]);assert.equal(loss.reserve,0);assert.equal(loss.available,-10500);
});
test('negative quantities, duplicated sizes, non-HTTPS images and foreign origins are rejected',async()=>{
 const data=await (await request('admin')).json(),v=data.products[0].variants[0];assert.equal((await request('movement',{variant_id:v.id,kind:'retirada',quantity:-1,request_id:randomUUID()})).status,400);
 const b={name:'Teste',category:'Blusas',description:'Teste',color:'Branco',price_cents:1000,photo_url:'javascript:alert(1)',variants:[{size:'P',stock:1,cost_cents:500}]};assert.equal((await request('products',b)).status,400);
 b.photo_url='/assets/look-2.webp';b.variants.push({...b.variants[0]});assert.equal((await request('products',b)).status,400);
 const r=await handle(new Request('https://test.local/api/settings',{method:'POST',headers:{'content-type':'application/json','origin':'https://other.local',cookie},body:'{}'}));assert.equal(r.status,403);
});
test('expenses are idempotent and archived items cannot hide existing stock',async()=>{
 const rid=randomUUID(),b={description:'Teste de despesa',category:'Serviços',amount_cents:1000,expense_date:'2026-11-09',request_id:rid};assert.equal((await request('expenses',b)).status,200);assert.equal((await request('expenses',b)).status,200);
 const data=await (await request('admin')).json();assert.equal(data.expenses.filter(x=>x.request_id===rid).length,1);const p=data.products.find(x=>x.variants.some(v=>v.stock>0));assert.equal((await request('products',{id:p.id,archived:true},true,'PATCH')).status,400);
});
test('private export includes archived sales, full history and no session credentials',async()=>{
 assert.equal((await request('export',undefined,false)).status,401);
 const r=await request('export');assert.equal(r.status,200);assert.ok(r.headers.get('content-disposition').includes('attachment'));
 const data=await r.json();assert.equal(data.format,'use-mirielly-backup-v1');assert.ok(data.sales.some(s=>s.voided_at));assert.ok(data.movements.length>20);assert.equal('sessions' in data,false);assert.equal('login_attempts' in data,false);
});
test('uploaded photos are stored once and served identically; oversized images are rejected',async()=>{
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ7cAAAAASUVORK5CYII=','base64');
 const data='data:image/png;base64,'+image.toString('base64');
 assert.equal((await request('images',{data},false)).status,401);
 const uploaded=await request('images',{data});assert.equal(uploaded.status,201);const {url}=await uploaded.json();
 const served=await request(url.replace('/api/',''),undefined,false);assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await served.arrayBuffer()),image);
 assert.equal((await request('images',{data:'data:image/png;base64,'+Buffer.alloc(500001).toString('base64')})).status,413);
});
