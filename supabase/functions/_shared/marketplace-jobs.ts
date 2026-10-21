import { createRocketClient, type InstagramComment } from './rocket.ts';
import { ProviderError as AdapterError } from './provider-contract.ts';
import { service, must } from './runtime.ts';
import { env, type DB, type Row } from './marketplace.ts';
import { refreshPayment, startWithdrawal } from './marketplace-payments.ts';
import { operationalLimits, scanLimitReason } from './marketplace-limits.ts';

type Work = { job: Row; assignment: Row; campaign: Row };
const normalized = (text:string) => text.normalize('NFKC').replace(/\s+/g,' ').trim();
export function matchingComment(comments:InstagramComment[],assignment:Row) {
  return comments.find(comment => comment.authorId===assignment.instagram_id
    && Date.parse(comment.createdAt)>=Date.parse(assignment.created_at)
    && (!assignment.comment_id || comment.id===assignment.comment_id)
    && (!assignment.comment_text || normalized(comment.text)===normalized(assignment.comment_text)));
}
async function finish(db:DB,job:Row,result:string,reason:string,commentId:string|null=null) {
  must(await db.rpc('rr_market_finish_check',{p_job:job.id,p_lease:job.lease_id,p_result:result,p_reason:reason,p_comment_id:commentId}));
}
async function continuation(db:DB,job:Row,cursor:string,pages:number,seen:string[]=[cursor]) {
  must(await db.rpc('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:cursor,p_pages:pages,p_seen:seen}));
}
async function review(db:DB,job:Row,reason:string) {
  must(await db.rpc('rr_market_scan_review',{p_job:job.id,p_lease:job.lease_id,p_reason:reason}));
}
async function defer(db:DB,job:Row) {
  must(await db.rpc('rr_market_defer',{p_job:job.id,p_lease:job.lease_id}));
}
async function unknown(db:DB,job:Row,error:unknown) {
  const reason=error instanceof AdapterError?`${error.provider}:${error.code}`:'Verification could not be completed';
  if(job.assignment_id) await finish(db,job,'unknown',reason);
  else must(await db.from('rr_jobs').update({state:job.attempts>=12?'attention':'queued',reason,due_at:new Date(Date.now()+300_000).toISOString(),lease_id:null,lease_until:null}).eq('id',job.id).eq('lease_id',job.lease_id));
}
export async function runMarketplaceJobs(db:DB=service(),dependencies:{provider?:()=>ReturnType<typeof createRocketClient>;now?:()=>number}={}) {
  const now=dependencies.now??Date.now;const deadline=now()+100_000;
  const limits=await operationalLimits(db);
  const jobs:Row[]=must(await db.rpc('rr_market_lease',{p_limit:limits.jobs_per_run}))??[];
  const provider=dependencies.provider??(()=>createRocketClient({apiKey:env('ROCKET_API_KEY'),timeoutMs:6000}));
  const comments=new Map<string,Work[]>();
  // A lease is reclaimable after a crashed invocation. Durable cursor progress
  // is committed between provider batches, never held inside a SQL transaction.
  await Promise.all(jobs.map(async job=> {
    try {
      if(job.payment_id) {
        const payment=must(await db.from('rr_payments').select('*').eq('id',job.payment_id).single());
        if(!payment) throw new Error('Payment missing');
        if(payment.direction==='payout'&&!payment.submitted_at) await startWithdrawal(db,payment);
        else if(payment.direction==='collection'&&!payment.submitted_at) {
          // A checkout has no credentials/phone payload in a job. The original
          // user can resume it with the same intent key; nothing is credited.
          must(await db.from('rr_jobs').update({state:'attention',reason:'Resume this checkout from its original request',lease_id:null,lease_until:null}).eq('id',job.id).eq('lease_id',job.lease_id));
        } else await refreshPayment(db,payment);
        return;
      }
      const assignment=must(await db.from('rr_assignments').select('*').eq('id',job.assignment_id).single());
      const campaign=must(await db.from('rr_campaigns').select('*').eq('id',assignment.campaign_id).single());
      if(!['reserved','checking','pending','needs_review'].includes(assignment.status)||assignment.phase!==job.phase) {
        await finish(db,job,'unknown','This assignment has already finished');return;
      }
      // Never promote an old/outage-spanning cursor chain to negative evidence.
      // Admin retry starts a clean scan; the held allocation remains protected.
      const cutoff=scanLimitReason(job,limits,now());
      if(cutoff){await review(db,job,cutoff);return;}
      const rocket=provider();
      if(campaign.action==='comment') {
        const profile=await rocket.profileById(assignment.instagram_id);
        if(profile.isPrivate) {await finish(db,job,'unknown','Your Instagram account is private');return;}
        if(job.phase==='baseline') {
          must(await db.rpc('rr_market_comment_ready',{p_job:job.id,p_lease:job.lease_id}));
          return;
        }
        const groupKey=`${campaign.media_id}:${job.cursor??''}`;
        comments.set(groupKey,[...(comments.get(groupKey)??[]),{job,assignment,campaign}]);
        return;
      }
      if(!job.cursor) {
        const result=await rocket.checkFollowing({workerId:assignment.instagram_id,targetId:campaign.target_id,targetUsername:campaign.target_username,maxPages:Math.min(2,limits.follow_pages_per_batch,limits.max_scan_pages-Number(job.scanned_pages??0))});
        if(scanLimitReason(job,limits,now()))await review(db,job,'The Instagram scan expired before its result could be accepted');
        else if(result.state==='unknown'&&result.nextCursor) await continuation(db,job,result.nextCursor,result.pages,result.visitedCursors);
        else await finish(db,job,result.state,result.reason);
      } else {
        const profile=await rocket.profileById(assignment.instagram_id);
        if(profile.isPrivate) {await finish(db,job,'unknown','Your Instagram account is private');return;}
        let cursor=job.cursor;const seen=new Set<string>(job.seen_cursors??[]);const visited:string[]=[];
        const batch=Math.min(limits.follow_pages_per_batch,limits.max_scan_pages-Number(job.scanned_pages??0));
        for(let pageNumber=1;pageNumber<=batch;pageNumber++) {
          if(now()>deadline-10_000){if(pageNumber>1)await continuation(db,job,cursor,pageNumber-1,visited);else await defer(db,job);return;}
          const page=await rocket.followingPage({workerId:assignment.instagram_id,cursor});
          if(scanLimitReason(job,limits,now())){await review(db,job,'The Instagram scan expired before its result could be accepted');return;}
          if(page.userIds.includes(campaign.target_id)){await finish(db,job,'verified','Target Instagram ID found');return;}
          if(page.complete){await finish(db,job,'not_found','Complete following scan did not contain the target');return;}
          if(!page.nextCursor||seen.has(page.nextCursor)){await review(db,job,'Instagram did not return complete pagination');return;}
          seen.add(page.nextCursor);visited.push(page.nextCursor);cursor=page.nextCursor;
          if(pageNumber===batch)await continuation(db,job,cursor,pageNumber,visited);
        }
      }
    } catch(error) {await unknown(db,job,error);}
  }));
  // Every page is fetched once for the claims sharing its post and cursor.
  // Fresh claims start at the beginning; persisted cursor chains qualify a
  // complete negative only after all preceding pages were inspected.
  for(const group of comments.values()) {
    let active=[...group];let cursor=group[0].job.cursor??undefined;let pages=0;const visited:string[]=[];
    const seen=new Set<string>(group.flatMap(({job})=>job.seen_cursors??[]));
    const batch=Math.min(limits.comment_pages_per_batch,...group.map(({job})=>limits.max_scan_pages-Number(job.scanned_pages??0)));
    try {
      for(;pages<batch&&active.length;) {
        if(now()>deadline-10_000)break;
        const page=await provider().commentsPage(group[0].campaign.media_id,cursor);pages++;
        const remaining:Work[]=[];
        for(const work of active) {
          const {job,assignment}=work;const comment=matchingComment(page.comments,assignment);
          if(scanLimitReason(job,limits,now()))await review(db,job,'The Instagram scan expired before its result could be accepted');
          else if(comment) await finish(db,job,'verified','New comment found by stable author and post IDs',comment.id);
          else if(page.complete) await finish(db,job,'not_found','Complete comment scan found no matching new comment');
          else if(!page.nextCursor||seen.has(page.nextCursor)) await review(db,job,'Instagram did not return complete comment pagination');
          else remaining.push(work);
        }
        active=remaining;
        if(page.nextCursor){seen.add(page.nextCursor);visited.push(page.nextCursor);cursor=page.nextCursor;}
      }
      for(const {job} of active) {if(pages&&cursor)await continuation(db,job,cursor,pages,visited);else await defer(db,job);}
    } catch(error) {for(const {job} of active) await unknown(db,job,error);}
  }
  return jobs.length;
}
