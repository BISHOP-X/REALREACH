import { verifySignature, webhookEvent } from '../_shared/instagram.ts';
import { service } from '../_shared/runtime.ts';
Deno.serve(async (req) => {
  if (req.method!=='POST') return new Response('Method not allowed',{status:405});
  if (Number(req.headers.get('content-length') ?? 0)>262144) return new Response('Too large',{status:413});
  const raw=await req.text();
  if (raw.length>262144) return new Response('Too large',{status:413});
  const secret=Deno.env.get('ZERNIO_WEBHOOK_SECRET') ?? '';
  if (!secret) return new Response('Webhook not configured',{status:503});
  if (!await verifySignature(raw,req.headers.get('x-zernio-signature'),secret)) return new Response('Invalid signature',{status:401});
  try {
    const event=webhookEvent(JSON.parse(raw));
    const header=req.headers.get('x-zernio-event-id');
    if (header && header!==event.id) return new Response('Event mismatch',{status:400});
    // Atomic dedupe, identity binding and job enqueue. Raw DM bodies are not retained.
    const {error}=await service().rpc('rr_ingest_instagram',{p_event:event.id,p_type:event.type,p_account:event.account,p_challenge:event.challenge,p_sender:event.sender,p_occurred:event.occurred});
    return new Response(error ? 'Receipt could not be persisted' : 'Received',{status:error ? 503 : 200});
  } catch { return new Response('Malformed event',{status:400}); }
});
