import { digest } from '../_shared/instagram.ts';
import { runJobs, service } from '../_shared/runtime.ts';
Deno.serve(async (req) => {
  if (req.method!=='POST') return new Response('Method not allowed',{status:405});
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if (!token || token.length>200) return new Response('Unauthorized',{status:401});
  const {data:authorized,error}=await service().rpc('rr_job_authorized',{p_hash:await digest(token)});
  if (error || authorized!==true) return new Response('Unauthorized',{status:401});
  try { return Response.json({processed:await runJobs()}); }
  catch { return new Response('Verification run deferred',{status:503}); }
});
