// Local business-wallet contract test: external requests are intercepted or blocked.
// No real authentication, accounts, deposits, provider calls or ledger changes occur.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{playwright=require('C:/Users/dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const base=process.env.REALREACH_UI_TEST_URL||'http://localhost:5174';
assert.equal(new URL(base).hostname,'localhost','UI fixtures must only run on localhost.');
const out=new URL('../outputs/qa/wallet-flow/',import.meta.url);await mkdir(out,{recursive:true});
const path=name=>new URL(name,out).pathname.replace(/^\/([A-Z]:)/,'$1');
const now=()=>new Date().toISOString(),uid='00000000-0000-4000-8000-000000000801',pid='00000000-0000-4000-8000-000000000802';
const user={id:uid,email:'business-wallet@ui-test.invalid',aud:'authenticated',role:'authenticated',created_at:now(),email_confirmed_at:now(),user_metadata:{},app_metadata:{provider:'email',providers:['email']}};
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:`${part({alg:'HS256',typ:'JWT'})}.${part({sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.isolated-fixture`,refresh_token:'isolated-fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const workspace={business:{id:'00000000-0000-4000-8000-000000000803',name:'Wallet Test Business'},instagram:null,campaigns:[],feed:[],assignments:[],wallet:{currency:'NGN',available_kobo:0,pending_kobo:0,reserved_kobo:0,withdrawing_kobo:0,earned_kobo:0,spent_kobo:0},transactions:[],beneficiaries:[],payments:[],cases:[],notifications:[],pricing:{approved:true,follow_reward_kobo:10000,follow_fee_kobo:2000,comment_reward_kobo:15000,comment_fee_kobo:3000,retention_hours:48,claim_minutes:30,minimum_withdrawal_kobo:100000,withdrawal_fee_kobo:5000,max_campaign_quantity:10000,terms_version:'rr-wallet-fixture'},capabilities:{instagram:true,payments:true,payouts:true,pricing:true,payouts_paused:false}};
const results={mode:'localhost HTTP fixtures only; not live money acceptance',checks:[],layouts:[],pageErrors:[],commands:[],externalBlocked:[]};
const pass=message=>{results.checks.push(message);console.log('PASS '+message);};
let failCreate=true,failRefresh=false,nextStatus='pending',denyOther=false;
const createCalls=[];
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
await context.addInitScript(value=>localStorage.setItem('realreach-auth-v1',JSON.stringify(value)),session);
await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===base)return route.continue();
  if(url.hostname!=='jabwuawiqsusjrccapab.supabase.co'){results.externalBlocked.push(url.hostname);return route.abort();}
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return send({});
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/auth/v1/token')return send(session);
  if(url.pathname==='/rest/v1/profiles')return send({id:uid,display_name:'Business Test',city:'Lagos',preferred_front:'business',account_type:'business'});
  if(url.pathname==='/rest/v1/sole_admin')return send([]);
  if(url.pathname==='/functions/v1/realreach-marketplace'){
    const body=req.postDataJSON();results.commands.push(body);
    if(body.action==='workspace')return send(workspace);
    if(body.action==='list'&&body.resource==='transactions')return send({items:workspace.transactions.filter(t=>!body.filter||body.filter==='all'||t.kind===body.filter),next_cursor:null});
    if(body.action==='list'&&body.resource==='payments')return send({items:workspace.payments,next_cursor:null});
    if(body.action==='payment-create'){
      createCalls.push(body);assert.equal(body.amount_kobo,123456);assert.equal(body.phone,'08012345678');assert.match(body.idempotency_key,/^[a-f0-9-]{36}$/i);
      if(failCreate){failCreate=false;return send({error:'The payment request was interrupted. Retry the same request.'},503);}
      assert.equal(body.idempotency_key,createCalls[0].idempotency_key,'Unchanged funding retries must reuse the request key');
      const payment={id:pid,reference:'RR-WALLET-TEST-ONLY',amount_kobo:body.amount_kobo,direction:'collection',status:'pending',checkout_url:'https://pocketfi.ng/checkout/fixture-only',created_at:now()};workspace.payments=[payment];return send(payment);
    }
    if(body.action==='payment-refresh'){
      assert.deepEqual(Object.keys(body).sort(),['action','id']);
      if(denyOther||body.id!==pid)return send({error:'Payment not found.'},404);
      if(failRefresh){failRefresh=false;return send({error:'Payment provider is temporarily unavailable. Please retry.'},503);}
      workspace.payments[0].status=nextStatus;
      if(nextStatus==='succeeded'&&!workspace.transactions.length){workspace.wallet.available_kobo=123456;workspace.transactions=[{id:'00000000-0000-4000-8000-000000000804',kind:'deposit',label:'Business funds added',amount_kobo:123456,status:'completed',created_at:now(),reference:'RR-WALLET-TEST-ONLY'}];}
      return send({id:body.id,status:nextStatus});
    }
    return send({error:'Unexpected fixture action '+body.action},400);
  }
  return send({error:'Unexpected intercepted endpoint'},400);
});
const page=await context.newPage();page.on('pageerror',error=>results.pageErrors.push(error.message));
const add=()=>page.getByRole('button',{name:'Add funds',exact:true}),dialog=()=>page.getByRole('dialog');
try{
  for(const width of [360,390,430,768,1440]){
    await page.setViewportSize({width,height:width>=1000?1000:844});await page.goto(base+'/business/wallet');await add().waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await add().click();await dialog().waitFor();
    const rect=await dialog().boundingBox();assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,`Funding modal overflows ${width}`);
    results.layouts.push({width,route:'/business/wallet',pageOverflow:false,modalOverflow:false});
    if([390,1440].includes(width))await page.screenshot({path:path(`funding-modal-${width}.png`),fullPage:true});
    await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});assert.equal(await add().evaluate(node=>document.activeElement===node),true);pass(`${width}px: wallet and funding modal fit; Escape restores focus`);
  }
  await page.setViewportSize({width:390,height:844});await add().click();await dialog().getByLabel('Phone number',{exact:false}).fill('123');await dialog().getByRole('textbox',{name:'Amount',exact:true}).fill('1234.56');
  await dialog().getByRole('button',{name:'Continue securely'}).click();assert.equal(createCalls.length,0);assert.equal(await dialog().getByLabel('Phone number',{exact:false}).evaluate(input=>input.checkValidity()),false);pass('invalid phone is blocked before payment creation');
  await dialog().getByLabel('Phone number',{exact:false}).fill('+2348012345678');assert.equal(await dialog().getByLabel('Phone number',{exact:false}).evaluate(input=>input.checkValidity()),true);pass('international Nigerian phone format is accepted');
  await dialog().getByLabel('Phone number',{exact:false}).fill('0801 234 5678');assert.equal(await dialog().getByLabel('Phone number',{exact:false}).inputValue(),'08012345678');
  await dialog().getByRole('textbox',{name:'Amount',exact:true}).fill('1234.567');await dialog().getByRole('button',{name:'Continue securely'}).click();await dialog().getByRole('alert').filter({hasText:'two decimal places'}).waitFor();assert.equal(createCalls.length,0);pass('excess fractional precision never reaches payment provider');
  await dialog().getByRole('textbox',{name:'Amount',exact:true}).fill('1234.56');await dialog().getByRole('button',{name:'Continue securely'}).click();await dialog().getByRole('alert').filter({hasText:'interrupted'}).waitFor();assert.equal(await dialog().getByRole('textbox',{name:'Amount',exact:true}).inputValue(),'1234.56');pass('failed funding request retains amount and phone');
  await dialog().getByRole('button',{name:'Continue securely'}).click();await dialog().getByRole('link',{name:'Continue to payment'}).waitFor();assert.equal(createCalls.length,2);assert.equal(createCalls[0].idempotency_key,createCalls[1].idempotency_key);assert.equal(workspace.wallet.available_kobo,0);pass('funding uses exact kobo and one stable key across retry; checkout is not credit');
  await page.reload();await page.getByRole('button',{name:'Resume',exact:true}).waitFor();await page.getByRole('button',{name:'Resume',exact:true}).click();await dialog().getByRole('link',{name:'Continue to payment'}).waitFor();assert.equal(createCalls.length,2);pass('saved checkout resumes after reload without creating another intent');
  workspace.capabilities.payments=false;await dialog().getByRole('button',{name:'I’ve paid — check status'}).click();await dialog().getByText('Adding funds is unavailable. You can still check this payment’s status.',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Continue to payment'}).count(),0);assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).count(),0);assert.equal(createCalls.length,2);
  await page.keyboard.press('Escape');await page.reload();await page.getByText('Adding funds is unavailable.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).count(),0);assert.equal(await page.locator('a[href*="pocketfi.ng/checkout"]').count(),0);await page.getByRole('button',{name:'Check',exact:true}).waitFor();pass('disabling collection removes saved checkout links and open-dialog payment links while status checks remain available');
  workspace.capabilities.payments=true;await page.getByRole('button',{name:'Refresh wallet',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).waitFor();await page.getByRole('button',{name:'Resume',exact:true}).click();await dialog().getByRole('link',{name:'Continue to payment'}).waitFor();
  failRefresh=true;await dialog().getByRole('button',{name:'I’ve paid — check status'}).click();await dialog().getByRole('alert').filter({hasText:'temporarily unavailable'}).waitFor();assert.equal(workspace.wallet.available_kobo,0);pass('provider outage shows an error without fabricating credit');
  nextStatus='unknown';await dialog().getByRole('button',{name:'I’ve paid — check status'}).click();await dialog().getByText(/Please do not pay again/).waitFor();assert.equal(await dialog().getByRole('link',{name:'Continue to payment'}).count(),0);assert.equal(workspace.wallet.available_kobo,0);pass('unknown result retains zero credit and removes duplicate-payment link');
  await page.keyboard.press('Escape');await page.goto(base+`/business/wallet?payment=${pid}&status=succeeded&amount=99999999`);await page.getByText(/Please do not pay again/).waitFor();assert.equal(workspace.wallet.available_kobo,0);assert.equal(results.commands.filter(c=>c.action==='payment-refresh').at(-1).id,pid);pass('return URL is only a reference; forged success and amount are ignored');
  nextStatus='succeeded';workspace.account_hold=true;await page.getByRole('button',{name:'Check',exact:true}).click();await page.getByText('Payment confirmed. Your wallet has been updated.').waitFor();await page.getByText('Business funds added',{exact:true}).waitFor();assert.equal(await page.locator('.studio-balance-card>strong').innerText(),'₦1,234.56');assert.equal(workspace.wallet.available_kobo,123456);pass('confirmed response refreshes exact saved balance and transaction list');
  await page.getByText('WALLET BALANCE · SPENDING PAUSED',{exact:true}).waitFor();assert.equal(await page.getByText('Your funds are available.',{exact:true}).count(),0);pass('confirmed deposit under a financial hold does not claim the money is available to spend');workspace.account_hold=false;
  await page.getByRole('button',{name:'Added funds',exact:true}).click();await page.getByText('Business funds added',{exact:true}).waitFor();pass('transaction filter retains confirmed deposit');
  await page.reload();await page.getByText('Payment confirmed. Your wallet has been updated.').waitFor();assert.equal(workspace.transactions.length,1);pass('repeated return check does not duplicate the confirmed deposit');
  denyOther=true;await page.goto(base+'/business/wallet?payment=00000000-0000-4000-8000-000000000899');await page.getByRole('alert').filter({hasText:'Payment not found'}).waitFor();assert.equal(workspace.wallet.available_kobo,123456);pass('unauthorized return reference surfaces server rejection without changing funds');
  denyOther=false;nextStatus='failed';workspace.wallet.available_kobo=0;workspace.transactions=[];workspace.payments[0].status='pending';await page.goto(base+`/business/wallet?payment=${pid}`);await page.getByText(/This payment did not complete/).waitFor();assert.equal(workspace.wallet.available_kobo,0);pass('failed provider result displays a clear unpaid outcome');
  assert.deepEqual(results.pageErrors,[]);pass('no uncaught browser errors');
}catch(error){results.failure={name:error.name,message:error.message};console.error(error.message);process.exitCode=1;await page.screenshot({path:path('failure.png'),fullPage:true}).catch(()=>{});}
finally{await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));await context.close();await browser.close();console.log(JSON.stringify({checks:results.checks.length,layouts:results.layouts.length,failure:results.failure||null}));}
