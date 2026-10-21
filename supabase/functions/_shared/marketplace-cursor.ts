import { ProviderError } from './instagram.ts';

export type RecordCursor = {at:string;id:string};
/** Keep PostgreSQL's microseconds. Converting to a JavaScript Date before
 * paging can skip every remaining row created within the same millisecond. */
export function readRecordCursor(value:unknown):RecordCursor|null {
  if(value===undefined||value===null||value==='')return null;
  try {
    if(typeof value!=='string'||value.length>500)throw new Error();
    const data=JSON.parse(atob(value));
    if(typeof data.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.at)
      ||!Number.isFinite(Date.parse(data.at))||typeof data.id!=='string'
      ||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.id))throw new Error();
    return {at:data.at,id:data.id};
  }catch {throw new ProviderError(400,'This page link expired. Refresh and try again.');}
}
export function writeRecordCursor(row:{created_at:string;id:string}):string {
  return btoa(JSON.stringify({at:row.created_at,id:row.id}));
}
