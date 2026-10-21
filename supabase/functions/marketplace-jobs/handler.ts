import {digest} from '../_shared/instagram.ts';
import {service} from '../_shared/runtime.ts';
import {runMarketplaceJobs} from '../_shared/marketplace-jobs.ts';
import {type DB} from '../_shared/marketplace.ts';

export type MarketplaceJobsDependencies={
  database?:()=>DB;
  run?:(db:DB)=>Promise<number>;
  fingerprint?:(token:string)=>Promise<string>;
  heartbeat?:(db:DB,ok:boolean,processed:number,signal:AbortSignal)=>Promise<void>;
  reportFailure?:(code:'rr_marketplace_heartbeat_failed')=>void;
  heartbeatTimeoutMs?:number;
};

const deferred=()=>Response.json({error:'Verification run deferred'},{status:503,headers:{'Cache-Control':'no-store'}});
async function recordHeartbeat(db:DB,ok:boolean,processed:number,signal:AbortSignal) {
  const {error}=await db.rpc('rr_ops_heartbeat',{p_ok:ok,p_processed:processed}).abortSignal(signal);
  if(error)throw new Error('heartbeat_unavailable');
}

/** Monitoring is best effort AFTER actual work. A missing ops migration, timeout
 * or rejected heartbeat cannot prevent jobs from processing or change their
 * result. Only a fixed error code may be logged, never the caught exception. */
export function createMarketplaceJobsHandler(dependencies:MarketplaceJobsDependencies={}) {
  const limit=Number.isFinite(dependencies.heartbeatTimeoutMs)?Math.max(1,Math.min(5000,dependencies.heartbeatTimeoutMs!)):1500;
  const heartbeat=async(db:DB,ok:boolean,processed:number)=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      await Promise.race([
        Promise.resolve().then(()=>(dependencies.heartbeat??recordHeartbeat)(db,ok,processed,controller.signal)),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('heartbeat_timeout'));},limit);}),
      ]);
    }catch {
      // Logging is ancillary too; an injected logger cannot break processing.
      try{(dependencies.reportFailure??console.error)('rr_marketplace_heartbeat_failed');}catch{/* no raw logs */}
    }finally{if(timer!==undefined)clearTimeout(timer);controller.abort();}
  };
  return async(req:Request):Promise<Response>=>{
    if(req.method!=='POST')return new Response('Method not allowed',{status:405});
    const token=req.headers.get('authorization')?.replace(/^Bearer(?:\s+|$)/i,'');
    if(!token||token.length>200)return new Response('Unauthorized',{status:401});
    let db:DB;
    try {
      db=(dependencies.database??service)();
      const {data,error}=await db.rpc('rr_job_authorized',{p_hash:await (dependencies.fingerprint??digest)(token)});
      if(error||data!==true)return new Response('Unauthorized',{status:401});
    }catch{return deferred();}
    try {
      const processed=await (dependencies.run??runMarketplaceJobs)(db);
      if(!Number.isSafeInteger(processed)||processed<0||processed>1000)throw new Error('invalid_job_count');
      await heartbeat(db,true,processed);
      return Response.json({processed},{headers:{'Cache-Control':'no-store'}});
    }catch {
      await heartbeat(db,false,0);
      return deferred();
    }
  };
}
