import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { AuthFrame, Notice } from './AuthPages';
import { useAuth } from './AuthContext';
import { db, friendlyError } from './client';
import { accountHome, type AccountType } from './access';

export function StartPage(){const auth=useAuth();return <Navigate replace to={accountHome(auth.profile?.account_type??null,auth.isAdmin)}/>;}
export function Onboarding(){
  const auth=useAuth(),navigate=useNavigate();
  const [type,setType]=useState<AccountType>(()=>sessionStorage.getItem('rr-onboarding-front')==='business'?'business':'worker');
  const [name,setName]=useState(auth.profile?.display_name??''),[business,setBusiness]=useState(''),[city,setCity]=useState(auth.profile?.city??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const {error}=await db().rpc('rr_complete_onboarding',{p_type:type,p_name:name.trim(),p_city:city.trim(),p_business_name:business.trim()});
    if(error)throw new Error(error.message);
    sessionStorage.removeItem('rr-onboarding-front');await auth.refresh();
  }catch(e){setError(friendlyError(e));setBusy(false);}}
  if(auth.profile?.account_type)return <Navigate to={accountHome(auth.profile.account_type,auth.isAdmin)} replace/>;
  return <AuthFrame><span className="r-kicker">ONE LAST STEP</span><h1>Make it yours.</h1><p className="r-lead">Choose your account type and add your details.</p>{error&&<Notice error>{error}</Notice>}<form className="r-form" onSubmit={submit}><div className="r-role-options" aria-label="Account type">{(['worker','business'] as const).map(t=><button type="button" key={t} disabled={busy} aria-pressed={t===type} onClick={()=>setType(t)}><span className="r-choice-dot">{t===type&&<Check size={12}/>}</span><strong>{t==='worker'?'Worker':'Business'}</strong><small>{t==='worker'?'Find tasks and earn':'Create campaigns'}</small></button>)}</div><label>Your name<input required minLength={2} maxLength={80} autoComplete="name" value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>{type==='business'&&<label>Business name<input required minLength={2} maxLength={100} autoComplete="organization" value={business} disabled={busy} onChange={e=>setBusiness(e.target.value)}/></label>}<label>City <small>Optional</small><input maxLength={80} autoComplete="address-level2" value={city} disabled={busy} onChange={e=>setCity(e.target.value)}/></label><p className="r-small">Your account type is fixed after this step. Contact us if you need to change it.</p><button className="r-button" disabled={busy}>{busy?'Saving your account…':`Continue as ${type==='business'?'a business':'a worker'}`}<ArrowRight size={18}/></button></form><button className="r-text-button" disabled={busy} onClick={()=>void auth.signOut().then(()=>navigate('/login')).catch(e=>setError(friendlyError(e)))}>Sign out</button></AuthFrame>;
}
