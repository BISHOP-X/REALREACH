// Account-isolation regression tests with deliberately delayed HTTP fixtures.
// Every remote request is intercepted. No live accounts, credentials or writes.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.REALREACH_PLAYWRIGHT_PATH||'playwright');}
catch{playwright=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.REALREACH_UI_TEST_URL||'http://localhost:5174';
assert.equal(new URL(base).hostname,'localhost');
const out=fileURLToPath(new URL('../outputs/qa/session-races/',import.meta.url));
await mkdir(out,{recursive:true});
const now=()=>new Date().toISOString();
const identity=(number,name)=>{
  const id=`00000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
  const user={id,aud:'authenticated',role:'authenticated',email:`${name}@race-test.invalid`,email_confirmed_at:now(),user_metadata:{},app_metadata:{provider:'email',providers:['email']},created_at:now()};
  const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token=`${part({alg:'HS256',typ:'JWT'})}.${part({sub:id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.local-ui-fixture`;
  return {access_token,refresh_token:'local-fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
};
const sessionA=identity(91,'ada'),sessionB=identity(92,'bea');
const campaign=owner=>({id:owner===sessionA?'00000000-0000-4000-8000-000000000201':'00000000-0000-4000-8000-000000000202',business_id:owner.user.id,business_name:owner===sessionA?'Private A business':'Private B business',owner_id:owner.user.id,title:owner===sessionA?'Only A campaign':'Only B campaign',action:'follow',status:'draft',target_url:'https://www.instagram.com/fixtureprofile/',target_username:'fixtureprofile',target_id:'12345',instructions:'',quantity:100,unit_reward_kobo:0,unit_fee_kobo:0,reserved_kobo:0,spent_kobo:0,delivered_count:0,active_count:0,pending_count:0,created_at:now(),updated_at:now(),ends_at:null,retention_hours:48});
const workspace=owner=>({business:{id:owner.user.id,name:owner===sessionA?'Private A business':'Private B business',category:'',website:''},instagram:{id:owner.user.id,username:'fixtureprofile',instagram_id:'12345',status:'verified',profile_url:'https://www.instagram.com/fixtureprofile/',avatar_url:null,verified_at:now(),challenge:null,challenge_expires_at:null},campaigns:[campaign(owner)],feed:[],assignments:[],wallet:{currency:'NGN',available_kobo:0,pending_kobo:0,reserved_kobo:0,withdrawing_kobo:0,earned_kobo:0,spent_kobo:0},transactions:[],beneficiaries:[],payments:[],cases:[],notifications:[],pricing:{approved:false,follow_reward_kobo:0,follow_fee_kobo:0,comment_reward_kobo:0,comment_fee_kobo:0,retention_hours:48,claim_minutes:30,minimum_withdrawal_kobo:100000,withdrawal_fee_kobo:0,max_campaign_quantity:10000,terms_version:'fixture'},capabilities:{instagram:false,payments:false,payouts:false,pricing:false,payouts_paused:false},metrics:{active_assignments:0,completed_assignments:0,active_campaigns:0,delivered_actions:0,total_campaigns:1}});
const gates=new Map();
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function hold(action,owner=sessionA){const entered=deferred(),release=deferred();gates.set(`${owner.user.id}:${action}`,{entered,release});return {seen:entered.promise,release:release.resolve};}
const results={mode:'isolated HTTP fixtures; not a live authorization test',target:base,checks:[],abortedActions:[],pageErrors:[]};
const record=name=>{results.checks.push(name);console.log('PASS '+name);};
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
await context.addInitScript(session=>{
  localStorage.setItem('realreach-auth-v1',JSON.stringify(session));
  const timeout=AbortSignal.timeout.bind(AbortSignal);
  AbortSignal.timeout=milliseconds=>timeout(milliseconds===15000&&sessionStorage.getItem('rr-test-short-profile-deadline')==='1'?200:milliseconds);
  window.google={accounts:{id:{initialize(){},renderButton(element){const button=document.createElement('button');button.textContent='Continue with Google';element.append(button);},disableAutoSelect(){}}}};
},sessionA);
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base)return route.continue();
  if(url.hostname!=='jabwuawiqsusjrccapab.supabase.co')return route.abort();
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)}).catch(()=>{});
  if(request.method()==='OPTIONS')return send({});
  const owner=request.headers().authorization===`Bearer ${sessionB.access_token}`?sessionB:sessionA;
  const body=request.method()==='POST'?request.postDataJSON():{};
  const action=url.pathname==='/rest/v1/profiles'?'profile':url.pathname==='/rest/v1/sole_admin'?'admin':body.action;
  const gate=gates.get(`${owner.user.id}:${action}`);
  if(gate){gates.delete(`${owner.user.id}:${action}`);gate.entered.resolve();await gate.release.promise;}
  if(url.pathname==='/auth/v1/settings')return send({external:{google:true,email:true},disable_signup:false});
  if(url.pathname==='/auth/v1/user')return send(owner.user);
  if(url.pathname==='/auth/v1/logout')return send({});
  if(url.pathname==='/rest/v1/profiles')return send({id:owner.user.id,display_name:owner===sessionA?'Ada Private':'Bea Private',city:'Lagos',preferred_front:'business',account_type:'business'});
  if(url.pathname==='/rest/v1/sole_admin')return send(owner===sessionA?{user_id:owner.user.id}:[]);
  if(url.pathname==='/functions/v1/realreach-marketplace'){
    if(action==='workspace')return send(workspace(owner));
    if(action==='list')return send({items:[campaign(owner)],next_cursor:null});
    if(action==='campaign-save')return send({id:body.campaign.id});
    if(action==='campaign-detail')return send({campaign:campaign(owner),receipts:[],receipts_total:0,receipts_offset:0,receipts_limit:500});
  }
  return send({error:'Unexpected isolated endpoint'},400);
});
const page=await context.newPage();
page.on('pageerror',error=>results.pageErrors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
page.on('requestfailed',request=>{if(request.url().includes('/functions/v1/realreach-marketplace'))results.abortedActions.push(request.postDataJSON()?.action);});
// This reproduces the SDK's documented cross-tab event/storage transport, not a new product API.
const switchAccount=async session=>page.evaluate(session=>{
  if(session)localStorage.setItem('realreach-auth-v1',JSON.stringify(session));else localStorage.removeItem('realreach-auth-v1');
  const channel=new BroadcastChannel('realreach-auth-v1');channel.postMessage({event:session?'SIGNED_IN':'SIGNED_OUT',session});setTimeout(()=>channel.close(),100);
},session);
const noOldAccount=async()=>{
  assert.doesNotMatch(await page.locator('body').innerText(),/Only A campaign|Private A business|Ada Private/);
  assert.equal(await page.getByLabel('Switch workspace').count(),0);
  assert.equal(await page.getByRole('heading',{name:'Let’s get you back.',exact:true}).count(),0);
};
try{
  let gate=hold('workspace');await page.goto(base+'/business');await gate.seen;await switchAccount(sessionB);await page.getByRole('heading',{name:'Good to see you, Bea.'}).waitFor();gate.release();await page.waitForTimeout(100);await noOldAccount();
  assert.ok(results.abortedActions.includes('workspace'));record('Switching accounts cancels an in-flight workspace snapshot; previous account data and admin switcher never return');

  gate=hold('list');await page.goto(base+'/business/campaigns');await gate.seen;await switchAccount(sessionB);await page.getByRole('heading',{name:'Only B campaign'}).waitFor();gate.release();await page.waitForTimeout(100);await noOldAccount();
  assert.ok(results.abortedActions.includes('list'));record('A delayed previous-account list cannot replace the new account list');

  await page.goto(base+'/business/campaigns/new');await page.getByLabel('Campaign name',{exact:false}).fill('Old account unsaved campaign');gate=hold('campaign-save');await page.getByRole('button',{name:'Save draft',exact:true}).click();await gate.seen;await switchAccount(sessionB);await page.getByLabel('Campaign name',{exact:false}).waitFor();gate.release();await page.waitForTimeout(200);
  assert.equal(new URL(page.url()).pathname,'/business/campaigns/new');assert.equal(await page.getByLabel('Campaign name',{exact:false}).inputValue(),'');assert.equal(await page.getByText('Draft saved.',{exact:true}).count(),0);await noOldAccount();
  assert.ok(results.abortedActions.includes('campaign-save'));record('A previous-account mutation cannot navigate or display success in the new account');

  gate=hold('admin');await page.goto(base+'/business');await gate.seen;await switchAccount(sessionB);await page.getByRole('heading',{name:'Good to see you, Bea.'}).waitFor();gate.release();await page.waitForTimeout(100);await noOldAccount();record('Delayed privileged-profile lookup cannot grant admin access after an account switch');

  await page.goto(base+'/business');await page.getByRole('heading',{name:'Good to see you, Ada.'}).waitFor();gate=hold('workspace');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await gate.seen;await switchAccount(null);await page.waitForURL('**/login');gate.release();await page.waitForTimeout(100);assert.equal(new URL(page.url()).pathname,'/login');await noOldAccount();record('Sign-out cancels background refresh and never restores the old dashboard');

  await page.evaluate(()=>sessionStorage.setItem('rr-test-short-profile-deadline','1'));gate=hold('profile');await page.goto(base+'/business');await gate.seen;await page.getByRole('alert').filter({hasText:'We could not load your account. Please retry.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Retry',exact:true}).isEnabled(),true);gate.release();await page.evaluate(()=>sessionStorage.removeItem('rr-test-short-profile-deadline'));await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Good to see you, Ada.'}).waitFor();record('A stalled profile read reaches a bounded error with Retry; retry restores the account');

  assert.deepEqual(results.pageErrors,[]);record('No uncaught errors during delayed reads, mutation, profile lookup or sign-out');
}catch(error){results.failure=error.message;console.error(error);process.exitCode=1;await page.screenshot({path:join(out,'failure.png'),fullPage:true});}
finally{for(const gate of gates.values())gate.release.resolve();await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();}
