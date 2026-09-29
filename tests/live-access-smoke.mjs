// Read-only SDK checks using the existing admin identity; no user provisioning.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url,'https://jabwuawiqsusjrccapab.supabase.co');
const credential=JSON.parse(readFileSync('.local-credentials/admin.json','utf8'));
const fresh=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=fresh(),anon=fresh();let count=0;
const pass=name=>{count++;console.log('PASS '+name);};
async function command(client,action){const {data:{session}}=await client.auth.getSession();const r=await fetch(url+'/functions/v1/realreach-api',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({action})});return {status:r.status,data:await r.json()};}
try{
  for(const table of ['profiles','businesses','campaign_drafts','sole_admin'])assert.ok((await anon.from(table).select('*')).error);
  pass('anonymous account, business, drafts and admin reads rejected');
  assert.ok((await anon.rpc('rr_complete_onboarding',{p_type:'business',p_name:'Unauthorized',p_city:'',p_business_name:'Unauthorized'})).error);
  pass('anonymous onboarding rejected');
  assert.equal((await command(anon,'admin-status')).status,401);pass('anonymous admin API rejected');
  const signed=await admin.auth.signInWithPassword({email:credential.email,password:credential.password});
  assert.equal(signed.error,null);pass('real admin password sign-in succeeds');
  assert.equal((await command(admin,'access')).data.isAdmin,true);pass('server recognizes sole admin assignment');
  assert.equal((await command(admin,'admin-status')).status,403);pass('admin without authenticator remains blocked from operations');
  const profile=await admin.from('profiles').select('id,account_type').single();
  assert.equal(profile.error,null);assert.equal(profile.data.id,signed.data.user.id);pass('real session reads only its own profile');
  assert.ok((await admin.from('profiles').update({account_type:'business'}).eq('id',signed.data.user.id)).error);
  pass('even admin browser cannot directly overwrite account type');
  const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}}).then(r=>r.json());
  assert.equal(settings.external.google,true);pass('Google provider remains enabled');
  const capabilities=await command(anon,'capabilities');
  assert.equal(capabilities.data.livePayments,false);pass('unavailable payments remain closed');
  const provision=await fetch(url+'/functions/v1/identity-provision',{method:'POST'});
  assert.equal(provision.status,410);pass('temporary provisioning endpoint remains closed');
  console.log(count+' live SDK/API checks passed. No money moved.');
}finally{await admin.auth.signOut({scope:'local'});}
