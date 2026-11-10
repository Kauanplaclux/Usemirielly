import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
for(const dir of ['lib','public','netlify/functions','scripts'])for(const f of fs.readdirSync(dir)){if(/\.(mjs|js)$/.test(f))execFileSync(process.execPath,['--check',`${dir}/${f}`]);}
for(const p of ['public/index.html','public/style.css','public/app.js','public/assets/logo.png'])if(!fs.existsSync(p))throw new Error('Missing '+p);
console.log('Arquivos e sintaxe verificados.');
