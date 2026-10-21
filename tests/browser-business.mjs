// Local UI contract test only. All Supabase traffic is intercepted in this isolated browser.
// Fixtures never create accounts, records, balances or payments in a real project.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.REALREACH_PLAYWRIGHT_PATH || 'playwright');
} catch (localError) {
  try {
    playwright = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  } catch {
    throw new Error('Playwright was not found. Install it locally or set REALREACH_PLAYWRIGHT_PATH.', {cause: localError});
  }
}
const {chromium} = playwright;
const base = process.env.REALREACH_UI_TEST_URL || 'http://localhost:5174';
assert.equal(new URL(base).hostname, 'localhost', 'This fixture harness must never run against production.');
const out = fileURLToPath(new URL('../outputs/qa/business-flow/', import.meta.url));
await mkdir(out, {recursive: true});
const now = () => new Date().toISOString();
const userId = '00000000-0000-4000-8000-000000000001';
const businessId = '00000000-0000-4000-8000-000000000002';
const liveId = '00000000-0000-4000-8000-000000000003';
const draftId = '00000000-0000-4000-8000-000000000004';
const oldId = '00000000-0000-4000-8000-000000000006';
const user = {id:userId,aud:'authenticated',role:'authenticated',email:'business@ui-test.invalid',email_confirmed_at:now(),user_metadata:{},app_metadata:{provider:'email',providers:['email']},created_at:now()};
const jwtPart = object => Buffer.from(JSON.stringify(object)).toString('base64url');
const token = `${jwtPart({alg:'HS256',typ:'JWT'})}.${jwtPart({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.local-ui-fixture`;
const session = {access_token:token,refresh_token:'local-ui-fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const campaign = (id,title,status='draft') => ({id,business_id:businessId,business_name:'Everyday Objects',owner_id:userId,title,action:'follow',status,target_url:'https://www.instagram.com/everydayobjects/',target_username:'everydayobjects',target_id:'123456',instructions:'Thoughtfully made everyday pieces. Discover what is new.',quantity:100,unit_reward_kobo:10000,unit_fee_kobo:2000,reserved_kobo:status==='draft'?0:900000,spent_kobo:status==='draft'?0:300000,delivered_count:status==='draft'?0:25,active_count:status==='draft'?0:7,pending_count:status==='draft'?0:3,created_at:now(),updated_at:now(),ends_at:null,retention_hours:48});
const oldCampaign = campaign(oldId,'From the archive');
const workspace = {business:{id:businessId,name:'Everyday Objects',category:'Home & living',website:'https://example.invalid'},instagram:{id:'00000000-0000-4000-8000-000000000005',username:'everydayobjects',instagram_id:'123456',status:'pending',profile_url:'https://www.instagram.com/everydayobjects/',avatar_url:null,verified_at:null,challenge:'RR-UI-ONLY',challenge_expires_at:new Date(Date.now()+1800000).toISOString()},campaigns:[campaign(liveId,'The everyday edit','live'),campaign(draftId,'A little more discovery')],feed:[],assignments:[],wallet:{currency:'NGN',available_kobo:0,pending_kobo:0,reserved_kobo:900000,withdrawing_kobo:0,earned_kobo:0,spent_kobo:300000},transactions:[],beneficiaries:[],payments:[],cases:[],notifications:[],pricing:{approved:false,follow_reward_kobo:0,follow_fee_kobo:0,comment_reward_kobo:0,comment_fee_kobo:0,retention_hours:48,claim_minutes:30,minimum_withdrawal_kobo:100000,withdrawal_fee_kobo:0,max_campaign_quantity:10000,terms_version:'fixture-1'},capabilities:{instagram:false,payments:false,payouts:false,pricing:false,payouts_paused:false}};
const results = {mode:'isolated HTTP UI fixtures; not live backend proof',checks:[],layouts:[],pageErrors:[],commands:[],blockedExternal:[]};
let failNextSave = false;
let saveFailureCount = 0;
const pass = message => {results.checks.push(message); console.log('PASS '+message);};
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
await context.addInitScript(s => localStorage.setItem('realreach-auth-v1',JSON.stringify(s)), session);
await context.route('**/*', async route => {
  const req = route.request(); const url = new URL(req.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== 'jabwuawiqsusjrccapab.supabase.co') {results.blockedExternal.push(url.hostname); return route.abort();}
  const send = (data,status=200) => route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'},body:JSON.stringify(data)});
  if (req.method()==='OPTIONS') return send({});
  if (url.pathname==='/auth/v1/user') return send(user);
  if (url.pathname==='/auth/v1/token') return send(session);
  if (url.pathname==='/auth/v1/logout') return send({});
  if (url.pathname==='/auth/v1/settings') return send({external:{google:true,email:true},disable_signup:false});
  if (url.pathname==='/rest/v1/profiles') return send({id:userId,display_name:'Ada Test',city:'Lagos',preferred_front:'business',account_type:'business'});
  if (url.pathname==='/rest/v1/sole_admin') return send([]);
  if (url.pathname==='/rest/v1/businesses') return send(workspace.business);
  if (url.pathname==='/rest/v1/instagram_connections') return send([]);
  if (url.pathname==='/functions/v1/realreach-marketplace') {
    const body=req.postDataJSON(); results.commands.push(body.action);
    if (body.action==='workspace') return send({...workspace,metrics:{active_assignments:0,completed_assignments:0,active_campaigns:workspace.campaigns.filter(c=>['live','paused','closing'].includes(c.status)).length,delivered_actions:workspace.campaigns.reduce((sum,c)=>sum+c.delivered_count,0),total_campaigns:workspace.campaigns.length+1}});
    if (body.action==='list'&&body.resource==='campaigns') {
      const all=[...workspace.campaigns,oldCampaign].filter(c=>(!body.filter||body.filter==='all'||(body.filter==='active'?['live','paused','closing'].includes(c.status):body.filter==='finished'?['completed','cancelled'].includes(c.status):c.status===body.filter))&&`${c.title} ${c.target_username}`.toLowerCase().includes((body.query||'').toLowerCase()));
      const offset=Number(body.cursor||0);return send({items:all.slice(offset,offset+2),next_cursor:offset+2<all.length?String(offset+2):null});
    }
    if (body.action==='campaign-save') {
      if (failNextSave) {failNextSave=false;saveFailureCount+=1;return send({error:'Temporary test interruption. Try again.'},503);}
      const input=body.campaign; assert.ok(input.id,'First-save idempotency ID is supplied');
      let item=workspace.campaigns.find(c=>c.id===input.id);
      if(!item){item=campaign(input.id,input.title);workspace.campaigns.unshift(item);}
      Object.assign(item,input,{updated_at:now()}); return send({id:item.id});
    }
    if (body.action==='campaign-quote') {
      const item=workspace.campaigns.find(c=>c.id===body.id);assert.ok(item);
      const reward=workspace.pricing[`${item.action}_reward_kobo`]*item.quantity;
      const fee=workspace.pricing[`${item.action}_fee_kobo`]*item.quantity;
      return send({campaign_updated_at:item.updated_at,reward_kobo:reward,fee_kobo:fee,total_kobo:reward+fee,shortfall_kobo:Math.max(0,reward+fee-workspace.wallet.available_kobo),approved:workspace.pricing.approved,expires_at:new Date(Date.now()+900000).toISOString(),quantity:item.quantity,retention_hours:48,terms_version:workspace.pricing.terms_version});
    }
    if (body.action==='campaign-publish') {
      const item=workspace.campaigns.find(c=>c.id===body.id);assert.equal(body.terms_version,workspace.pricing.terms_version);assert.equal(body.expected_updated_at,item.updated_at);assert.equal(body.expected_total_kobo,12000*item.quantity);
      Object.assign(item,{status:'live',unit_reward_kobo:10000,unit_fee_kobo:2000,reserved_kobo:body.expected_total_kobo,updated_at:now()});return send({id:item.id});
    }
    if (body.action==='campaign-state') {const item=workspace.campaigns.find(c=>c.id===body.id);item.status=body.state;return send({id:item.id});}
    if (body.action==='campaign-detail') {
      const item=workspace.campaigns.find(c=>c.id===body.id)||(body.id===oldId?oldCampaign:null);if(!item)return send({error:'Campaign not found.'},404);const receipts=Array.from({length:item.status==='draft'?0:3},(_,i)=>({id:`receipt-${i}`,action:item.action,username:`ui_test_${i}`,checked_at:now(),reward_kobo:10000,status:'settled'}));
      const offset=body.offset||0;return send({campaign:item,receipts:receipts.slice(offset,offset+2),receipts_total:receipts.length,receipts_limit:2,receipts_offset:offset});
    }
    if (body.action==='business-save') {Object.assign(workspace.business,{name:body.name,category:body.category,website:body.website});return send({id:businessId});}
    return send({error:'Unexpected fixture action: '+body.action},400);
  }
  return send({error:'Unexpected fixture endpoint'},400);
});
const page=await context.newPage();page.on('pageerror',error=>results.pageErrors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
try {
  await page.goto(base+'/business');
  await page.getByRole('heading',{name:'Good to see you, Ada.'}).waitFor();
  assert.equal(await page.getByLabel('Switch workspace').count(),0);pass('ordinary business has no role switcher');
  const paths=['/business','/business/campaigns','/business/campaigns/new',`/business/campaigns/${draftId}/edit`,`/business/campaigns/${liveId}`,'/business/settings'];
  for(const width of [360,390,430,768,1440]){
    await page.setViewportSize({width,height:width>=1000?1000:844});
    for(const path of paths){
      await page.goto(base+path);await page.getByRole('heading',{level:1}).first().waitFor();await page.locator('.studio-skeleton').waitFor({state:'hidden'});
      assert.equal(await page.getByRole('heading',{name:'Let’s get you back.',exact:true}).count(),0,`${path} rendered the error boundary at ${width}px`);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      assert.equal(overflow,false,`${path} overflows at ${width}`);results.layouts.push({width,path,overflow});
      const linkColors=await page.locator('a.studio-button').evaluateAll(links=>links.map(link=>({
        light:link.classList.contains('secondary')||link.classList.contains('light'),color:getComputedStyle(link).color,
      })));
      for(const link of linkColors) assert.equal(link.color,link.light?'rgb(48, 32, 52)':'rgb(255, 255, 255)',`${path} linked button contrast at ${width}`);
      if([390,1440].includes(width)&&['/business',`/business/campaigns/${liveId}`,'/business/campaigns/new'].includes(path))await page.screenshot({path:`${out}/${path.replaceAll('/','-').slice(1)}-${width}.png`,fullPage:true});
    }
    pass(`${width}px: six business routes fit without horizontal overflow`);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/business/campaigns');
  pass('linked action buttons retain explicit contrast across all business routes and widths');
  await page.getByRole('button',{name:'Load more campaigns'}).click();await page.getByRole('heading',{name:'From the archive'}).waitFor();pass('campaign pagination reaches records outside the workspace snapshot');
  await page.getByLabel('Search campaigns').fill('archive');await page.getByRole('heading',{name:'The everyday edit'}).waitFor({state:'hidden'});await page.getByRole('heading',{name:'From the archive'}).click();await page.getByLabel('Campaign name',{exact:false}).waitFor();assert.equal(await page.getByLabel('Campaign name',{exact:false}).inputValue(),'From the archive');pass('server search and direct edit links reach older owned campaigns');
  await page.goto(base+'/business/campaigns/new');await page.getByLabel('Campaign name',{exact:false}).fill('Unsaved brand brief');
  await page.locator('.r-bottomnav a[href="/business/campaigns"]').click();await page.getByRole('link',{name:'New campaign',exact:true}).click();assert.equal(await page.getByLabel('Campaign name',{exact:false}).inputValue(),'Unsaved brand brief');await page.getByText('Your unsaved changes were restored.').waitFor();pass('unsaved campaign text survives in-app navigation without claiming it was saved');
  await page.getByLabel('Campaign name',{exact:false}).fill('');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'at least 3 characters'}).waitFor();pass('campaign name validation is explicit');
  await page.getByRole('radio',{name:'Start a conversation'}).click();await page.getByLabel('Campaign name',{exact:false}).fill('Comments for the next collection');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Instagram post or reel link').fill('https://wrong.example/post');await page.getByLabel('Your comment brief').fill('Tell us which item you would choose and why, in your own words.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Use an Instagram link'}).waitFor();pass('non-Instagram target is rejected');
  await page.getByLabel('Instagram post or reel link').fill('https://www.instagram.com/p/ABC123/');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('How many comments?').fill('0');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'whole number'}).waitFor();pass('zero quantity is rejected');
  await page.getByLabel('How many comments?').fill('100');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Get my price'}).click();await page.waitForURL(/\/business\/campaigns\/[a-f0-9-]+\/edit\?step=3/);
  await page.getByText('Rates are being prepared. No price has been confirmed.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Publish',exact:true}).isDisabled(),true);assert.equal(await page.getByText('Total budget',{exact:true}).count(),0);pass('first save keeps review step; unapproved prices never imply a free campaign');
  const savedURL=page.url();const newId=savedURL.match(/campaigns\/([^/]+)\/edit/)[1];assert.equal(workspace.campaigns.filter(c=>c.id===newId).length,1);
  await page.reload();await page.getByText('Comments for the next collection',{exact:true}).first().waitFor();pass('saved campaign resumes on the review step after reload');
  await page.getByRole('button',{name:/Your goal/}).click();await page.getByLabel('Campaign name',{exact:false}).fill('A better campaign name');
  await page.getByText('All changes saved',{exact:true}).waitFor();assert.equal(workspace.campaigns.find(c=>c.id===newId).title,'A better campaign name');pass('existing draft autosaves to the same record');
  failNextSave=true;await page.getByLabel('Campaign name',{exact:false}).fill('A resilient campaign name');await page.getByRole('alert').filter({hasText:'Temporary test interruption'}).waitFor();await page.waitForTimeout(2000);assert.equal(saveFailureCount,1);pass('failed autosave stops retry loops and keeps the edited text');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved.',{exact:true}).waitFor();assert.equal(workspace.campaigns.find(c=>c.id===newId).title,'A resilient campaign name');
  workspace.pricing.approved=true;workspace.pricing.follow_reward_kobo=10000;workspace.pricing.follow_fee_kobo=2000;workspace.pricing.comment_reward_kobo=10000;workspace.pricing.comment_fee_kobo=2000;workspace.wallet.available_kobo=5000000;workspace.capabilities={instagram:true,payments:true,payouts:true,pricing:true,payouts_paused:false};workspace.instagram.status='verified';
  await page.goto(base+`/business/campaigns/${newId}/edit?step=3`);await page.getByRole('button',{name:'Get my price'}).click();await page.getByText('Total budget',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Publish',exact:true}).isDisabled(),true);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Publish campaign',exact:true}).click();await page.waitForURL(base+`/business/campaigns/${newId}`);pass('price acceptance confirms budget and publishes with the exact quote version');
  await page.getByRole('button',{name:'Pause campaign',exact:true}).click();await page.getByRole('button',{name:'Yes, pause'}).click();await page.getByRole('button',{name:'Resume campaign',exact:true}).waitFor();pass('pause updates real API contract state and exposes resume');
  await page.getByRole('button',{name:'Resume campaign',exact:true}).click();await page.getByRole('region',{name:'Confirm campaign change'}).getByRole('button',{name:'Resume campaign',exact:true}).click();await page.getByRole('button',{name:'Pause campaign',exact:true}).waitFor();
  await page.getByRole('button',{name:'Load more receipts'}).click();await page.getByText('Showing 3 of 3 delivered results').waitFor();pass('receipt pagination retains previous results and shows the actual total');
  await page.getByRole('button',{name:'Close campaign',exact:true}).click();await page.getByRole('region',{name:'Confirm campaign change'}).getByRole('button',{name:'Close campaign',exact:true}).click();await page.getByText('cancelled',{exact:true}).first().waitFor();pass('campaign close requires explicit confirmation');
  await page.goto(base+'/business/settings');await page.getByLabel('Business name',{exact:true}).fill('Everyday Objects Studio');await page.getByRole('button',{name:'Save business details'}).click();await page.getByText('Business details saved.').waitFor();assert.equal(workspace.business.name,'Everyday Objects Studio');pass('business settings save through the API contract');
  assert.deepEqual(results.pageErrors,[]);pass('no uncaught application errors across the business journey');
} catch(error){results.failure={name:error.name,message:error.message};console.error(error.message);process.exitCode=1;await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});}
finally{await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));await context.close();await browser.close();console.log(JSON.stringify({checks:results.checks.length,layouts:results.layouts.length,failure:results.failure||null}));}
