// Generates the first, fictitious collection as a versioned data migration.
import fs from 'node:fs/promises';
const pieces=[
 ['Vestido Essência','Vestidos','Rosa','Um toque delicado para os seus momentos especiais. Modelo ilustrativo da coleção de demonstração.',12990,6500,'hero',['P',2,'M',3,'G',1]],
 ['Camiseta Leve','Blusas','Branco','O básico que deixa espaço para a sua personalidade. Foto ilustrativa; composição a confirmar no estoque real.',4990,2200,'look-2',['P',3,'M',4,'G',2]],
 ['Calça Sereno','Calças','Areia','Uma proposta elegante para combinar com o seu dia. Peça fictícia de demonstração.',11990,5800,'look-3',['P',2,'M',2,'G',1]],
 ['Vestido Botânica','Vestidos','Verde estampado','Estampa marcante para celebrar o seu jeito de ser. Peça e valor ilustrativos.',14990,7200,'look-4',['P',1,'M',1,'G',0]],
 ['Jeans Aurora','Calças','Azul','O jeans do encontro casual ao passeio de fim de semana. Peça fictícia; medidas a confirmar.',10990,5200,'look-5',['36',2,'38',3,'40',2]],
 ['Blazer Afeto','Casacos','Rosa','Uma camada de cor e personalidade para as suas combinações. Foto de inspiração; apenas o blazer é representado pelo valor.',16990,8500,'look-6',['P',1,'M',2,'G',1]],
 ['Camisa Brisa','Blusas','Branco','Leve no visual e cheia de possibilidades de combinação. Valor ilustrativo apenas da camisa.',8990,3900,'look-7',['P',2,'M',2,'G',1]],
 ['Camisa Entrelinhas','Blusas','Listrado','Listras e tons suaves para acompanhar suas histórias. Coleção fictícia de demonstração.',9990,4500,'look-8',['P',0,'M',0,'G',0]],
];
const q=x=>`'${String(x).replaceAll("'","''")}'`;
let sql='-- Coleção fictícia. Substituir pelo cadastro real na gestão; nenhum resultado de venda foi inventado.\n';
for(let i=0;i<pieces.length;i++){
 const [name,category,color,description,price,cost,photo,sizes]=pieces[i],pid=`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
 sql+=`INSERT INTO products(id,name,category,color,description,price_cents,photo_url,demo) VALUES(${[pid,name,category,color,description].map(q).join(',')},${price},${q('/assets/'+photo+'.webp')},TRUE);\n`;
 for(let j=0;j<sizes.length;j+=2){const vid=`20000000-0000-4000-8000-${String((i+1)*100+j).padStart(12,'0')}`;sql+=`INSERT INTO variants(id,product_id,size,stock,cost_cents) VALUES(${q(vid)},${q(pid)},${q(sizes[j])},${sizes[j+1]},${cost});\n`;if(sizes[j+1])sql+=`INSERT INTO movements(id,variant_id,kind,quantity,cost_cents,note,request_id) VALUES(${q('30000000-0000-4000-8000-'+String((i+1)*100+j).padStart(12,'0'))},${q(vid)},'entrada',${sizes[j+1]},${cost},'Estoque fictício de demonstração',${q('40000000-0000-4000-8000-'+String((i+1)*100+j).padStart(12,'0'))});\n`;}
}
await fs.writeFile('netlify/database/migrations/20261109000200_demo.sql',sql);
