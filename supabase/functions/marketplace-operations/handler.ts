import {digest} from '../_shared/instagram.ts';
import {service} from '../_shared/runtime.ts';
import {type DB} from '../_shared/marketplace.ts';
import {runMarketplaceOperations} from '../_shared/marketplace-operations.ts';

type Dependencies={database?:()=>DB;fingerprint?:(token:string)=>Promise<string>;run?:(db:DB)=>Promise<{state:string;accepted:number}>};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export function createMarketplaceOperationsHandler(dependencies:Dependencies={}){
  return async(req:Request):Promise<Response>=>{
    if(req.method!=='POST'&&req.method!=='GET')return json({error:'Method not allowed'},405);
    // This endpoint reveals only fresh/stale liveness, never incident counts,
    // contacts, balances or transport configuration. External uptime checks do
    // not need the privileged job token.
    if(req.method==='GET'){
      try{
        const db=(dependencies.database??service)();
        const {data,error}=await db.rpc('rr_ops_liveness').abortSignal(AbortSignal.timeout(5000));
        const ok=!error&&data===true;
        return json({ok},ok?200:503);
      }catch{return json({ok:false},503);}
    }
    const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
    if(!token||token.length>200)return json({error:'Unauthorized'},401);
    try{
      const db=(dependencies.database??service)();
      const {data,error}=await db.rpc('rr_job_authorized',{p_hash:await(dependencies.fingerprint??digest)(token)}).abortSignal(AbortSignal.timeout(5000));
      if(error||data!==true)return json({error:'Unauthorized'},401);
      const result=await(dependencies.run??runMarketplaceOperations)(db);
      return json({state:result.state,accepted:result.accepted});
    }catch{return json({error:'Operations run deferred'},503);}
  };
}
