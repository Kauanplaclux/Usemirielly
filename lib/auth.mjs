import {scryptSync,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
export function hashPassword(password,salt=randomBytes(16).toString('hex')) {return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password,encoded) {
  if(typeof password!=='string' || password.length>200 || !encoded) return false;
  const [salt,hash]=encoded.split(':'); if(!salt || !/^[a-f0-9]{128}$/.test(hash||'')) return false;
  return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const newToken=()=>randomBytes(32).toString('hex');
export function sessionToken(req){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('mirielly_session='))?.split('=')[1]||'';}
export function cookie(token,local=false,clear=false){return `mirielly_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:28800}${local?'':'; Secure'}`;}
