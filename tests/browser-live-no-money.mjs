// Explicit real-browser write acceptance on the two known private release accounts only.
// Allowed: save/restore business settings; edit/restore the existing unfunded QA draft;
// one deduplicated worker support case labelled Browser release QA. No money/providers.
// REALREACH_LIVE_CONFIRM=no-money-acceptance node tests/browser-live-no-money.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {homedir} from 'node:os';
assert.equal(process.env.REALREACH_LIVE_CONFIRM,'no-money-acceptance');
const root=fileURLToPath(new URL('../',import.meta.url)),project='https://jabwuawiqsusjrccapab.supabase.co',base='https://realreach.com.ng';
process.loadEnvFile(join(root,'.env.local'));
assert.equal(process.env.VITE_SUPABASE_URL,project);
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;assert.ok(key?.startsWith('sb_publishable_'));
const credentials=JSON.parse(await readFile(join(root,'.local-credentials/release-qa.json'),'utf8'));
assert.equal(credentials.project,project);
for(const role of ['worker','business']){assert.ok(credentials[role]?.email?.endsWith('.invalid'));assert.match(credentials[role]?.id,/^[0-9a-f-]{36}$/i);assert.ok(credentials[role]?.password);}
const require=createRequire(import.meta.url);let pw;
try{pw=require(process.env.REALREACH_PLAYWRIGHT_PATH||'playwright');}catch{pw=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=join(root,'outputs/qa/live-no-money',new Date().toISOString().replaceAll(':','-'));await mkdir(out,{recursive:true});
const result={mode:'Real production browser writes on known private release QA accounts; no financial/provider operations',checks:[],requests:[],prevented:[],pageErrors:[],visualObservations:[],readRetries:[]};
const pass=text=>{result.checks.push(text);console.log('PASS '+text);};
const clean=value=>{let text=String(value);for(const role of ['worker','business'])text=text.replaceAll(credentials[role].password,'[redacted]').replaceAll(credentials[role].email,'[email]');return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token]');};
const browser=await pw.chromium.launch({channel:'chrome',headless:true});
const readActions=new Set(['workspace','list','campaign-detail','task-detail']);
let currentPage,businessRun,businessOriginal,draftOriginal,settingsDirty=false,draftDirty=false;
const supportMessage='Browser release QA — live browser acceptance. This private test request confirms that a worker can submit support and see the saved record after reloading. No payment or Instagram action is requested.';

async function make(role){
  const account=credentials[role],ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  const allowed={settings:[],campaign:null,support:false};
  let signedId=null;
  await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.hostname.endsWith('.supabase.co')&&url.origin!==project){result.prevented.push({role,reason:'wrong project'});return route.abort();}
    if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
    if(url.origin!==project)return route.abort();
    if(url.pathname==='/auth/v1/token'&&['password','refresh_token'].includes(url.searchParams.get('grant_type')))return route.continue();
    if(url.pathname==='/auth/v1/logout'&&url.searchParams.get('scope')==='local')return route.continue();
    let body;try{body=request.postDataJSON();}catch{body=null;}
    if(url.pathname==='/functions/v1/realreach-marketplace'&&method==='POST'){
      if(readActions.has(body?.action))return route.continue();
      if(signedId===account.id){
        if(role==='business'&&body?.action==='business-save'&&allowed.settings.some(value=>value.name===body.name&&value.category===body.category&&value.website===body.website))return route.continue();
        if(role==='business'&&body?.action==='campaign-save'&&allowed.campaign&&body.campaign?.id===allowed.campaign.id&&allowed.campaign.titles.includes(body.campaign.title)&&body.campaign.quantity===allowed.campaign.quantity&&body.campaign.action===allowed.campaign.action&&body.campaign.target_url===allowed.campaign.target_url&&body.campaign.instructions===allowed.campaign.instructions)return route.continue();
        if(role==='worker'&&body?.action==='case-create'&&allowed.support&&body.subject==='Something else'&&body.message===supportMessage&&body.reference===null){allowed.support=false;return route.continue();}
      }
    }
    result.prevented.push({role,path:url.pathname,action:body?.action??null,method});return route.abort();
  });
  const page=await ctx.newPage();currentPage=page;page.setDefaultTimeout(25_000);
  page.on('pageerror',e=>result.pageErrors.push({role,message:clean(e.message)}));
  page.on('response',async response=>{const url=new URL(response.url());if(url.origin===project){let action;try{action=response.request().postDataJSON()?.action;}catch{}const item={role,path:url.pathname,status:response.status(),...(action?{action}:{})};result.requests.push(item);if(!response.ok()&&url.pathname.startsWith('/rest/v1/')){const body=await response.json().catch(()=>null);item.error={code:clean(body?.code||''),message:clean(body?.message||'')};}}});
  await page.goto(base+'/login');await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.locator('input[name=password]').fill(account.password);
  const sign=page.waitForResponse(r=>r.url().startsWith(project+'/auth/v1/token?grant_type=password'));await page.getByRole('button',{name:'Log in',exact:true}).click();const signed=await sign;assert.equal(signed.status(),200,'Real QA login failed');
  signedId=(await signed.json()).user.id;assert.equal(signedId,account.id,'Unexpected authenticated identity');
  const destination='**'+(role==='worker'?'/earn':'/business');
  const arrived=await Promise.race([page.waitForURL(destination).then(()=>true),page.getByText('We could not load your account. Please retry.',{exact:true}).waitFor().then(()=>false)]);
  if(!arrived){result.readRetries.push({role,reason:'Account-read error after real sign-in'});console.log('RETRY '+role+': actual account read failed; exercising visible Retry once');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForURL(destination);}
  await page.locator('.r-workspace').waitFor();
  const profile=await page.evaluate(async({project,key,id})=>{const s=JSON.parse(localStorage.getItem('realreach-auth-v1'));const r=await fetch(project+'/rest/v1/profiles?select=id,account_type&id=eq.'+id,{headers:{apikey:key,Authorization:'Bearer '+s.access_token}});return{status:r.status,rows:await r.json()};},{project,key,id:account.id});
  assert.equal(profile.status,200);assert.equal(profile.rows[0]?.id,account.id);assert.equal(profile.rows[0]?.account_type,role);
  pass(role+': genuine UI sign-in and fixed server identity verified');
  return{page,ctx,role,allowed};
}
async function read(run,action,payload={}){
  assert.ok(readActions.has(action));
  return run.page.evaluate(async({project,key,body})=>{const s=JSON.parse(localStorage.getItem('realreach-auth-v1'));const r=await fetch(project+'/functions/v1/realreach-marketplace',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+s.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Read failed ('+r.status+')');return r.json();},{project,key,body:{...payload,action}});
}
async function ready(page){await page.getByRole('heading',{level:1}).first().waitFor();await page.waitForFunction(()=>!document.querySelector('.studio-skeleton,.r-loading'));}
async function capture(run,name,width){await run.page.setViewportSize({width,height:width>=1000?1000:844});await ready(run.page);await run.page.screenshot({path:join(out,run.role+'-'+name+'-'+width+'.png'),fullPage:true});await run.page.screenshot({path:join(out,run.role+'-'+name+'-viewport-'+width+'.png')});}
async function saveSettings(run,values){
  await run.page.goto(base+'/business/settings');await ready(run.page);
  await run.page.getByRole('textbox',{name:'Business name',exact:true}).fill(values.name);
  const saved=run.page.waitForResponse(r=>r.url().endsWith('/realreach-marketplace')&&r.request().postDataJSON()?.action==='business-save');
  await run.page.getByRole('button',{name:'Save business details',exact:true}).click();assert.equal((await saved).status(),200);await run.page.getByText('Business details saved.',{exact:true}).waitFor();
  await run.page.reload();await ready(run.page);assert.equal(await run.page.getByRole('textbox',{name:'Business name',exact:true}).inputValue(),values.name);assert.equal(await run.page.getByRole('textbox',{name:/Website/}).inputValue(),values.website);
  const actual=(await read(run,'workspace')).business;assert.equal(actual.name,values.name);assert.equal(actual.category||'',values.category);assert.equal(actual.website||'',values.website);
}
async function saveDraft(run,title){
  await run.page.goto(base+'/business/campaigns/'+draftOriginal.id+'/edit');await ready(run.page);
  const input=run.page.getByRole('textbox',{name:/Campaign name/});await input.fill(title);
  const saved=run.page.waitForResponse(r=>r.url().endsWith('/realreach-marketplace')&&r.request().postDataJSON()?.action==='campaign-save');
  await run.page.getByRole('button',{name:'Save draft',exact:true}).click();assert.equal((await saved).status(),200);await run.page.getByText('All changes saved',{exact:true}).waitFor();
  await run.page.reload();await ready(run.page);assert.equal(await run.page.getByRole('textbox',{name:/Campaign name/}).inputValue(),title);
  const actual=(await read(run,'campaign-detail',{id:draftOriginal.id})).campaign;assert.equal(actual.title,title);assert.equal(actual.status,'draft');assert.equal(actual.quantity,draftOriginal.quantity);assert.equal(actual.reserved_kobo,0);assert.equal(actual.spent_kobo,0);
}
async function signOut(run){await run.page.goto(base+'/account');await run.page.getByRole('button',{name:'Sign out',exact:true}).last().click();await run.page.waitForURL('**/login');await run.ctx.close();}
try{
  businessRun=await make('business');const initial=await read(businessRun,'workspace');assert.equal(initial.capabilities.payments,false);assert.equal(initial.capabilities.payouts,false);
  businessOriginal={name:initial.business.name,category:initial.business.category||'',website:initial.business.website||''};assert.match(businessOriginal.name,/RealReach release QA/);
  const changed={...businessOriginal,name:businessOriginal.name+' · Browser QA'};businessRun.allowed.settings=[businessOriginal,changed];
  settingsDirty=true;await saveSettings(businessRun,changed);pass('Business settings save through UI, return200, survive reload and match fresh authenticated API read');
  await capture(businessRun,'settings-saved',390);await capture(businessRun,'settings-saved',1440);
  await saveSettings(businessRun,businessOriginal);settingsDirty=false;pass('Original business name/category/website restored exactly and confirmed from fresh server read');
  const drafts=await read(businessRun,'list',{resource:'campaigns',filter:'draft',query:'RealReach release QA'});assert.equal(drafts.items.length,1,'Use only the single pre-existing private QA draft');draftOriginal=drafts.items[0];assert.equal(draftOriginal.owner_id,credentials.business.id);assert.equal(draftOriginal.status,'draft');assert.equal(draftOriginal.reserved_kobo,0);
  await businessRun.page.goto(base+'/business/campaigns');await ready(businessRun.page);const link=businessRun.page.getByRole('link',{name:'New campaign',exact:true});result.visualObservations.push({name:'New campaign link',...await link.evaluate(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,text:node.textContent.trim()}))});
  const changedTitle=draftOriginal.title+' — browser checked';assert.ok(changedTitle.length<=100);businessRun.allowed.campaign={...draftOriginal,titles:[draftOriginal.title,changedTitle]};
  draftDirty=true;await saveDraft(businessRun,changedTitle);pass('Existing unfunded draft edit saves through UI, survives reload and returns exact saved values from real API');
  await capture(businessRun,'draft-saved',390);await capture(businessRun,'draft-saved',1440);
  await saveDraft(businessRun,draftOriginal.title);draftDirty=false;pass('QA draft restored to original title; remains draft with zero reserved/spent funds');
  const finalBusiness=await read(businessRun,'workspace');for(const value of Object.values(finalBusiness.wallet))if(typeof value==='number')assert.equal(value,0);assert.equal(finalBusiness.payments.length,0);pass('Business financial state remains zero after browser saves');await signOut(businessRun);businessRun=null;

  const worker=await make('worker');await worker.page.goto(base+'/support');await ready(worker.page);
  let cursor,existing=[];do{const page=await read(worker,'list',{resource:'cases',...(cursor?{cursor}:{})});existing.push(...page.items);cursor=page.next_cursor;}while(cursor);
  const previous=existing.filter(item=>item.message===supportMessage);assert.ok(previous.length<=1,'QA support submission must not duplicate');
  if(!previous.length){worker.allowed.support=true;await worker.page.getByRole('combobox',{name:/What’s this about/}).selectOption('Something else');await worker.page.getByRole('textbox',{name:/A few details/}).fill(supportMessage);const sent=worker.page.waitForResponse(r=>r.url().endsWith('/realreach-marketplace')&&r.request().postDataJSON()?.action==='case-create');await worker.page.getByRole('button',{name:'Send request',exact:true}).click();assert.equal((await sent).status(),200);await worker.page.getByText(/Your request is saved\. Reference/).waitFor();pass('Worker support form creates exactly one clearly labelled private Browser release QA request');}else pass('Existing Browser release QA request reused; no duplicate submission');
  await worker.page.reload();await ready(worker.page);const request=worker.page.locator('.studio-case').filter({has:worker.page.locator('p',{hasText:supportMessage})});assert.equal(await request.count(),1);await request.locator('summary').click();await request.getByText(supportMessage,{exact:true}).waitFor();
  const persisted=await read(worker,'list',{resource:'cases'});assert.equal(persisted.items.filter(item=>item.message===supportMessage).length,1);pass('Support message survives reload and matches the actual authenticated cases API');
  await capture(worker,'support-saved',390);await capture(worker,'support-saved',1440);
  const finalWorker=await read(worker,'workspace');for(const value of Object.values(finalWorker.wallet))if(typeof value==='number')assert.equal(value,0);assert.equal(finalWorker.payments.length,0);pass('Worker financial state remains zero; no Instagram or payment provider was invoked');await signOut(worker);
  assert.deepEqual(result.prevented,[]);assert.deepEqual(result.pageErrors,[]);assert.ok(!result.requests.some(request=>request.status>=500));pass('No unexpected mutations, server errors or uncaught browser errors');
}catch(error){result.failure=clean(error.message);console.error('FAIL '+result.failure);process.exitCode=1;if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:join(out,'failure.png'),fullPage:true,mask:[currentPage.locator('input[type=password]')]}).catch(()=>{});
}finally{
  if(businessRun){try{if(draftDirty&&draftOriginal){await saveDraft(businessRun,draftOriginal.title);draftDirty=false;}if(settingsDirty&&businessOriginal){await saveSettings(businessRun,businessOriginal);settingsDirty=false;}}catch(error){result.restoreFailure=clean(error.message);process.exitCode=1;}}
  result.restoration={settingsRestored:!settingsDirty,draftRestored:!draftDirty};await browser.close();await writeFile(join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks.length,failure:result.failure??null,restoration:result.restoration,visualObservations:result.visualObservations}));
}
