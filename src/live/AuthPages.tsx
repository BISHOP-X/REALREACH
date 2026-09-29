import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Mail, ArrowLeft, Sparkles } from 'lucide-react';
import { Logo } from './Brand';
import { configured, db, friendlyError } from './client';
import { useAuth } from './AuthContext';
import { GoogleSignIn } from './GoogleSignIn';

export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){return <div className={`r-notice ${error?'is-error':''}`} role={error?'alert':'status'}>{children}</div>;}
export function AuthFrame({children}:{children:ReactNode}){
  return <div className="r-auth"><aside className="r-auth-story"><Logo light/><div className="r-auth-story-copy"><span className="r-kicker">A more human kind of growth</span><h1>Real people.<br/>Real possibilities.</h1><p>Instagram growth, powered by people.</p><div className="r-story-note"><ShieldCheck size={22}/><span><strong>Never share your Instagram password.</strong></span></div></div><div className="r-story-foot"><span>Made for Nigeria.</span><span>REAL PEOPLE. REALREACH.</span></div></aside><main className="r-auth-main"><div className="r-mobile-brand"><Logo/></div><div className="r-auth-content">{children}</div><footer className="r-auth-footer"><Link to="/privacy">Privacy</Link><span>© {new Date().getFullYear()} RealReach</span><Link to="/help">Need a hand?</Link></footer></main></div>;
}
export function AuthPage({mode}:{mode:'login'|'signup'|'forgot'|'verify'|'reset'}){
  const auth=useAuth(),navigate=useNavigate(),[params]=useSearchParams();
  const [front,setFront]=useState(params.get('role')==='business'?'business':'worker');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const callback=()=>`${window.location.origin}/auth/callback`;
  const title={login:'Welcome back.',signup:'Make your next move.',forgot:'Let’s get you back in.',verify:'Check your inbox.',reset:'A fresh start.'}[mode];
  const description={login:'Sign in to your RealReach account.',signup:'Choose an account to get started.',forgot:'We’ll send you a secure link to reset your password.',verify:'Open the confirmation link in your email to finish creating your account.',reset:'Choose a strong password that you don’t use anywhere else.'}[mode];
  async function submit(e:FormEvent){e.preventDefault();setError('');setBusy(true);try{
    if(mode==='login') {const {error}=await db().auth.signInWithPassword({email,password});if(error)throw error;navigate('/start',{replace:true});}
    if(mode==='signup') {sessionStorage.setItem('rr-onboarding-front',front);const {data,error}=await db().auth.signUp({email,password,options:{emailRedirectTo:callback()}});if(error)throw error;navigate(data.session?'/start':'/verify-email');}
    if(mode==='forgot') {const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:`${callback()}?flow=recovery`});if(error)throw error;setSent(true);}
    if(mode==='verify') {const {error}=await db().auth.resend({type:'signup',email,options:{emailRedirectTo:callback()}});if(error)throw error;setSent(true);}
    if(mode==='reset') {if(!auth.user)throw new Error('Open a new reset link from your email first.');const {error}=await db().auth.updateUser({password});if(error)throw error;setPassword('');setSent(true);}
  }catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  if(!auth.loading && auth.user && (mode==='login'||mode==='signup'||mode==='verify'))return <Navigate to="/start" replace/>;
  return <AuthFrame><Link to="/" className="r-back"><ArrowLeft size={15}/> Back to RealReach</Link><span className="r-kicker">{mode==='signup'?'YOUR NEXT CHAPTER':mode==='login'?'GOOD TO SEE YOU':'ACCOUNT SECURITY'}</span><h1>{title}</h1><p className="r-lead">{description}</p>
    {mode==='signup'&&<div className="r-role-options" aria-label="Choose your account type">{[['worker','I want to earn','Discover opportunities'],['business','I’m a business','Reach real people']].map(([value,title,sub])=><button type="button" key={value} aria-pressed={front===value} onClick={()=>setFront(value)}><span className="r-choice-dot">{front===value&&<Check size={12}/>}</span><strong>{title}</strong><small>{sub}</small></button>)}</div>}
    {!configured&&<Notice error>Sign-in is unavailable. Please try again later.</Notice>}
    {error&&<Notice error>{error}</Notice>}
    {sent?<div className="r-success"><span><Mail/></span><h2>{mode==='reset'?'Password updated.':'Request received.'}</h2><p>{mode==='reset'?'Your new password is ready to use.':'If this address is eligible, an email will arrive shortly. Check spam too. For your privacy, we don’t disclose which addresses have accounts.'}</p><Link className="r-button" to={mode==='reset'?'/start':'/login'}>{mode==='reset'?'Back to your account':'Back to login'}<ArrowRight size={17}/></Link></div>:<>
    {mode==='signup'&&<p className="r-signup-terms">By creating an account with Google or email, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>}
    {(mode==='login'||mode==='signup')&&<><GoogleSignIn mode={mode} front={front} disabled={busy} onBusy={setBusy}/><div className="r-divider"><span>or continue with email</span></div></>}
    {mode==='reset'&&!auth.loading&&!auth.user?<Notice error>This reset link is missing or expired. <Link to="/forgot-password">Request a new link</Link>.</Notice>:<form onSubmit={submit} className="r-form">
      {mode!=='reset'&&<label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>}
      {(mode==='login'||mode==='signup'||mode==='reset')&&<label>Password<div className="r-password"><input type={show?'text':'password'} name="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:12} maxLength={128} placeholder={mode==='login'?'Your password':'At least 12 characters'} value={password} required onChange={e=>setPassword(e.target.value)} disabled={busy}/><button type="button" aria-label={show?'Hide password':'Show password'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>}
      {mode==='login'&&<Link className="r-forgot" to="/forgot-password">Forgot password?</Link>}
      <button className="r-button" disabled={busy||!configured}>{busy?'Please wait…':{login:'Log in',signup:'Create my account',forgot:'Send reset link',verify:'Resend confirmation',reset:'Save new password'}[mode]}{!busy&&<ArrowRight size={18}/>}</button>
    </form>}
    </>}
    {(mode==='login'||mode==='signup')&&<p className="r-auth-switch">{mode==='login'?'New to RealReach?':'Already have an account?'} <Link to={mode==='login'?'/signup':'/login'}>{mode==='login'?'Create an account':'Log in'}</Link></p>}
    <p className="r-auth-trust"><ShieldCheck size={15}/> Your Instagram password stays with Instagram.</p>
  </AuthFrame>;
}

const exchanges=new Map<string,Promise<unknown>>();
export function AuthCallback(){
  const [params]=useSearchParams(),navigate=useNavigate(),[error,setError]=useState('');
  const code=params.get('code'),providerError=params.get('error'),flow=params.get('flow');
  useEffect(()=>{let alive=true;
    if(providerError || !code){setError(providerError?'Sign-in was cancelled or could not be completed.':'This link is incomplete or expired. Please start again.');return;}
    let pending=exchanges.get(code);
    if(!pending){pending=db().auth.exchangeCodeForSession(code).then(({error})=>{if(error)throw error;});exchanges.set(code,pending);}
    pending.then(()=>{if(alive)navigate(flow==='recovery'?'/reset-password':'/start',{replace:true});}).catch(()=>{if(alive)setError('This link expired, was already used, or was opened in a different browser. Request a new link in this browser.');});
    return()=>{alive=false;};
  },[code,providerError,flow,navigate]);
  return <AuthFrame><span className="r-icon-large"><Sparkles/></span><h1>{error?'Let’s try that again.':'Opening your account.'}</h1>{error?<><Notice error>{error}</Notice><Link className="r-button" to="/login">Return to login<ArrowRight size={18}/></Link></>:<p role="status">Completing your secure sign-in…</p>}</AuthFrame>;
}
