import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { db, supabase, friendlyError, type Profile } from './client';
import { disableGoogleAutoSelect } from './googleIdentity';

type AuthState={user:User|null;profile:Profile|null;isAdmin:boolean;loading:boolean;error:string;refresh:()=>Promise<void>;signOut:()=>Promise<void>};
const Context=createContext<AuthState|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[isAdmin,setAdmin]=useState(false);
  const [sessionLoading,setSessionLoading]=useState(true),[profileLoading,setProfileLoading]=useState(false),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if (!supabase) {setSessionLoading(false);return;}
    let alive=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if (alive) {setUser(session?.user ?? null);setSessionLoading(false);}
    });
    void supabase.auth.getSession().then(({data,error})=>{if(alive){setUser(data.session?.user ?? null);setSessionLoading(false);if(error)setError(friendlyError(error));}});
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    let alive=true;
    setProfile(previous=>previous?.id===user?.id?previous:null);setAdmin(false);setError('');
    if (!user) {setProfileLoading(false);return;}
    setProfileLoading(true);
    void Promise.all([
      db().from('profiles').select('id,display_name,city,preferred_front,account_type').eq('id',user.id).single(),
      db().from('sole_admin').select('user_id').eq('user_id',user.id).maybeSingle(),
    ]).then(([p,a])=>{
      if (!alive)return;
      if(p.error || a.error)setError('We could not load your account. Please retry.');
      else {setProfile(p.data as Profile);setAdmin(!!a.data);}
    }).catch(e=>{if(alive)setError(friendlyError(e));}).finally(()=>{if(alive)setProfileLoading(false);});
    return ()=>{alive=false;};
  },[user?.id,revision]);
  async function signOut(){const {error}=await db().auth.signOut({scope:'local'});if(error)throw error;disableGoogleAutoSelect();setProfile(null);setAdmin(false);setUser(null);}
  const currentProfile=profile?.id===user?.id?profile:null;
  return <Context.Provider value={{user,profile:currentProfile,isAdmin:!!currentProfile&&isAdmin,loading:sessionLoading||profileLoading||!!(user&&!currentProfile&&!error),error,refresh:async()=>{setRevision(r=>r+1);},signOut}}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider required');return value;}
