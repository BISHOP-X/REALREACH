import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import {friendlyError} from './client';
import {marketplaceRequest} from './marketplace';

export type ListResource='feed'|'assignments'|'campaigns'|'transactions'|'payments'|'notifications'|'cases';
type Page<T>={items:T[];next_cursor:string|null};

/** Owner-scoped server pagination; local snapshots are not a complete history. */
export function useMarketplaceList<T extends {id:string}>(resource:ListResource,filter='all',query=''){
  const {user,profile,isAdmin,loading:authLoading}=useAuth();
  const [view,setView]=useState<{key:string|null;items:T[];nextCursor:string|null;loading:boolean;error:string}>({key:null,items:[],nextCursor:null,loading:true,error:''});
  const [revision,setRevision]=useState(0);
  const [search,setSearch]=useState(query.trim());
  const generation=useRef(0),busy=useRef(false),controller=useRef<AbortController|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>setSearch(query.trim()),250);return()=>clearTimeout(timer);},[query]);
  const enabled=!!user&&!authLoading&&!!profile&&(!!profile.account_type||isAdmin);
  const key=enabled?JSON.stringify([user.id,profile.account_type,isAdmin,resource,filter,search]):null;
  const fetchPage=useCallback(async(cursor:string|null)=>{
    if(!key||!user||busy.current)return;
    busy.current=true;
    setView(previous=>({key,items:previous.key===key?previous.items:[],nextCursor:previous.key===key?previous.nextCursor:null,loading:true,error:''}));
    const current=generation.current;
    const request=new AbortController();controller.current=request;
    try{
      const page=await marketplaceRequest<Page<T>>('list',{resource,filter,query:search,...(cursor?{cursor}:{})},request.signal,user.id);
      if(current!==generation.current)return;
      setView(previous=>({key,items:cursor&&previous.key===key?[...new Map([...previous.items,...page.items].map(item=>[item.id,item])).values()]:page.items,nextCursor:page.next_cursor,loading:false,error:''}));
    }catch(cause){if(current===generation.current&&!request.signal.aborted)setView(previous=>({...previous,error:friendlyError(cause)}));}
    finally{if(current===generation.current){busy.current=false;controller.current=null;setView(previous=>({...previous,loading:false}));}}
  },[key,user?.id,resource,filter,search]);
  useEffect(()=>{
    generation.current++;controller.current?.abort();busy.current=false;setView({key,items:[],nextCursor:null,loading:!!key,error:''});
    if(key)void fetchPage(null);
    return()=>{generation.current++;controller.current?.abort();};
  },[fetchPage,key,revision]);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  const {items,nextCursor,loading,error}=key&&view.key===key?view:{items:[],nextCursor:null,loading:!!key,error:''};
  const loadMore=()=>{if(nextCursor)void fetchPage(nextCursor);};
  return {items,loading,error,nextCursor,loadMore,refresh};
}
