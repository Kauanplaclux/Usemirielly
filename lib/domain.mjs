export class AppError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export function integer(value, label, min=0, max=100000000) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value<min || value>max) throw new AppError(`${label}: informe um número válido.`);
  return value;
}
export function text(value, label, max=160) {
  if (typeof value!=='string' || !value.trim() || value.trim().length>max) throw new AppError(`${label}: preencha corretamente.`);
  return value.trim();
}
export function imageUrl(value) {
  if (typeof value!=='string' || value.length>2000) throw new AppError('Foto inválida.');
  if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(value) || /^\/api\/image\/[a-f0-9-]{36}$/.test(value)) return value;
  try { const u=new URL(value); if(u.protocol==='https:' && !u.username && !u.password) return u.href; } catch {}
  throw new AppError('Use uma imagem enviada ou um endereço HTTPS.');
}
export function financials(sales, expenses, products) {
  const revenue=sales.reduce((a,s)=>a+s.quantity*s.price_cents,0);
  const goods=sales.reduce((a,s)=>a+s.quantity*s.cost_cents,0);
  const extras=sales.reduce((a,s)=>a+s.quantity*(s.label_cents+s.bag_cents+s.sweet_cents+s.other_cents),0);
  const operating=expenses.reduce((a,e)=>a+e.amount_cents,0);
  const contribution=revenue-goods-extras;
  const result=contribution-operating;
  // Reserve only positive contribution, capped by positive period result.
  const suggested=sales.reduce((a,s)=>a+Math.round(Math.max(0,s.quantity*(s.price_cents-s.cost_cents-s.label_cents-s.bag_cents-s.sweet_cents-s.other_cents))*s.reserve_percent/100),0);
  const reserve=Math.min(Math.max(0,result),suggested);
  const variants=products.filter(p=>!p.archived).flatMap(p=>p.variants);
  return {revenue,goods,extras,operating,commercial:revenue-goods,contribution,result,reserve,available:result-reserve,units:variants.reduce((a,v)=>a+v.stock,0),invested:variants.reduce((a,v)=>a+v.stock*v.cost_cents,0),potential:products.filter(p=>!p.archived).reduce((a,p)=>a+p.variants.reduce((t,v)=>t+v.stock*p.price_cents,0),0),sold:sales.reduce((a,s)=>a+s.quantity,0)};
}
export function validateProduct(b) {
  const name=text(b.name,'Nome',100), category=text(b.category,'Categoria',40), description=text(b.description,'Descrição',1000), color=text(b.color,'Cor',40);
  const price=integer(b.price_cents,'Preço',1,10000000), photo=imageUrl(b.photo_url);
  if(!Array.isArray(b.variants) || b.variants.length<1 || b.variants.length>20) throw new AppError('Adicione de 1 a 20 tamanhos.');
  const variants=b.variants.map(v=>({size:text(v.size,'Tamanho',12),stock:integer(v.stock,'Estoque',0,100000),cost_cents:integer(v.cost_cents,'Custo',0,10000000)}));
  if(new Set(variants.map(v=>v.size.toUpperCase())).size!==variants.length) throw new AppError('Os tamanhos não podem se repetir.');
  return {name,category,description,color,price_cents:price,photo_url:photo,variants};
}
