// Local, intercepted UI checks. No accounts are created and no email is sent.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';

const require=createRequire(import.meta.url);
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
assert.equal(new URL(base).hostname,'localhost');
const out = fileURLToPath(new URL('../outputs/qa/auth-continuity/', import.meta.url));
await mkdir(out,{recursive:true});
const results={mode:'isolated HTTP UI fixtures; no live accounts, email, or provider proof',checks:[],layouts:[],pageErrors:[]};
const record=name=>{results.checks.push(name);console.log('PASS '+name);};
const pendingKey='rr-pending-signup-email';
const userId='00000000-0000-4000-8000-000000000091';
const user={id:userId,aud:'authenticated',role:'authenticated',email:'confirmation@ui-test.invalid',email_confirmed_at:new Date().toISOString(),user_metadata:{},app_metadata:{provider:'email',providers:['email']},created_at:new Date().toISOString()};
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${part({alg:'HS256',typ:'JWT'})}.${part({sub:userId,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.local-ui-fixture`;
const session={access_token:token,refresh_token:'local-ui-fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
let resendFails=false,signupFails=false,callbackFails=false,lastResend='';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
// The GIS implementation is not changed or tested live here; its browser asset is isolated.
await context.addInitScript(()=>{window.google={accounts:{id:{initialize(){},renderButton(element){const button=document.createElement('button');button.type='button';button.textContent='Continue with Google';element.append(button);},disableAutoSelect(){}}}};});
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base)return route.continue();
  if(url.hostname!=='jabwuawiqsusjrccapab.supabase.co')return route.abort();
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
  if(request.method()==='OPTIONS')return send({});
  if(url.pathname==='/auth/v1/settings')return send({external:{google:true,email:true},disable_signup:false});
  if(url.pathname==='/auth/v1/signup')return signupFails?send({msg:'Email delivery is unavailable',code:'over_email_send_rate_limit'},429):send({...user,email_confirmed_at:undefined,identities:[]});
  if(url.pathname==='/auth/v1/resend'){lastResend=request.postDataJSON().email;return resendFails?send({msg:'Email sending limit reached',code:'over_email_send_rate_limit'},429):send({});}
  if(url.pathname==='/auth/v1/recover')return send({});
  if(url.pathname==='/auth/v1/token')return callbackFails?send({msg:'Expired authorization code',code:'bad_code_verifier'},400):send(session);
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/auth/v1/logout')return send({});
  if(url.pathname==='/rest/v1/profiles')return send({id:userId,display_name:'',city:'',preferred_front:'worker',account_type:null});
  if(url.pathname==='/rest/v1/sole_admin')return send([]);
  return send({error:'Unexpected isolated endpoint'},400);
});
const page=await context.newPage();page.on('pageerror',e=>results.pageErrors.push(e.message));
try{
  await page.goto(base+'/signup?role=business');
  await page.getByLabel('Email address',{exact:true}).fill('confirmation@ui-test.invalid');
  await page.getByLabel('Password',{exact:true}).fill('UI-only-password-71!');
  await page.getByRole('button',{name:'Create my account',exact:true}).click();
  await page.waitForURL('**/verify-email');
  assert.equal(await page.getByLabel('Email address',{exact:true}).inputValue(),'confirmation@ui-test.invalid');
  assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),'confirmation@ui-test.invalid');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('rr-onboarding-front')),'business');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('UI-only-password-71!')),false);
  record('Successful signup reaches prefilled confirmation; account hint remains and password is not stored');
  await page.reload();assert.equal(await page.getByLabel('Email address',{exact:true}).inputValue(),'confirmation@ui-test.invalid');
  record('Confirmation email survives a same-tab refresh');
  const other=await context.newPage();await other.goto(base+'/verify-email');assert.equal(await other.getByLabel('Email address',{exact:true}).inputValue(),'');await other.close();
  record('An independently opened tab does not inherit the pending email');
  resendFails=true;await page.getByRole('button',{name:'Resend confirmation',exact:true}).click();await page.getByRole('alert').filter({hasText:'Email delivery'}).waitFor();
  assert.equal(await page.getByLabel('Email address',{exact:true}).inputValue(),'confirmation@ui-test.invalid');assert.equal(await page.getByRole('button',{name:'Resend confirmation',exact:true}).isEnabled(),true);
  record('A resend failure retains the address, shows an error and allows retry');
  resendFails=false;await page.getByLabel('Email address',{exact:true}).fill('corrected@ui-test.invalid');await page.getByRole('button',{name:'Resend confirmation',exact:true}).click();await page.getByRole('heading',{name:'Request received.'}).waitFor();
  assert.equal(lastResend,'corrected@ui-test.invalid');assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),'corrected@ui-test.invalid');
  await page.getByText('If this address is eligible, an email will arrive shortly.',{exact:false}).waitFor();
  record('Resend uses the corrected address and retains account-enumeration-safe wording');
  signupFails=true;await page.goto(base+'/signup');await page.getByLabel('Email address',{exact:true}).fill('failed@ui-test.invalid');await page.getByLabel('Password',{exact:true}).fill('UI-only-password-71!');await page.getByRole('button',{name:'Create my account',exact:true}).click();await page.getByRole('alert').filter({hasText:'Email delivery'}).waitFor();
  assert.ok(page.url().endsWith('/signup'));assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),'corrected@ui-test.invalid');signupFails=false;
  record('Failed signup does not claim confirmation success or replace a pending address');
  await page.goto(base+'/login');await page.getByLabel('Email address',{exact:true}).fill('confirmation@ui-test.invalid');await page.getByLabel('Password',{exact:true}).fill('UI-only-password-71!');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL('**/onboarding');await page.getByRole('heading',{name:'Make it yours.'}).waitFor();
  assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),null);
  record('Successful sign-in clears the pending email and preserves real onboarding routing');
  await page.evaluate(()=>{localStorage.removeItem('realreach-auth-v1');sessionStorage.setItem('rr-pending-signup-email','callback@ui-test.invalid');localStorage.setItem('realreach-auth-v1-code-verifier',JSON.stringify('local-fixture-verifier'));});
  callbackFails=true;await page.goto(base+'/auth/callback?code=expired-ui-fixture');await page.getByRole('alert').filter({hasText:'This link expired'}).waitFor();assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),'callback@ui-test.invalid');
  record('An expired confirmation link keeps the address available for retry');
  callbackFails=false;await page.evaluate(()=>localStorage.setItem('realreach-auth-v1-code-verifier',JSON.stringify('local-fixture-verifier')));await page.goto(base+'/auth/callback?code=valid-ui-fixture');await page.waitForURL('**/onboarding');assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),null);
  record('A successful confirmation exchange clears the pending email');
  await page.evaluate(()=>localStorage.removeItem('realreach-auth-v1'));await page.goto(base+'/forgot-password');await page.getByLabel('Email address',{exact:true}).fill('unknown@ui-test.invalid');await page.getByRole('button',{name:'Send reset link',exact:true}).click();await page.getByRole('heading',{name:'Request received.'}).waitFor();
  record('Password recovery still gives a privacy-safe response');
  await page.goto(base+'/reset-password');await page.getByRole('alert').filter({hasText:'This reset link is missing or expired'}).waitFor();assert.equal(await page.getByLabel('Password',{exact:true}).count(),0);
  record('Unauthenticated reset pages do not offer password changes');
  for(const width of [360,390,1440]){
    await page.setViewportSize({width,height:width===1440?1000:844});
    for(const path of ['/signup','/login','/verify-email','/help','/terms','/privacy']){
      await page.goto(base+path);await page.getByRole('heading',{level:1}).last().waitFor();
      assert.equal(await page.getByRole('heading',{name:'Let’s get you back.',exact:true}).count(),0,`${path} rendered the error boundary at ${width}px`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${path} overflow at ${width}`);
      if(['/help','/terms'].includes(path))assert.doesNotMatch(await page.locator('main').innerText(),/not available yet|no paid tasks available|demo|pilot/i);
      results.layouts.push({path,width});
      if(width===390&&['/verify-email','/help'].includes(path))await page.screenshot({path:`${out}/${path.slice(1)}-${width}.png`,fullPage:true});
    }
  }
  record('Signup, login, confirmation and all help/legal pages fit 360/390/1440px without stale unavailable copy');
  assert.deepEqual(results.pageErrors,[]);record('No uncaught browser errors');
}catch(error){results.failure=error.message;await page.screenshot({path:out+'/failure.png',fullPage:true});process.exitCode=1;console.error(error);}finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close();}
