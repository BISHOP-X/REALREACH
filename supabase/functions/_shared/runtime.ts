import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { InstagramProvider, ProviderError } from './instagram.ts';
export const projectUrl = Deno.env.get('SUPABASE_URL') ?? '';
export const service = () => createClient(projectUrl,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',{ auth: { persistSession:false,autoRefreshToken:false } });
export const provider = () => new InstagramProvider(Deno.env.get('ZERNIO_API_KEY') ?? '');
export function requireProvider() {
  if (!Deno.env.get('ZERNIO_API_KEY')) throw new ProviderError(503,'Instagram connections are unavailable. Please try again later.');
}
export const origins = () => (Deno.env.get('RR_ALLOWED_ORIGINS') ?? 'https://www.realreach.com.ng,https://realreach.com.ng,http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim());
export function cors(req: Request) {
  const origin = req.headers.get('origin');
  return { ...(origin && origins().includes(origin) ? { 'Access-Control-Allow-Origin':origin } : {}), 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods':'POST,OPTIONS', Vary:'Origin' };
}
export function reply(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data),{ status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'} }); }
export async function identity(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if (!token) throw new ProviderError(401,'Please sign in to continue.');
  const db = service();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous) throw new ProviderError(401,'Please sign in with a confirmed account.');
  return { db, user: data.user, token };
}
export function must<T>({ data,error }: { data:T; error:unknown }): T {
  if (error) throw new ProviderError(409,'The request could not be saved. Refresh and try again.');
  return data;
}
export async function runJobs() {
  requireProvider();
  const db=service();
  const jobs=must(await db.rpc('rr_lease_jobs')) ?? [];
  await Promise.all(jobs.map(async (job: any) => {
    const pilot=must(await db.from('instagram_pilots').select('sender_id,connection_id').eq('id',job.pilot_id).single());
    if (!pilot) throw new Error('Pilot unavailable');
    const connection=must(await db.from('instagram_connections').select('status,provider_account_id').eq('id',pilot.connection_id).single());
    if (!connection) throw new Error('Connection unavailable');
    const result=connection.status === 'connected' && pilot.sender_id
      ? await provider().follow(connection.provider_account_id,pilot.sender_id)
      : {result:'unknown',reason:'account_disconnected'};
    must(await db.rpc('rr_finish_check',{ p_job:job.id,p_lease:job.lease_id,p_result:result.result,p_reason:result.reason }));
  }));
  return jobs.length;
}
