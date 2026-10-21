import { must } from './runtime.ts';
import { type DB, type Row } from './marketplace.ts';

export type OperationalLimits = {
  jobs_per_run:number; follow_pages_per_batch:number; comment_pages_per_batch:number;
  max_scan_pages:number; max_scan_minutes:number; claim_queue_limit:number;
};
export async function operationalLimits(db:DB):Promise<OperationalLimits> {
  const row=must(await db.from('rr_operational_limits').select('*').eq('singleton',true).single());
  const maxima={jobs_per_run:8,follow_pages_per_batch:8,comment_pages_per_batch:8,max_scan_pages:500,max_scan_minutes:30,claim_queue_limit:10000};
  for(const [key,max] of Object.entries(maxima)) if(!Number.isSafeInteger(row?.[key])||row[key]<1||row[key]>max) throw new Error('Verification limits are unavailable');
  return row as OperationalLimits;
}
export function scanLimitReason(job:Row,limits:OperationalLimits,now=Date.now()):string|null {
  if(Number(job.scanned_pages??0)>=limits.max_scan_pages) return 'Instagram reached the page limit. Support must review this task before another scan.';
  const started=Date.parse(job.scan_started_at);
  if(job.scan_started_at&&(!Number.isFinite(started)||now-started>limits.max_scan_minutes*60_000)) return 'Instagram took too long to return a complete check. A fresh review is required.';
  if(job.cursor&&!job.scan_started_at) return 'Instagram returned an incomplete scan record. A fresh review is required.';
  return null;
}
