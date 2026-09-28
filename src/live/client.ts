import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const env = (import.meta as ImportMeta & { env: Record<string,string|undefined> }).env;
export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? '';
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const expected = 'https://jabwuawiqsusjrccapab.supabase.co';
export const configured = SUPABASE_URL === expected && key.startsWith('sb_publishable_');
export const supabase = configured ? createClient<Database>(SUPABASE_URL,key,{
  auth: { flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:'realreach-auth-v1' },
  global: { fetch: (url,options) => fetch(url,{...options,signal: options?.signal ?? AbortSignal.timeout(15_000)}) },
}) : null;
export function db() { if (!supabase) throw new Error('Account services are not configured on this deployment yet.'); return supabase; }
export async function command<T>(action: string, values: Record<string,unknown> = {}): Promise<T> {
  const {data:{session}}=await db().auth.getSession();
  const response=await fetch(`${SUPABASE_URL}/functions/v1/realreach-api`,{
    method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(session ? {Authorization:`Bearer ${session.access_token}`} : {})},
    body:JSON.stringify({action,...values}),signal:AbortSignal.timeout(20_000),
  });
  const result=await response.json();
  if (!response.ok) throw new Error(result.error ?? 'We could not complete that request. Please try again.');
  return result;
}
export async function authCapabilities(): Promise<{google:boolean;email:boolean}> {
  if (!configured) return {google:false,email:false};
  const response=await fetch(`${SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Account services are temporarily unavailable.');
  const data=await response.json();
  return {google:data.external?.google===true,email:data.external?.email===true && data.disable_signup!==true};
}
export function friendlyError(error: unknown) {
  const message=error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  if (/email.*not authorized|email.*sending|smtp|over_email_send_rate_limit/i.test(message)) return 'Email delivery is not ready or has reached its limit. Please try again later; no confirmation has been sent.';
  if (/failed to fetch|timeout|aborted/i.test(message)) return 'Connection interrupted. Check your connection and try again.';
  return message;
}
export type Profile = { id:string;display_name:string;city:string;preferred_front:'worker'|'business' };
export type Business = { id:string;name:string;owner_id:string };
export type Connection = { id:string;business_id:string;owner_id:string;username:string|null;status:string;updated_at:string };
export type Pilot = { id:string;business_id:string;worker_id:string;owner_id:string;business_name:string;instagram_username:string;challenge:string;status:string;reason:string|null;hold_until:string|null;expires_at:string;created_at:string;updated_at:string };
export const pilotColumns='id,business_id,worker_id,owner_id,business_name,instagram_username,challenge,status,reason,hold_until,expires_at,created_at,updated_at';
