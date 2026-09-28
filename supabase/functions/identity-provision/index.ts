// Tombstone for the narrowly scoped, short-lived provisioning operation.
// Re-deploy this handler immediately after provisioning/QA cleanup.
// Never replace it with a general-purpose admin or user-creation endpoint.
Deno.serve(() => new Response('Provisioning closed',{status:410}));
