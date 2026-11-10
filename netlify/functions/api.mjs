import {getDatabase} from '@netlify/database';
import {createAPI} from '../../lib/api.mjs';
let handler;
export default async (req,context)=>{
 if(!handler)handler=createAPI(getDatabase().pool,{passwordHash:Netlify.env.get('ADMIN_PASSWORD_HASH')});
 return handler(req,context);
};
