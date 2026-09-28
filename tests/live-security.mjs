// Explicit operator-run integration test. Not part of npm test.
// Uses two disposable Auth users and the sole admin, provisioned out of band.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url,'https://jabwuawiqsusjrccapab.supabase.co');
const credentials=JSON.parse(readFileSync('.local-credentials/pass12.json','utf8')).users;
const fresh=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let count=0;const pass=name=>{count++;console.log(`PASS ${name}`);};
const clients=[];
async function api(client,action,values={}){const {data:{session}}=await client.auth.getSession();const response=await fetch(`${url}/functions/v1/realreach-api`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({action,...values})});return {status:response.status,data:await response.json()};}
try{
 const anon=fresh();const denied=await anon.from('profiles').select('id');assert.ok(denied.error);pass('anonymous profile access denied');
 assert.equal((await api(anon,'access')).status,401);pass('anonymous Edge command denied');
 const users={};
 for(const name of ['a','b','admin']){const credential=credentials.find(u=>u.name===name),client=fresh();const result=await client.auth.signInWithPassword({email:credential.email,password:credential.password});assert.equal(result.error,null,'Real password login must succeed');assert.equal(result.data.user.id,credential.id);users[name]={client,id:credential.id};clients.push(client);}
 pass('real password sign-in works for two independent users and admin');
 const a=users.a.client,b=users.b.client;
 const own=await a.from('profiles').update({display_name:'QA Worker A',city:'Lagos'}).eq('id',users.a.id).select('id');assert.equal(own.error,null);assert.equal(own.data.length,1);pass('ordinary user can save own profile');
 const other=await b.from('profiles').select('id').eq('id',users.a.id);assert.equal(other.error,null);assert.equal(other.data.length,0);pass('cross-user profile read isolated');
 const edit=await b.from('profiles').update({display_name:'hijacked'}).eq('id',users.a.id).select('id');assert.equal(edit.error,null);assert.equal(edit.data.length,0);pass('cross-user profile mutation isolated');
 const promote=await a.from('sole_admin').insert({singleton:true,user_id:users.a.id});assert.ok(promote.error);pass('ordinary client cannot assign admin');
 const metadata=await a.auth.updateUser({data:{role:'admin',isAdmin:true}});assert.equal(metadata.error,null);assert.equal((await api(a,'access')).data.isAdmin,false);pass('forged user metadata does not grant admin');
 assert.equal((await api(a,'admin-status')).status,403);pass('ordinary account denied admin API');
 assert.equal((await api(users.admin.client,'access')).data.isAdmin,true);pass('sole admin assignment recognized');
 assert.equal((await api(users.admin.client,'admin-status')).status,403);pass('admin without MFA denied privileged endpoint');
 for(const name of ['a','b']){const r=await users[name].client.from('businesses').insert({owner_id:users[name].id,name:`QA ${name} — temporary permission test`}).select('id');assert.equal(r.error,null);assert.equal(r.data.length,1);}
 pass('ordinary business owners create owned business records');
 const businessA=await a.from('businesses').select('id,owner_id');assert.equal(businessA.data.length,1);assert.equal(businessA.data[0].owner_id,users.a.id);pass('business rows isolated by ownership');
 const spoof=await a.from('businesses').insert({owner_id:users.admin.id,name:'Spoofed business'});assert.ok(spoof.error);pass('forged business owner denied');
 const ownerEdit=await a.from('businesses').update({owner_id:users.b.id}).eq('id',businessA.data[0].id);assert.ok(ownerEdit.error);pass('business ownership cannot be transferred from browser');
 for(const table of ['instagram_jobs','instagram_events','instagram_bindings','instagram_connect_attempts','pilot_invites']){assert.ok((await a.from(table).select('*')).error,`${table} must not be readable`);}pass('private integration tables deny customer access');
 const inject=await a.rpc('rr_finish_check',{p_job:crypto.randomUUID(),p_lease:crypto.randomUUID(),p_result:'positive',p_reason:null});assert.ok(inject.error);pass('client cannot submit a verification verdict');
 const blocked=await api(a,'connect-start');assert.equal(blocked.status,503);pass('unconfigured provider fails closed instead of confirming connection');
 const hook=await fetch(`${url}/functions/v1/instagram-webhook`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.ok([401,503].includes(hook.status));pass('unauthenticated webhook cannot enqueue proof');
 const job=await fetch(`${url}/functions/v1/instagram-jobs`,{method:'POST'});assert.ok([401,503].includes(job.status));pass('unauthenticated scheduler cannot run checks');
 for(const client of clients){const r=await client.auth.signOut();assert.equal(r.error,null);}pass('SDK sign-out succeeds');
 console.log(`Live authorization checks: ${count} passed. No Instagram provider or payment call made.`);
}finally{await Promise.all(clients.map(client=>client.auth.signOut().catch(()=>{})));}
