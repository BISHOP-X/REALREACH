// Isolated browser contract checks. Never sends authentication or money requests live.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require('playwright');} catch {playwright=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const base=process.env.REALREACH_UI_TEST_URL||'http://localhost:5174';
assert.equal(new URL(base).hostname,'localhost');
const output=fileURLToPath(new URL('../outputs/qa/money-guards/',import.meta.url));
await mkdir(output,{recursive:true});
const uid='00000000-0000-4000-8000-000000000901',bid='00000000-0000-4000-8000-000000000902',cid='00000000-0000-4000-8000-000000000903';
const now=()=>new Date().toISOString();
const user={id:uid,email:'money-guards@ui-test.invalid',aud:'authenticated',role:'authenticated',created_at:now(),email_confirmed_at:now(),user_metadata:{},app_metadata:{provider:'email',providers:['email']}};
const jwtPart=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${jwtPart({alg:'HS256',typ:'JWT'})}.${jwtPart({sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.isolated-test`,refresh_token:'isolated-test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const campaign={id:cid,business_id:bid,business_name:'Money Guard Business',owner_id:uid,title:'A campaign under review',action:'follow',status:'paused',target_url:'https://www.instagram.com/guard_test/',target_username:'guard_test',target_id:'123456',instructions:'Follow our public page.',quantity:100,unit_reward_kobo:10000,unit_fee_kobo:2000,reserved_kobo:900000,spent_kobo:300000,delivered_count:25,active_count:7,pending_count:3,created_at:now(),updated_at:now(),ends_at:null,retention_hours:48};
const workspace={business:null,instagram:null,campaigns:[],feed:[],assignments:[],account_hold:false,wallet:{currency:'NGN',available_kobo:150000,pending_kobo:0,reserved_kobo:0,withdrawing_kobo:0,earned_kobo:150000,spent_kobo:0},transactions:[],beneficiaries:[{id:bid,bank_code:'044',bank_name:'Access Bank',account_name:'ADA TEST',account_last4:'3456',status:'verified'}],payments:[],cases:[],notifications:[],pricing:{approved:true,follow_reward_kobo:10000,follow_fee_kobo:2000,comment_reward_kobo:15000,comment_fee_kobo:3000,retention_hours:48,claim_minutes:30,minimum_withdrawal_kobo:100000,withdrawal_fee_kobo:5000,max_campaign_quantity:10000,terms_version:'terms-1'},capabilities:{instagram:true,payments:true,payouts:true,pricing:true,payouts_paused:false}};
const results={mode:'localhost intercepted HTTP; no live accounts or transfers',checks:[],layouts:[],pageErrors:[],commands:[],externalBlocked:[]};
const pass=message=>{results.checks.push(message);console.log('PASS '+message);};
let accountType='worker',rejectTerms=true,failBanks=true;
const withdrawals=[];
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
await context.addInitScript(value=>localStorage.setItem('realreach-auth-v1',JSON.stringify(value)),session);
await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===base)return route.continue();
  if(url.hostname!=='jabwuawiqsusjrccapab.supabase.co'){results.externalBlocked.push(url.hostname);return route.abort();}
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return send({});
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/auth/v1/token')return send(session);
  if(url.pathname==='/rest/v1/profiles')return send({id:uid,display_name:'Ada Test',city:'Lagos',preferred_front:accountType,account_type:accountType});
  if(url.pathname==='/rest/v1/sole_admin')return send([]);
  if(url.pathname==='/functions/v1/realreach-marketplace'){
    const body=req.postDataJSON();results.commands.push(body);
    if(body.action==='workspace')return send(workspace);
    if(body.action==='list')return send({items:[],next_cursor:null});
    if(body.action==='banks'){
      if(failBanks){failBanks=false;return send({error:'The bank list could not be loaded. Please retry.'},503);}
      return send({banks:[{code:'044',name:'Access Bank'}]});
    }
    if(body.action==='withdraw'){
      withdrawals.push(body);
      if(rejectTerms)return send({error:'Withdrawal fees changed. Refresh your wallet and review the current fee.'},409);
      assert.equal(body.expected_fee_kobo,workspace.pricing.withdrawal_fee_kobo);
      assert.equal(body.terms_version,workspace.pricing.terms_version);
      workspace.wallet.available_kobo-=body.amount_kobo+body.expected_fee_kobo;
      workspace.wallet.withdrawing_kobo+=body.amount_kobo+body.expected_fee_kobo;
      return send({id:'00000000-0000-4000-8000-000000000904'});
    }
    if(body.action==='campaign-detail')return send({campaign,receipts:[],receipts_total:0,receipts_limit:20,receipts_offset:0});
    return send({error:'Unexpected intercepted action: '+body.action},400);
  }
  return send({error:'Unexpected intercepted endpoint'},400);
});
const page=await context.newPage();page.on('pageerror',error=>results.pageErrors.push(error.message));
const dialog=()=>page.getByRole('dialog');
const submit=()=>dialog().getByRole('button',{name:'Request withdrawal',exact:true});
const amount=()=>dialog().getByRole('textbox',{name:'Amount',exact:true});
async function openWallet(){await page.goto(base+'/earn/wallet');await page.getByRole('button',{name:'Withdraw earnings',exact:true}).click();await dialog().waitFor();await amount().fill('1000');}
async function updateWorkspace(){const response=page.waitForResponse(r=>r.url().includes('/realreach-marketplace')&&r.request().postDataJSON()?.action==='workspace');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await response;}
try{
  for(const width of [360,390,430,1440]){
    await page.setViewportSize({width,height:width>=1000?1000:844});await openWallet();
    await dialog().getByLabel('Withdrawal recipient').getByText('ADA TEST',{exact:true}).waitFor();
    await dialog().getByText('Access Bank · Account ending 3456',{exact:true}).waitFor();
    await dialog().getByText('₦1,050',{exact:true}).waitFor();assert.equal(await submit().isEnabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const rect=await dialog().boundingBox();assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1);
    results.layouts.push({route:'/earn/wallet',width,pageOverflow:false,modalOverflow:false});
    if([390,1440].includes(width))await page.screenshot({path:join(output,`withdrawal-${width}.png`),fullPage:true});
    pass(`${width}px: withdrawal shows recipient, fee and total without overflow`);
  }
  await page.setViewportSize({width:390,height:500});await submit().scrollIntoViewIfNeeded();
  const shortButton=await submit().boundingBox();assert.ok(shortButton.y>=0&&shortButton.y+shortButton.height<=501);
  assert.equal(await amount().inputValue(),'1000');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  results.layouts.push({route:'/earn/wallet',width:390,height:500,pageOverflow:false,submitReachable:true});
  await page.screenshot({path:join(output,'withdrawal-short-viewport.png')});
  pass('short phone viewport keeps the amount and scrolls to the withdrawal action without overflow');
  await page.setViewportSize({width:390,height:844});
  for(const [value,note] of [['1000.01',/whole-naira/],['999',/minimum withdrawal/],['1500',/You need ₦1,550/]]){
    await amount().fill(value);await dialog().getByRole('status').filter({hasText:note}).waitFor();assert.equal(await submit().isDisabled(),true);
  }
  assert.equal(withdrawals.length,0);pass('fractional, below-minimum and fee-over-balance requests are blocked before submission');
  await amount().fill('1000');workspace.account_hold=true;await updateWorkspace();await dialog().getByRole('status').filter({hasText:/review a payment/}).waitFor();assert.equal(await submit().isDisabled(),true);assert.equal(withdrawals.length,0);pass('new account hold disables an already-open withdrawal without losing its inputs');
  workspace.account_hold=false;
  for(const [change,restore,note] of [
    [()=>workspace.capabilities.payouts=false,()=>workspace.capabilities.payouts=true,/Bank transfers are unavailable/],
    [()=>workspace.capabilities.payouts_paused=true,()=>workspace.capabilities.payouts_paused=false,/temporarily paused/],
    [()=>workspace.pricing.approved=false,()=>workspace.pricing.approved=true,/fees and limits/],
  ]){change();await updateWorkspace();await dialog().getByRole('status').filter({hasText:note}).waitFor();assert.equal(await submit().isDisabled(),true);restore();}
  pass('provider downtime, paused payouts and unapproved terms each explain the disabled action');
  await updateWorkspace();await submit().waitFor();await submit().click();await dialog().getByRole('alert').filter({hasText:/fees changed/}).waitFor();
  assert.equal(withdrawals.length,1);assert.equal(withdrawals[0].expected_fee_kobo,5000);assert.equal(withdrawals[0].terms_version,'terms-1');assert.equal(await amount().inputValue(),'1000');
  workspace.pricing.withdrawal_fee_kobo=7500;workspace.pricing.terms_version='terms-2';rejectTerms=false;
  await dialog().getByRole('button',{name:'Refresh wallet',exact:true}).click();await dialog().getByText('₦1,075',{exact:true}).waitFor();assert.equal(await amount().inputValue(),'1000');assert.equal(withdrawals.length,1);
  pass('stale-fee rejection retains recipient/amount; refresh displays new fee without automatically withdrawing');
  await submit().click();await dialog().waitFor({state:'hidden'});await page.getByText('Your withdrawal was requested. Follow its status below.').waitFor();
  assert.equal(withdrawals.length,2);assert.equal(withdrawals[0].idempotency_key,withdrawals[1].idempotency_key);assert.equal(withdrawals[1].amount_kobo,100000);assert.equal(withdrawals[1].expected_fee_kobo,7500);assert.equal(withdrawals[1].terms_version,'terms-2');
  pass('explicit retry submits current displayed terms with the same intent key and exact kobo');
  await page.getByRole('button',{name:'Add a bank account',exact:true}).click();await dialog().getByRole('button',{name:'Retry bank list'}).waitFor();assert.equal(await dialog().getByRole('button',{name:'Verify bank account'}).isDisabled(),true);
  await dialog().getByRole('button',{name:'Retry bank list'}).click();await dialog().getByRole('combobox',{name:'Bank',exact:true}).selectOption('044');
  assert.equal(await dialog().getByRole('combobox',{name:'Bank',exact:true}).isEnabled(),true);pass('bank-list failure can be retried in place without leaving the form');
  workspace.capabilities.payouts=false;await updateWorkspace();await dialog().getByRole('status').filter({hasText:/Bank verification is unavailable/}).waitFor();assert.equal(await dialog().getByRole('button',{name:'Verify bank account'}).isDisabled(),true);pass('bank verification is disabled with a reason when the provider is unavailable');
  // Switch fixture identity by a full reload, never a customer role-switch control.
  accountType='business';workspace.business={id:bid,name:'Money Guard Business'};workspace.campaigns=[campaign];workspace.account_hold=true;
  await page.setViewportSize({width:390,height:844});await page.goto(base+`/business/campaigns/${cid}`);
  await page.getByRole('button',{name:'Resume campaign',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Resume campaign',exact:true}).isDisabled(),true);
  await page.getByText(/This campaign cannot resume while a payment is under review/).waitFor();assert.equal(await page.getByRole('button',{name:'Close campaign',exact:true}).isEnabled(),true);
  assert.equal(results.commands.some(c=>c.action==='campaign-state'),false);pass('held business sees its campaign and receipts but cannot resume spending; close remains available');
  const supportLinks=page.getByRole('link',{name:/Contact support/i});assert.ok(await supportLinks.count()>0);assert.ok((await supportLinks.first().getAttribute('href')).startsWith('/support'));pass('payment-review support link stays within the signed-in support route');
  await page.screenshot({path:join(output,'held-campaign-390.png'),fullPage:true});
  assert.deepEqual(results.pageErrors,[]);pass('no uncaught browser errors');
}catch(error){results.failure={name:error.name,message:error.message};console.error(error.stack);process.exitCode=1;await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{await writeFile(join(output,'results.json'),JSON.stringify(results,null,2));await context.close();await browser.close();console.log(JSON.stringify({checks:results.checks.length,layouts:results.layouts.length,failure:results.failure||null}));}
