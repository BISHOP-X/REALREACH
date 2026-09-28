const {chromium}=require(process.env.REALREACH_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const credentials=JSON.parse(fs.readFileSync('.local-credentials/pass12.json','utf8')).users;
const base=process.env.REALREACH_TEST_URL||'http://localhost:5174';
const out=path.resolve('outputs/qa/pass12');fs.mkdirSync(out,{recursive:true});
const results=[];const pass=name=>{results.push(name);console.log(`PASS ${name}`);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text());});
  await page.goto(base+'/earn');await page.waitForURL('**/login');pass('private workspace redirects anonymous visitor to login');
  await page.goto(base+'/signup?role=business');assert.equal(await page.getByRole('button',{name:'I’m a business Reach real people'}).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(out,'signup-mobile.png'),fullPage:true});pass('business signup selection and mobile auth screen');
  await page.goto(base+'/auth/callback?error=access_denied');await page.getByRole('alert').waitFor();pass('cancelled OAuth has recovery UI');
  await page.goto(base+'/reset-password');await page.getByText('This reset link is missing or expired.').waitFor();pass('missing password reset session cannot submit a password');
  const qa=credentials.find(c=>c.name==='a');
  await page.goto(base+'/login');await page.getByLabel('Email address',{exact:true}).fill(qa.email);await page.locator('input[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.waitForURL('**/account');await page.getByLabel('Your name',{exact:true}).waitFor();pass('real browser email/password sign-in reaches own account');
  await page.getByLabel('Your name',{exact:true}).fill('Amina Bello');await page.getByLabel('City',{exact:true}).fill('Lagos');await page.getByRole('button',{name:'Save profile'}).click();await page.getByText('Your profile is saved.').waitFor();
  await page.reload();await page.getByLabel('Your name',{exact:true}).waitFor();assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),'Amina Bello');pass('profile persists through actual Supabase write and browser reload');
  await page.goto(base+'/business/instagram');await page.getByRole('button',{name:'Connect Instagram',exact:true}).waitFor();await page.getByRole('button',{name:'Connect Instagram',exact:true}).click();await page.getByRole('alert').filter({hasText:'awaiting provider setup'}).waitFor();pass('real deployed Edge API missing-provider response rendered honestly');
  await page.screenshot({path:path.join(out,'instagram-pending-mobile.png'),fullPage:true});
  await page.goto(base+'/admin');await page.getByRole('heading',{name:'This space is restricted.'}).waitFor();pass('ordinary browser session cannot open admin front');
  const routes=['/earn','/business','/account','/earn/instagram','/business/instagram','/earn/wallet','/business/wallet'];
  for(const width of [360,390,430,768,1440]){
   await page.setViewportSize({width,height:width>=768?1000:844});
   for(const route of routes){await page.goto(base+route);await page.locator('.r-workspace').waitFor();await page.locator('h1').waitFor();
    const layout=await page.evaluate(()=>({body:document.body.innerText.length,overflow:document.documentElement.scrollWidth>innerWidth+1,overlay:!!document.querySelector('vite-error-overlay')}));
    assert.ok(layout.body>200,route);assert.equal(layout.overflow,false,`${route} overflow at ${width}`);assert.equal(layout.overlay,false);
   }
   if(width===390||width===1440){await page.goto(base+'/earn');await page.locator('.r-feature').waitFor();await page.screenshot({path:path.join(out,`overview-${width}.png`),fullPage:true});await page.goto(base+'/business/instagram');await page.getByRole('button',{name:'Connect Instagram',exact:true}).waitFor();await page.screenshot({path:path.join(out,`business-instagram-${width}.png`),fullPage:true});}
  }pass('35 authenticated page/viewport checks: content, no overflow, no Vite overlay');
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/account');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');await page.goto(base+'/earn');await page.waitForURL('**/login');pass('real browser sign-out clears access to protected routes');
  for(const width of [360,390,430,768,1440]){await page.setViewportSize({width,height:900});for(const route of ['/login','/signup','/forgot-password','/verify-email','/reset-password','/auth/callback','/help']){await page.goto(base+route);await page.locator('.r-auth-content').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${route} overflow at ${width}`);}}
  pass('35 public account page/viewport checks');
  await page.goto(base+'/demo/earn');await page.getByText('Sample data only · no real accounts or payments').waitFor();pass('legacy demo is separately labelled and isolated');
  assert.deepEqual(errors,[]);pass('no uncaught page errors in real-backend UI walkthrough');
  await context.close();

  // Controlled browser fixtures exercise states unavailable without Zernio/Google.
  // This context never calls the real Supabase backend.
  const mocked=await browser.newContext({viewport:{width:390,height:844}});
  const fakeId='11111111-1111-4111-8111-111111111111';
  const user={id:fakeId,aud:'authenticated',role:'authenticated',email:'fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const jwt=(aal='aal1')=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:fakeId,exp:Math.floor(Date.now()/1000)+3600,aal,role:'authenticated'})).toString('base64url')}.fixture`;
  const session={access_token:jwt(),refresh_token:'fixture-only',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
  let status='awaiting_identity',commandCount=0;
  const pilot={id:'22222222-2222-4222-8222-222222222222',business_id:'33333333-3333-4333-8333-333333333333',worker_id:fakeId,owner_id:'44444444-4444-4444-8444-444444444444',business_name:'Kora Living · fixture',instagram_username:'fixture_account',challenge:'RR-0123456789ABCDEF0123',reason:null,hold_until:null,expires_at:new Date(Date.now()+900000).toISOString(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  await mocked.addInitScript(session=>localStorage.setItem('realreach-auth-v1',JSON.stringify(session)),session);
  await mocked.route('https://jabwuawiqsusjrccapab.supabase.co/**',async route=>{
   const url=new URL(route.request().url()),method=route.request().method();let payload={};let code=200;
   if(url.pathname.endsWith('/settings'))payload={external:{google:true,email:true}};
   else if(url.pathname.includes('/auth/v1/factors'))payload={all:[],totp:[],phone:[]};
   else if(url.pathname.endsWith('/auth/v1/user'))payload=user;
   else if(url.pathname.endsWith('/profiles'))payload={id:fakeId,display_name:'Amina Bello',city:'Lagos',preferred_front:'worker'};
   else if(url.pathname.endsWith('/sole_admin'))payload=null;
   else if(url.pathname.endsWith('/instagram_pilots'))payload=[{...pilot,status,hold_until:status==='holding'?new Date(Date.now()+172800000).toISOString():null}];
   else if(url.pathname.endsWith('/instagram_evidence'))payload=[{id:'e',phase:'baseline',result:'negative',observed_at:new Date().toISOString()}];
   else if(url.pathname.endsWith('/realreach-api')){const body=route.request().postDataJSON();if(body.action==='check-pilot'){status='checking_action';commandCount++;payload={queued:true};}else payload={instagramConfigured:true,commentsEnabled:false};}
   else {throw new Error(`Unexpected fixture network route: ${method} ${url.pathname}`);}
   await route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(payload),headers:{'Access-Control-Allow-Origin':base}});
  });
  const simulated=await mocked.newPage();await simulated.goto(base+'/earn/instagram');await simulated.getByText(pilot.challenge,{exact:true}).waitFor();
  assert.equal(await simulated.getByRole('link',{name:'Open Instagram messages'}).getAttribute('href'),'https://ig.me/m/fixture_account');pass('fixture: exact challenge and Instagram DM handoff');
  await simulated.screenshot({path:path.join(out,'pilot-identity-fixture-mobile.png'),fullPage:true});
  status='ready';await simulated.reload();await simulated.getByRole('button',{name:'I followed · check now'}).click();await simulated.getByRole('heading',{name:'Checking the follow',exact:true}).waitFor();assert.equal(commandCount,1);pass('fixture: action submits a backend check, not a browser verdict');
  status='holding';await simulated.reload();await simulated.getByRole('heading',{name:'Follow observed',exact:true}).waitFor();await simulated.getByRole('button',{name:'View verification history'}).click();await simulated.getByText('baseline · negative').waitFor();pass('fixture: retention hold and evidence receipt render');
  status='needs_review';await simulated.reload();await simulated.getByRole('heading',{name:'A check needs attention',exact:true}).waitFor();pass('fixture: uncertain evidence remains unresolved');
  await mocked.close();
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:results,viewportChecks:70,note:'Real password/permissions flows plus explicitly mocked provider UI. No live Google, email delivery or Instagram verification claim.'},null,2));
  console.log(`Browser pass 1/2: ${results.length} groups passed.`);
 }finally{await browser.close();}
})().catch(error=>{let message=String(error.stack||error);for(const user of credentials)message=message.replaceAll(user.password,'[REDACTED]');console.error(message);process.exitCode=1;});
