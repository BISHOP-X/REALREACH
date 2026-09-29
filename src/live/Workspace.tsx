import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Compass, Home, Camera, LogOut, RefreshCw, ShieldCheck, UserRound, Wallet, Building2, ListChecks, Megaphone, Plus } from 'lucide-react';
import { Logo } from './Brand';
import { useAuth } from './AuthContext';
import { command, db, friendlyError, type Business, type Connection } from './client';
import { Notice } from './AuthPages';
import { accountHome, canUseFront, type AccountType } from './access';

export function Guard({children,front,onboarding=false}:{children:ReactNode;front?:AccountType|'admin';onboarding?:boolean}) {
  const auth=useAuth();
  if(auth.loading || (auth.user&&!auth.profile&&!auth.error))return <div className="r-loading" role="status"><Logo/><span>Opening your account…</span></div>;
  if(!auth.user)return <Navigate to="/login" replace/>;
  if(auth.error)return <div className="r-loading"><Notice error>{auth.error}</Notice><button className="r-button" onClick={()=>void auth.refresh()}>Retry</button></div>;
  const type=auth.profile?.account_type??null;
  if(front==='admin'&&!auth.isAdmin)return <Navigate to={accountHome(type)} replace/>;
  if(!onboarding&&!type&&!auth.isAdmin)return <Navigate to="/onboarding" replace/>;
  if(front&&!canUseFront(type,auth.isAdmin,front))return <Navigate to={accountHome(type)} replace/>;
  return children;
}
export function Workspace({children}:{children:ReactNode}){
  const auth=useAuth(),location=useLocation(),navigate=useNavigate(),[error,setError]=useState(''),[leaving,setLeaving]=useState(false);
  const front=location.pathname.startsWith('/business')?'business':location.pathname.startsWith('/admin')?'admin':location.pathname.startsWith('/earn')?'worker':auth.isAdmin?'admin':auth.profile?.account_type??'worker';
  const links=front==='admin'?[['/admin','Overview',ShieldCheck],['/account','Account',UserRound]] as const:front==='business'?[
    ['/business','Overview',Home],['/business/campaigns','Campaigns',Megaphone],['/business/wallet','Funds',Wallet],['/account','Account',UserRound],
  ] as const:[['/earn','Discover',Compass],['/earn/my-tasks','My tasks',ListChecks],['/earn/wallet','Wallet',Wallet],['/account','Account',UserRound]] as const;
  async function logout(){setLeaving(true);try{await auth.signOut();navigate('/login',{replace:true});}catch(e){setError(friendlyError(e));}finally{setLeaving(false);}}
  return <div className="r-workspace"><aside className="r-sidebar"><Logo/><span className="r-sidebar-label">{front==='business'?'BUSINESS':front==='admin'?'ADMIN':'YOUR ACCOUNT'}</span><nav aria-label="Workspace navigation">{links.map(([to,title,Icon])=><NavLink end key={to} to={to}><Icon size={19}/>{title}<ChevronRight size={14}/></NavLink>)}</nav><div className="r-sidebar-note"><ShieldCheck size={21}/><strong>Need a hand?</strong><Link to="/help">Visit help <ArrowUpRight size={14}/></Link></div><button className="r-signout" disabled={leaving} onClick={()=>void logout()}><LogOut size={18}/>{leaving?'Signing out…':'Sign out'}</button></aside>
    <div className="r-workspace-main"><header className="r-topbar"><div className="r-mobile-brand"><Logo/></div><div className="r-breadcrumb">RealReach <span>/</span><strong>{front==='business'?'Business':front==='admin'?'Admin':'Worker'}</strong></div><div className="r-top-actions">{auth.isAdmin&&<label className="r-switcher"><span className="r-sr">Switch workspace</span><select value={front} onChange={e=>navigate(e.target.value==='business'?'/business':e.target.value==='admin'?'/admin':'/earn')}><option value="worker">Worker</option><option value="business">Business</option><option value="admin">Admin</option></select></label>}<Link className="r-avatar" to="/account" aria-label="Your account">{auth.profile?.display_name.slice(0,1).toUpperCase()||<UserRound size={19}/>}</Link><button className="r-icon-button r-mobile-signout" aria-label="Sign out" disabled={leaving} onClick={()=>void logout()}><LogOut size={18}/></button></div></header>
    <main className="r-content">{error&&<Notice error>{error}</Notice>}{children}</main></div><nav className="r-bottomnav" aria-label="Mobile workspace navigation">{links.map(([to,title,Icon])=><NavLink end key={to} to={to}><Icon size={21}/><span>{title}</span></NavLink>)}</nav></div>;
}
export function PageHeading({kicker,title,text,children}:{kicker:string;title:string;text?:string;children?:ReactNode}){return <header className="r-page-heading"><div><span className="r-kicker">{kicker}</span><h1>{title}</h1>{text&&<p>{text}</p>}</div>{children}</header>;}
export function Panel({title,text,children,className=''}:{title?:string;text?:string;children:ReactNode;className?:string}){return <section className={`r-panel ${className}`}>{title&&<header><h2>{title}</h2>{text&&<p>{text}</p>}</header>}{children}</section>;}
export function EmptyState({icon:Icon=Compass,title,text,children}:{icon?:typeof Compass;title:string;text:string;children?:ReactNode}){return <div className="r-empty"><span><Icon size={28}/></span><h3>{title}</h3><p>{text}</p>{children}</div>;}
export function useBusiness(){
  const {user}=useAuth();const [business,setBusiness]=useState<Business|null>(null),[connection,setConnection]=useState<Connection|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
  useEffect(()=>{let alive=true;setLoading(true);setError('');setConnection(null);void (async()=>{
    const {data,error}=await db().from('businesses').select('id,name,owner_id').eq('owner_id',user!.id).maybeSingle();if(error)throw new Error(error.message);
    if(!alive)return;setBusiness(data);
    if(data){const result=await db().from('instagram_connections').select('id,business_id,owner_id,username,status,updated_at').eq('business_id',data.id).maybeSingle();if(result.error)throw new Error(result.error.message);if(alive)setConnection(result.data);}
  })().catch(e=>{if(alive)setError(friendlyError(e));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[user?.id,version]);
  return {business,connection,error,loading,reload:()=>setVersion(v=>v+1)};
}
export function Overview(){
  const {profile}=useAuth(),state=useBusiness();
  return <Workspace><PageHeading kicker="YOUR BUSINESS" title={profile?.display_name?`Hi, ${profile.display_name.split(' ')[0]}.`:'Welcome to RealReach.'} text={state.business?.name??'Manage your business.'}><Link className="r-button" to="/business/campaigns/new"><Plus size={18}/> New campaign</Link></PageHeading>
    {state.error&&<Notice error>{state.error}</Notice>}
    <section className="r-feature"><div><span className="r-pill"><Camera size={14}/> INSTAGRAM</span><h2>Your business.<br/>Meet your next followers.</h2><p>{state.connection?.status==='connected'?'Your Instagram is connected. Prepare your next campaign.':'Connect your Instagram to get started.'}</p><Link className="r-button r-button-lime" to="/business/instagram">{state.connection?.status==='connected'?'Manage Instagram':'Connect Instagram'}<ArrowRight size={18}/></Link></div><div className="r-feature-art" aria-hidden="true"><div className="r-orbit"/><div className="r-orbit r-orbit-two"/><div className="r-instagram-tile"><Camera size={56}/></div><span className="r-art-proof"><UsersIcon/> Real people. Real reach.</span><span className="r-art-dot"/></div></section>
    <div className="r-section-title"><h2>Your business, at a glance</h2></div><div className="r-readiness">{[
      {title:'Campaigns',text:'Create, edit and track your campaigns.',to:'/business/campaigns',Icon:Megaphone},
      {title:'Instagram',text:state.connection?.username?`@${state.connection.username}`:'Connect your Business or Creator account.',to:'/business/instagram',Icon:Camera},
      {title:'Funds',text:'Manage your campaign spending.',to:'/business/wallet',Icon:Wallet},
    ].map(({title,text,to,Icon})=><Link className="r-readiness-card" key={to} to={to}><span className="r-step"><Icon size={18}/></span><h3>{title}</h3><p>{text}</p><span className="r-card-link">Open <ArrowRight size={17}/></span></Link>)}</div>
  </Workspace>;
}
function UsersIcon(){return <UserRound size={18}/>;}
export function Discover({myTasks=false}:{myTasks?:boolean}){
  return <Workspace><PageHeading kicker={myTasks?'YOUR WORK':'INSTAGRAM TASKS'} title={myTasks?'My tasks':'Find your next task.'} text={myTasks?'Keep track of the work you’ve accepted.':'Choose a task. Read the rules. Make it count.'}/>
    {!myTasks&&<div className="rr-discover-banner"><Camera size={25}/><div><strong>A little time. A new opportunity.</strong><p>Every task will show its reward before you accept.</p></div></div>}
    <div className="r-section-title"><h2>{myTasks?'Accepted tasks':'Available tasks'}</h2><span>INSTAGRAM</span></div>
    <EmptyState icon={myTasks?ListChecks:Compass} title={myTasks?'No tasks accepted yet.':'No tasks available right now.'} text={myTasks?'Tasks you accept will appear here.':'Check back here for new tasks.'}>{myTasks&&<Link className="r-button r-button-outline" to="/earn">Find a task <ArrowRight size={17}/></Link>}</EmptyState>
    {!myTasks&&<div className="rr-task-tips"><h2>Before you start</h2><div><span>01</span><p>Read the reward and rules.</p></div><div><span>02</span><p>Use your own Instagram account.</p></div><div><span>03</span><p>Return to your task to check your work.</p></div></div>}
  </Workspace>;
}
function AdminBusinessForm({onSave}:{onSave:()=>void}){
  const auth=useAuth(),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(e:FormEvent){e.preventDefault();setBusy(true);try{const {error}=await db().rpc('rr_complete_onboarding',{p_type:'business',p_name:auth.profile?.display_name||'RealReach Admin',p_city:auth.profile?.city||'',p_business_name:name.trim()});if(error)throw new Error(error.message);onSave();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <Panel title="Business details"><form className="r-form" onSubmit={save}>{error&&<Notice error>{error}</Notice>}<label>Business name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><button className="r-button" disabled={busy}>Save business <ArrowRight size={18}/></button></form></Panel>;
}
export function BusinessInstagram(){
  const state=useBusiness(),auth=useAuth(),[params]=useSearchParams(),navigate=useNavigate();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmDisconnect,setConfirmDisconnect]=useState(false);
  const callback=params.get('attempt'),returnedError=params.get('error');
  async function action(name:string){setBusy(true);setError('');setNotice('');try{
    if(name==='connect-start'){const data=await command<{url:string}>(name);window.location.assign(data.url);return;}
    if(name==='connect-complete'){await command(name,{attempt:callback,state:params.get('rr_state'),accountId:params.get('accountId')});navigate('/business/instagram',{replace:true});setNotice('Instagram connected.');state.reload();}
    if(name==='disconnect'){await command(name);setConfirmDisconnect(false);state.reload();setNotice('Instagram disconnected.');}
  }catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <Workspace><PageHeading kicker="BUSINESS SETTINGS" title="Instagram" text="Connect the account you want to grow."/><div className="r-two-column"><div>
    {(error||state.error)&&<Notice error>{error||state.error}</Notice>}{notice&&<Notice>{notice}</Notice>}
    {returnedError&&<Notice error>Instagram wasn’t connected. You can try again.</Notice>}
    {state.loading?<Panel><p role="status">Loading…</p></Panel>:!state.business?(auth.isAdmin?<AdminBusinessForm onSave={state.reload}/>:<Notice error>Your business profile could not be found. Please contact support.</Notice>):<>
      <Panel className="r-connection-panel"><div className="r-connection-head"><span className="r-service-icon"><Camera size={27}/></span><div><span className="r-kicker">INSTAGRAM</span><h2>{state.connection?.username?`@${state.connection.username}`:state.business.name}</h2><span className={`r-status ${state.connection?.status==='connected'?'good':''}`}>{state.connection?.status==='connected'?'Connected':'Not connected'}</span></div></div><p>Use a Business or Creator account you own. Your Instagram password is never shared with RealReach.</p>
      {callback&&!returnedError?<button className="r-button" disabled={busy} onClick={()=>void action('connect-complete')}>{busy?'Connecting…':'Finish connecting'}<ShieldCheck size={18}/></button>:<button className="r-button" disabled={busy} onClick={()=>void action('connect-start')}>{busy?'Opening Instagram…':state.connection?.status==='connected'?'Reconnect Instagram':'Connect Instagram'}<ArrowUpRight size={18}/></button>}</Panel>
      {state.connection?.status==='connected'&&<Panel title="Disconnect Instagram"><p>Task checks will stop until you reconnect.</p>{confirmDisconnect?<Notice><p>Are you sure?</p><div className="r-button-row"><button className="r-button r-button-danger" disabled={busy} onClick={()=>void action('disconnect')}>Disconnect</button><button className="r-text-button" onClick={()=>setConfirmDisconnect(false)}>Cancel</button></div></Notice>:<button className="r-text-button" onClick={()=>setConfirmDisconnect(true)}>Disconnect</button>}</Panel>}
    </>}
    </div><aside><Panel className="r-guide-panel" title="A quick connection"><ol className="r-guide"><li><span>1</span><div><strong>Sign in to Instagram</strong><p>Choose the account you own.</p></div></li><li><span>2</span><div><strong>Allow access</strong><p>Review the permissions on Instagram.</p></div></li><li><span>3</span><div><strong>Return to RealReach</strong><p>We’ll confirm when it’s connected.</p></div></li></ol></Panel></aside></div></Workspace>;
}
export function WalletPage(){
  const business=useLocation().pathname.startsWith('/business');
  return <Workspace><PageHeading kicker={business?'BUSINESS':'YOUR ACCOUNT'} title={business?'Funds':'Wallet'} text={business?'Your campaign payments and receipts.':'Your earnings and withdrawals.'}/><section className="r-wallet-placeholder"><span className="r-icon-large"><Wallet size={32}/></span><h2>Payments are unavailable.</h2><p>{business?'You can save a campaign draft. You won’t be charged until payments are available.':'Deposits and withdrawals are not available yet.'}</p><Link className="r-button r-button-outline" to={business?'/business/campaigns':'/earn'}>{business?'View campaigns':'Back to tasks'}<ArrowRight size={17}/></Link></section></Workspace>;
}
export function AccountPage(){
  const auth=useAuth(),[name,setName]=useState(auth.profile?.display_name??''),[city,setCity]=useState(auth.profile?.city??''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{const {data,error}=await db().from('profiles').update({display_name:name.trim(),city:city.trim()}).eq('id',auth.user!.id).select('id').single();if(error||!data)throw new Error(error?.message??'Your profile could not be saved.');await auth.refresh();setMessage('Changes saved.');}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <Workspace><PageHeading kicker="YOUR ACCOUNT" title="Account settings"/><div className="r-two-column"><div><Panel title="Your details">{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}<form className="r-form" onSubmit={save}><label>Your name<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label><label>Email address<input type="email" readOnly value={auth.user?.email??''}/></label><label>City<input maxLength={80} autoComplete="address-level2" placeholder="e.g. Lagos" value={city} onChange={e=>setCity(e.target.value)}/></label><button className="r-button" disabled={busy}>{busy?'Saving…':'Save changes'}<Check size={18}/></button></form></Panel><SecurityPanel/></div><aside><Panel className="r-guide-panel" title={auth.isAdmin?'Administrator account':auth.profile?.account_type==='business'?'Business account':'Worker account'}><p>{auth.isAdmin?'You can open the admin, business and worker screens.':'Your account type was chosen at signup. Contact us if you need to change it.'}</p>{auth.profile?.account_type==='business'&&<Link className="r-text-button" to="/business/instagram">Manage Instagram <ArrowRight size={17}/></Link>}<Link className="r-button r-button-outline" to="/help">Get help <ArrowUpRight size={17}/></Link></Panel></aside></div></Workspace>;
}
export function SecurityPanel({onVerified}:{onVerified?:()=>void}){
  const [factor,setFactor]=useState<string|null>(null),[qr,setQr]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[verified,setVerified]=useState(false),[loaded,setLoaded]=useState(false);
  useEffect(()=>{let alive=true;void db().auth.mfa.listFactors().then(({data,error})=>{if(!alive)return;if(error)setError(friendlyError(error));else setFactor(data.totp.find(f=>f.status==='verified')?.id??null);setLoaded(true);});return()=>{alive=false;};},[]);
  async function enroll(){setBusy(true);setError('');try{const {data,error}=await db().auth.mfa.enroll({factorType:'totp',friendlyName:`RealReach ${new Date().toISOString().slice(0,19)}`});if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  async function verify(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await db().auth.mfa.challengeAndVerify({factorId:factor!,code});if(error)throw error;setVerified(true);setQr('');setCode('');onVerified?.();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <Panel title="Two-step sign-in" text="Protect your account with an authenticator app.">{error&&<Notice error>{error}</Notice>}{verified?<Notice>You’re verified.</Notice>:!loaded?<p role="status">Checking account security…</p>:factor?<form className="r-form" onSubmit={verify}>{qr&&<div className="r-qr"><img alt="Scan this QR code with your authenticator app" src={qr.startsWith('data:')?qr:`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}/><p>Scan with your authenticator app, then enter its six-digit code.</p></div>}<label>Authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button className="r-button r-button-outline" disabled={busy}>{busy?'Verifying…':'Verify authenticator'}<ShieldCheck size={18}/></button></form>:<button className="r-button r-button-outline" disabled={busy} onClick={()=>void enroll()}>{busy?'Preparing…':'Set up authenticator'}<ShieldCheck size={18}/></button>}<Link className="r-text-button" to="/forgot-password">Reset your password<ArrowRight size={16}/></Link></Panel>;
}

export function AdminPage(){
  const [state,setState]=useState<{jobs:Array<{id:string;phase:string;state:string;attempts:number}>;instagramConfigured:boolean}|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let alive=true;command<typeof state>('admin-status').then(data=>{if(alive){setState(data);setError('');}}).catch(e=>{if(alive)setError(friendlyError(e));});return()=>{alive=false;};},[revision]);
  return <Workspace><PageHeading kicker="ADMIN" title="Operations" text="Account access and service status."/>{error&&<Notice error>{error}</Notice>}<div className="r-two-column"><div>{state?<><Panel title="Services"><p>Instagram: <strong>{state.instagramConfigured?'Configured':'Not connected — Zernio setup required'}</strong></p><p>Payments: <strong>Not connected — PocketFi setup required</strong></p></Panel><Panel title="Recent checks">{state.jobs.length?state.jobs.map(job=><div className="r-job" key={job.id}><strong>{job.phase}</strong><span>{job.state}</span><small>{job.attempts} attempt(s)</small></div>):<EmptyState icon={ListChecks} title="No checks yet." text="Verification activity will appear here."/>}</Panel></>:<Panel title="Confirm it’s you"><p>Enter your authenticator code to open admin controls.</p></Panel>}</div><aside><SecurityPanel onVerified={()=>setRevision(v=>v+1)}/><button className="r-button r-button-outline" onClick={()=>setRevision(v=>v+1)}>Refresh <RefreshCw size={17}/></button></aside></div></Workspace>;
}
