import { digest, randomToken, ProviderError } from '../_shared/instagram.ts';
import { identity, provider, reply, requireProvider, origins, must } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return reply(req,{ok:true});
  if (req.method!=='POST') return reply(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('origin');
  if (origin && !origins().includes(origin)) return reply(req,{error:'Origin not allowed'},403);
  try {
    if (Number(req.headers.get('content-length') ?? 0)>8192) return reply(req,{error:'Request too large'},413);
    const raw=await req.text();
    if (raw.length>8192) return reply(req,{error:'Request too large'},413);
    const body=JSON.parse(raw);
    if (body.action==='capabilities') return reply(req,{instagramConfigured:!!Deno.env.get('ZERNIO_API_KEY'),livePayments:false,commentsEnabled:false});
    const { db,user,token }=await identity(req);
    const admin=must(await db.from('sole_admin').select('user_id').eq('user_id',user.id).maybeSingle());
    if (body.action==='access') return reply(req,{isAdmin:!!admin});
    if (body.action==='admin-status') {
      if (!admin) throw new ProviderError(403,'This workspace is restricted.');
      const { data: claims,error }=await db.auth.getClaims(token);
      if (error || claims?.claims.aal!=='aal2') throw new ProviderError(403,'Verify your authenticator before opening administration.');
      const jobs=must(await db.from('instagram_jobs').select('id,phase,state,attempts,due_at').order('due_at',{ascending:false}).limit(30));
      return reply(req,{jobs,instagramConfigured:!!Deno.env.get('ZERNIO_API_KEY'),livePayments:false});
    }
    if (body.action==='join-pilot') {
      requireProvider();
      if (typeof body.invite!=='string' || !/^[a-f0-9]{64}$/.test(body.invite)) throw new ProviderError(400,'Enter a valid pilot invitation code.');
      const id=must(await db.rpc('rr_claim_pilot',{p_actor:user.id,p_hash:await digest(body.invite),p_challenge:`RR-${randomToken().slice(0,20).toUpperCase()}`}));
      return reply(req,{id});
    }
    if (body.action==='check-pilot') {
      requireProvider();
      if (typeof body.id!=='string' || !/^[0-9a-f-]{36}$/.test(body.id)) throw new ProviderError(400,'Invalid pilot.');
      must(await db.rpc('rr_request_check',{p_actor:user.id,p_pilot:body.id}));
      return reply(req,{queued:true});
    }
    const business=must(await db.from('businesses').select('id,name,owner_id').eq('owner_id',user.id).maybeSingle());
    if (!business) throw new ProviderError(409,'Create your business profile first.');
    if (!['connect-start','connect-complete','invite-create','disconnect'].includes(body.action)) throw new ProviderError(400,'Unknown request.');
    requireProvider();
    const allowed=(Deno.env.get('RR_PILOT_BUSINESS_IDS') ?? '').split(',');
    if (!allowed.includes(business.id)) throw new ProviderError(403,'Your business is saved. The team must enable it for the controlled Instagram pilot.');
    let connection=must(await db.from('instagram_connections').select('*').eq('business_id',business.id).maybeSingle());
    if (body.action==='connect-start') {
      const recent=must(await db.from('instagram_connect_attempts').select('id').eq('owner_id',user.id).gt('created_at',new Date(Date.now()-60_000).toISOString()));
      if (recent?.length) throw new ProviderError(429,'Please wait a minute before starting another connection.');
      if (!connection) connection=must(await db.from('instagram_connections').upsert({business_id:business.id,owner_id:user.id},{onConflict:'business_id',ignoreDuplicates:true}).select().maybeSingle()) ?? must(await db.from('instagram_connections').select('*').eq('business_id',business.id).single());
      const profile=connection.provider_profile_id ?? await provider().profile(business.id);
      if (!connection.provider_profile_id) must(await db.from('instagram_connections').update({provider_profile_id:profile}).eq('id',connection.id));
      const state=randomToken();
      const attempt=must(await db.from('instagram_connect_attempts').insert({connection_id:connection.id,owner_id:user.id,state_hash:await digest(state)}).select('id').single());
      if (!attempt) throw new ProviderError(503,'Connection attempt could not be saved.');
      const base=origin && origins().includes(origin) ? origin : 'https://www.realreach.com.ng';
      const callback=`${base}/business/instagram?attempt=${attempt.id}&rr_state=${state}`;
      return reply(req,{url:await provider().connect(profile,callback)});
    }
    if (!connection) throw new ProviderError(409,'Connect Instagram first.');
    if (body.action==='connect-complete') {
      if (typeof body.state!=='string' || typeof body.attempt!=='string' || typeof body.accountId!=='string') throw new ProviderError(400,'The connection callback is incomplete.');
      const attempt=must(await db.from('instagram_connect_attempts').select('*').eq('id',body.attempt).eq('owner_id',user.id).eq('connection_id',connection.id).eq('state_hash',await digest(body.state)).is('consumed_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());
      if (!attempt) throw new ProviderError(400,'This connection link expired or was already used.');
      const account=await provider().connectedAccount(connection.provider_profile_id,body.accountId);
      if (connection.provider_account_id && connection.provider_account_id!==account.id) throw new ProviderError(409,'Changing the connected Instagram account requires a reviewed migration.');
      const consumed=must(await db.from('instagram_connect_attempts').update({consumed_at:new Date().toISOString()}).eq('id',attempt.id).is('consumed_at',null).select('id'));
      if (!consumed?.length) throw new ProviderError(409,'This connection was already processed.');
      must(await db.from('instagram_connections').update({provider_account_id:account.id,username:account.username,status:'connected',updated_at:new Date().toISOString()}).eq('id',connection.id));
      return reply(req,{connected:true});
    }
    if (body.action==='disconnect') {
      // Revoke at the provider before marking the local connection disconnected.
      if (connection.provider_account_id) await provider().request(`/accounts/${encodeURIComponent(connection.provider_account_id)}`,'DELETE');
      must(await db.from('instagram_connections').update({status:'disconnected',updated_at:new Date().toISOString()}).eq('id',connection.id));
      return reply(req,{disconnected:true});
    }
    if (connection.status!=='connected') throw new ProviderError(409,'Reconnect Instagram before inviting testers.');
    const active=must(await db.from('pilot_invites').select('id').eq('connection_id',connection.id).gt('expires_at',new Date().toISOString()));
    if ((active?.length ?? 0)>=2) throw new ProviderError(429,'Two pilot invitations are already active. Wait for expiry before creating more.');
    const invite=randomToken();
    must(await db.from('pilot_invites').insert({connection_id:connection.id,token_hash:await digest(invite)}));
    return reply(req,{invite});
  } catch (error) {
    const known=error instanceof ProviderError;
    return reply(req,{error:known ? error.message : 'Unable to complete this request. Please try again.'},known ? (error.status>=500 ? 503 : error.status) : 500);
  }
});
