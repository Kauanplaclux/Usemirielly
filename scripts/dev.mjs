import {NetlifyDB} from '@netlify/database-dev';
import {getDatabase} from '@netlify/database';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createAPI} from '../lib/api.mjs';
import {hashPassword} from '../lib/auth.mjs';
const db=new NetlifyDB({directory:'.local/database',logger:()=>{}});
const connectionString=await db.start();await db.applyMigrations('netlify/database/migrations');
const client=getDatabase({connectionString});
// PGlite exposes one database session; never interleave transactions across sockets.
client.pool.options.max=1;
const localPassword=process.env.LOCAL_ADMIN_PASSWORD||randomBytes(18).toString('base64url');
const handler=createAPI(client.pool,{local:true,passwordHash:hashPassword(localPassword)});
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost:4173');
  if(url.pathname.startsWith('/api/')){
   const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>800000){res.writeHead(413);res.end();return;}chunks.push(c);}
   const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await handler(request,{ip:'127.0.0.1'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),root=path.resolve('public');let filename=path.resolve(root,relative||'index.html');
  if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403);res.end();return;}
  try{if(!(await fs.stat(filename)).isFile())filename=path.join(root,'index.html');}catch{filename=path.join(root,'index.html');}
  const data=await fs.readFile(filename);res.writeHead(200,{'content-type':types[path.extname(filename)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(500);res.end('Não foi possível carregar.');}
});
server.listen(4173,'127.0.0.1',()=>{console.log('Use Mirielly disponível em http://localhost:4173');console.log('Senha temporária exclusivamente local: '+localPassword);});
for(const s of ['SIGINT','SIGTERM'])process.on(s,async()=>{server.close();await client.pool.end();await db.stop();process.exit();});

