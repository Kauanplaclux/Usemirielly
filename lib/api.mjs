import {randomUUID} from 'node:crypto';
import {AppError,integer,text,imageUrl,validateProduct,financials} from './domain.mjs';
import {verifyPassword,digest,newToken,sessionToken,cookie} from './auth.mjs';
const uuid=v=>{if(typeof v!=='string'||!/^[a-f0-9-]{36}$/i.test(v))throw new AppError('Identificador inválido.');return v;};
const response=(body,status=200,headers={})=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
export function createAPI(pool,{passwordHash,local=false}={}) {
 async function query(sql,params=[]){return (await pool.query(sql,params)).rows;}
 async function transaction(fn) {const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function products(admin=false){
  const rows=await query(`SELECT p.*, COALESCE(json_agg(json_build_object('id',v.id,'size',v.size,'stock',v.stock${admin?",'cost_cents',v.cost_cents":''}) ORDER BY CASE UPPER(v.size) WHEN 'PP' THEN 1 WHEN 'P' THEN 2 WHEN 'M' THEN 3 WHEN 'G' THEN 4 WHEN 'GG' THEN 5 WHEN 'XG' THEN 6 ELSE 7 END,v.size) FILTER(WHERE v.id IS NOT NULL),'[]') AS variants FROM products p LEFT JOIN variants v ON v.product_id=p.id ${admin?'':'WHERE p.archived=FALSE'} GROUP BY p.id ORDER BY p.created_at,p.id`);
  return rows.map(p=>admin?p:({id:p.id,name:p.name,category:p.category,description:p.description,color:p.color,price_cents:p.price_cents,photo_url:p.photo_url,demo:p.demo,variants:p.variants}));
 }
 async function authenticated(req){const token=sessionToken(req);if(!/^[a-f0-9]{64}$/.test(token))return false;return (await query('SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>NOW()',[digest(token)])).length>0;}
 return async function handle(req,context={}) {
  try {
   const url=new URL(req.url);const path=url.pathname.replace(/^\/\.netlify\/functions\/api/,'/api').replace(/\/$/,'');
   if(!['GET','POST','PATCH'].includes(req.method))return response({error:'Método não permitido.'},405);
   if(req.method!=='GET'){
    const origin=req.headers.get('origin'); if(origin && origin!==url.origin)throw new AppError('Origem não permitida.',403);
    if(!req.headers.get('content-type')?.startsWith('application/json'))throw new AppError('Formato inválido.',415);
    if(Number(req.headers.get('content-length')||0)>800000)throw new AppError('Arquivo muito grande.',413);
   }
   if(path==='/api/catalog'&&req.method==='GET')return response({products:await products()});
   if(path.startsWith('/api/image/')&&req.method==='GET'){
    const [img]=await query('SELECT content,mime FROM images WHERE id=$1',[uuid(path.split('/').pop())]);if(!img)throw new AppError('Imagem não encontrada.',404);
    return new Response(img.content,{headers:{'content-type':img.mime,'cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}});
   }
   if(path==='/api/session'&&req.method==='GET')return response({authenticated:await authenticated(req),configured:!!passwordHash});
   if(path==='/api/login'&&req.method==='POST'){
    if(!passwordHash)throw new AppError('A senha da gestão ainda não foi configurada no Netlify.',503);
    const b=await req.json(),ip=digest((context.ip||'local')+passwordHash.slice(0,32));
    const [attempt]=await query(`INSERT INTO login_attempts(ip_hash,attempts) VALUES($1,1) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<NOW()-INTERVAL '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE login_attempts.window_start END RETURNING attempts`,[ip]);
    if(attempt.attempts>10)throw new AppError('Muitas tentativas. Aguarde 15 minutos.',429);
    if(!verifyPassword(b.password,passwordHash))throw new AppError('Senha incorreta.',401);
    const token=newToken();await transaction(async c=>{await c.query('DELETE FROM login_attempts WHERE ip_hash=$1',[ip]);await c.query('DELETE FROM sessions WHERE expires_at<NOW()');await c.query("INSERT INTO sessions VALUES($1,NOW()+INTERVAL '8 hours')",[digest(token)]);});
    return response({ok:true},200,{'set-cookie':cookie(token,local)});
   }
   if(!await authenticated(req))throw new AppError('Entre na gestão para continuar.',401);
   if(path==='/api/export'&&req.method==='GET'){
    const backup=await transaction(async c=>{
     await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
     const out={format:'use-mirielly-backup-v1',exported_at:new Date().toISOString()};
     for(const table of ['products','variants','sales','movements','expenses','settings'])out[table]=(await c.query('SELECT * FROM '+table)).rows;
     out.images=(await c.query('SELECT * FROM images')).rows.map(i=>({...i,content:i.content.toString('base64')}));return out;
    });
    return response(backup,200,{'content-disposition':`attachment; filename="mirielly-backup-${new Date().toISOString().slice(0,10)}.json"`});
   }
   if(path==='/api/logout'&&req.method==='POST'){await query('DELETE FROM sessions WHERE token_hash=$1',[digest(sessionToken(req))]);return response({ok:true},200,{'set-cookie':cookie('',local,true)});}
   if(path==='/api/admin'&&req.method==='GET'){
    const from=url.searchParams.get('from')||'2000-01-01',to=url.searchParams.get('to')||'2099-12-31';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new AppError('Período inválido.');
    const p=await products(true),sales=await query("SELECT * FROM sales WHERE voided_at IS NULL AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1::date AND $2::date ORDER BY created_at DESC",[from,to]),expenses=await query('SELECT * FROM expenses WHERE expense_date BETWEEN $1::date AND $2::date ORDER BY expense_date DESC,created_at DESC',[from,to]);
    const movements=await query('SELECT m.*,p.name,v.size FROM movements m JOIN variants v ON v.id=m.variant_id JOIN products p ON p.id=v.product_id ORDER BY m.created_at DESC LIMIT 100');
    return response({products:p,sales,expenses,movements,settings:(await query('SELECT * FROM settings WHERE id=1'))[0],metrics:financials(sales,expenses,p)});
   }
   const raw=await req.text();if(raw.length>750000)throw new AppError('Arquivo muito grande.',413);const b=JSON.parse(raw||'{}');
   if(path==='/api/products'&&req.method==='POST'){
    const p=validateProduct(b),id=b.request_id?uuid(b.request_id):randomUUID();
    await transaction(async c=>{const inserted=await c.query('INSERT INTO products(id,name,category,description,color,price_cents,photo_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id',[id,p.name,p.category,p.description,p.color,p.price_cents,p.photo_url]);if(!inserted.rows.length)return;for(const v of p.variants){const vid=randomUUID();await c.query('INSERT INTO variants VALUES($1,$2,$3,$4,$5)',[vid,id,v.size,v.stock,v.cost_cents]);if(v.stock)await c.query("INSERT INTO movements(id,variant_id,kind,quantity,cost_cents,note,request_id) VALUES($1,$2,'entrada',$3,$4,'Estoque inicial',$5)",[randomUUID(),vid,v.stock,v.cost_cents,randomUUID()]);}});
    return response({id},201);
   }
   if(path==='/api/products'&&req.method==='PATCH'){
    const id=uuid(b.id);if(typeof b.archived==='boolean'){
     const out=await transaction(async c=>{const p=await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id]);if(!p.rows.length)throw new AppError('Peça não encontrada.',404);const v=await c.query('SELECT stock FROM variants WHERE product_id=$1',[id]);if(b.archived && v.rows.some(x=>x.stock>0))throw new AppError('Retire ou venda o estoque antes de arquivar a peça.');return c.query('UPDATE products SET archived=$2 WHERE id=$1 RETURNING id',[id,b.archived]);});return response({ok:out.rowCount>0});
    }
    const p={name:text(b.name,'Nome',100),category:text(b.category,'Categoria',40),description:text(b.description,'Descrição',1000),color:text(b.color,'Cor',40),price_cents:integer(b.price_cents,'Preço',1,10000000),photo_url:imageUrl(b.photo_url)};
    const out=await query('UPDATE products SET name=$2,category=$3,description=$4,color=$5,price_cents=$6,photo_url=$7 WHERE id=$1 RETURNING id',[id,p.name,p.category,p.description,p.color,p.price_cents,p.photo_url]);if(!out.length)throw new AppError('Peça não encontrada.',404);return response({ok:true});
   }
   if(path==='/api/movement'&&req.method==='POST'){
    const vid=uuid(b.variant_id),rid=uuid(b.request_id),qty=integer(b.quantity,'Quantidade',1,100000),kind=b.kind;
    if(!['entrada','venda','retirada'].includes(kind))throw new AppError('Movimentação inválida.');
    const note=typeof b.note==='string'?b.note.trim().slice(0,500):'';
    const out=await transaction(async c=>{
     const lock=await c.query('SELECT v.*,p.name,p.price_cents,p.archived FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 FOR UPDATE OF v,p',[vid]);const v=lock.rows[0];if(!v||v.archived)throw new AppError('Peça indisponível.',404);
     const exists=await c.query('SELECT id FROM movements WHERE request_id=$1 UNION ALL SELECT id FROM sales WHERE request_id=$1',[rid]);if(exists.rows.length)return {ok:true,duplicate:true};
     if(kind!=='entrada'&&v.stock<qty)throw new AppError('Quantidade superior ao estoque disponível.',409);
     let cost=v.cost_cents;
     if(kind==='entrada'){
      cost=integer(b.cost_cents,'Custo de compra',0,10000000);const average=Math.round((v.stock*v.cost_cents+qty*cost)/(v.stock+qty));
      await c.query('UPDATE variants SET stock=stock+$2,cost_cents=$3 WHERE id=$1',[vid,qty,average]);
     }else await c.query('UPDATE variants SET stock=stock-$2 WHERE id=$1',[vid,qty]);
     if(kind==='venda'){
      const price=integer(b.price_cents,'Preço de venda',0,10000000),label=integer(b.label_cents,'Etiqueta',0,10000000),bag=integer(b.bag_cents,'Sacola',0,10000000),sweet=integer(b.sweet_cents,'Doces',0,10000000),other=integer(b.other_cents,'Outros custos',0,10000000),reserve=integer(b.reserve_percent,'Reinvestimento',0,100);
      await c.query('INSERT INTO sales(id,variant_id,product_name,size,quantity,price_cents,cost_cents,label_cents,bag_cents,sweet_cents,other_cents,reserve_percent,note,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[randomUUID(),vid,v.name,v.size,qty,price,cost,label,bag,sweet,other,reserve,note,rid]);
     }
     await c.query('INSERT INTO movements(id,variant_id,kind,quantity,cost_cents,note,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),vid,kind,kind==='entrada'?qty:-qty,cost,note,rid]);return {ok:true};
    });return response(out);
   }
   if(path==='/api/void-sale'&&req.method==='POST'){
    const id=uuid(b.id);await transaction(async c=>{
     // Same lock order as a sale/restock: variant, then sale.
     const found=await c.query('SELECT variant_id FROM sales WHERE id=$1',[id]);if(!found.rows.length)throw new AppError('Venda não encontrada.',404);
     const v=(await c.query('SELECT * FROM variants WHERE id=$1 FOR UPDATE',[found.rows[0].variant_id])).rows[0];
     const s=(await c.query('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[id])).rows[0];if(s.voided_at)throw new AppError('Essa venda já foi estornada.',409);
     const cost=Math.round((v.stock*v.cost_cents+s.quantity*s.cost_cents)/(v.stock+s.quantity));
     await c.query('UPDATE variants SET stock=stock+$2,cost_cents=$3 WHERE id=$1',[v.id,s.quantity,cost]);await c.query('UPDATE products SET archived=FALSE WHERE id=$1',[v.product_id]);
     await c.query('UPDATE sales SET voided_at=NOW() WHERE id=$1',[id]);await c.query("INSERT INTO movements(id,variant_id,kind,quantity,cost_cents,note,request_id) VALUES($1,$2,'estorno',$3,$4,$5,$6)",[randomUUID(),v.id,s.quantity,s.cost_cents,'Estorno da venda '+id,randomUUID()]);
    });return response({ok:true});
   }
   if(path==='/api/expenses'&&req.method==='POST'){
    const d=text(b.description,'Descrição',160),cat=text(b.category,'Categoria',50),amount=integer(b.amount_cents,'Valor',1,100000000),rid=uuid(b.request_id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(b.expense_date))throw new AppError('Informe a data.');
    await query('INSERT INTO expenses(id,description,category,amount_cents,expense_date,request_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(request_id) DO NOTHING',[randomUUID(),d,cat,amount,b.expense_date,rid]);return response({ok:true});
   }
   if(path==='/api/settings'&&req.method==='POST'){
    const vals=['label_cents','bag_cents','sweet_cents','other_cents'].map(k=>integer(b[k],k,0,10000000));vals.push(integer(b.reserve_percent,'Reinvestimento',0,100));await query('UPDATE settings SET label_cents=$1,bag_cents=$2,sweet_cents=$3,other_cents=$4,reserve_percent=$5 WHERE id=1',vals);return response({ok:true});
   }
   if(path==='/api/images'&&req.method==='POST'){
    if(typeof b.data!=='string')throw new AppError('Envie uma imagem.');const m=b.data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new AppError('Use PNG, JPG ou WebP.');
    const bytes=Buffer.from(m[2],'base64');if(bytes.length>500000)throw new AppError('A foto deve ter até 500 KB.',413);
    const valid=m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw new AppError('Conteúdo da imagem inválido.');
    const id=randomUUID();await query('INSERT INTO images(id,content,mime) VALUES($1,$2,$3)',[id,bytes,'image/'+m[1]]);return response({url:'/api/image/'+id},201);
   }
   throw new AppError('Página não encontrada.',404);
  }catch(e){if(e instanceof AppError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Dados inválidos.'},400);console.error('API failure',e.code||e.name);return response({error:'Não foi possível concluir. Tente novamente em instantes.'},503);}
 };
}
