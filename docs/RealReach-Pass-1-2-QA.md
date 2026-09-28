# RealReach passes 1 and 2 — implementation and verification

28 September 2026. This report distinguishes live deployment from mocked proof.

## Delivered in the working tree

- The default site uses real Supabase Auth and RLS-protected records. The old
  browser-only marketplace is isolated under `/demo` with a visible sample-data
  banner. Fictitious balances are not migrated to the real application.
- Real account screens: signup, email confirmation/resend, password login,
  recovery, reset, PKCE OAuth callback, profile persistence, sign-out, and TOTP MFA.
- One login switches worker/business fronts; only the pinned admin UUID can
  access the admin front. Privileged Edge API reads additionally require AAL2.
- Business profile creation, hosted Instagram connection/callback, disconnection,
  private pilot invites, worker claim/DM code, queued follow checks and evidence
  history. Mobile bottom navigation and desktop sidebar use the same real data.
- Server-only Zernio adapter, signed webhook handling, event deduplication,
  worker/sender binding, baseline/action/retention checks, durable job leases,
  bounded unknown-result retries, and a scheduled final observation.
- Comments have a contract-tested adapter but no enabled campaign workflow.
  Money, paid campaigns and payments are intentionally disabled.

## Actually deployed to Supabase

Project URL verified: `https://jabwuawiqsusjrccapab.supabase.co`.

- Migrations `20260928185915_identity_and_instagram_pilot.sql` and
  `20260928192729_pilot_scheduler.sql` applied through the project-scoped MCP.
- `realreach-api`, `instagram-webhook`, `instagram-jobs` deployed, version 2.
  JWT-gateway checks are disabled because handlers implement their own verified
  user JWT, provider HMAC or Vault-backed scheduler-token authentication.
- Every exposed table has RLS and explicit API grants. Private tokens, provider
  IDs and raw sender identifiers are not readable by browser clients.
- One-minute cron dispatches only due jobs. Its random credential stays in
  Supabase Vault; no scheduler secret is stored in frontend code or migrations.
- Sole admin Auth account provisioned through the supported Auth Admin SDK,
  assigned by UUID to the immutable singleton. Its strong random password is in
  the owner-only, gitignored `.local-credentials/admin.json`. Inbox reception and
  founder-controlled MFA enrollment remain to be confirmed.
- Two disposable QA Auth users and their test business records were removed
  after successful testing. The temporary narrow provisioning function was
  replaced by a 410 tombstone; it no longer provisions any accounts.

Frontend production deployment `dpl_FGQux3jZficd7SKpBqB75n97QsBN` is READY and
promoted to `https://www.realreach.com.ng`. Its staged build was inspected before
promotion. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` were added
to Vercel; `.vercelignore` excludes local credentials, environment files and
backend/operator assets. Deployment came from the current working tree, not a
new commit. No Git push was performed. Vercel's error-log query returned no logs;
this is limited observability, not proof of a complete monitoring setup.

## Verified

| Check | Result |
| --- | --- |
| Node regression/adapter suite | 29 passed: 18 demo invariants + 11 provider contract cases |
| TypeScript + Vite build | Passed |
| Deno checks for all three Edge handlers | Passed |
| Ordinary-user SDK/API security tests | 21 passed |
| Browser journey groups | 17 passed |
| Authenticated and public page/viewport matrix | 70 checks passed |
| Runtime errors during the real-backend browser walkthrough | None captured |
| Scheduled job dispatch function executions | Succeeded in cron run history |
| Real Google login on localhost and www.realreach.com.ng | Passed through account chooser, Supabase callback and protected account page |
| Google session reload, local and production sign-out | Passed |
| Production Google account mobile business switch, 430px | Passed; no overflow, no admin option |
| Production Google account creation boundary | Confirmed email + profile row + Google identity, no admin assignment |

Security tests used separate actual Auth sessions, not an administrator query:
anonymous denial, own-profile persistence, cross-user read/write denial,
cross-business isolation, forged owner rejection, immutable owner, rejected role
metadata escalation, denied browser admin assignment, private-table denial,
denied verification-result RPC, ordinary admin denial and AAL1 admin denial.
Missing provider credentials and untrusted webhook/scheduler calls fail closed.

Browser testing covered actual password login, reload/persistence, sign-out,
protected routes, business/worker switching, unavailable provider response,
cancelled OAuth, missing recovery session, and demo separation. Widths: 360, 390,
430, 768 and 1440 CSS pixels. This is Chromium testing, not physical-device or
Safari certification. Screenshots/results are in ignored `outputs/qa/pass12/`.

The four provider UI groups used explicitly intercepted fixtures: DM challenge,
requesting a server check, retention/history and unknown-result handling. These
are UI tests, **not live Instagram verification**.

## Open gates — not reported as passing

- Google: real PKCE integration implemented and official colour logo installed.
  Isolated project `realreach-510019` and web OAuth client created under
  `userealreach@gmail.com`, with approved Google terms/user-data policy. Callback
  is restricted to this project's Supabase `/auth/v1/callback`. Supabase Site URL
  is `https://www.realreach.com.ng`; eight exact app/recovery callback URLs for
  www/apex and localhost 5173/5174 are saved. The owner entered and saved the
  credentials; Google was then enabled without weakening nonce/email checks.
  Actual login completed on localhost and the production domain, with session
  restoration and both local/production sign-out tested. Google audience was
  subsequently confirmed **In production** in the console. See the direct-GIS
  follow-up below; the earlier callback tests refer to the original redirect flow.
- The Google client secret was pasted into chat by the owner despite the secure
  entry guidance. It was not copied into source, environment files or tool logs.
  Replace that secret directly in Google/Supabase before public launch.
- Email: public signup confirmation/recovery delivery needs a verified sender
  and custom SMTP. Successful password sign-in does not prove email delivery.
- Zernio: founder explicitly deferred creating the account. Set `ZERNIO_API_KEY`
  and `ZERNIO_WEBHOOK_SECRET` in Edge Function secrets, configure the signed
  webhook, and allowlist the consenting business UUID in `RR_PILOT_BUSINESS_IDS`.
  Confirm the exact documented webhook/identity contract against live events.
  Then run positive, negative, already-following, replay, disconnection and
  delayed-retention cases. Do not mark the full provider pass complete before it.
- A 48-hour observation is the technical pilot setting, not a promise of
  continuous following or approved commercial payout terms.
- Security advisor reports five INFO notices for intentionally policy-free,
  deny-all service tables and a WARN for disabled leaked-password protection.
  Review availability on the chosen Supabase plan before public launch:
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Persistent paid marketplace, ledger, PocketFi, reconciliation, anti-abuse,
  commercial/platform-use clearance and public-release policies remain later
  delivery passes. No real funds were transferred.

## Reproduction

`npm test`, `npm run build`, and `deno check` for each deployed handler are safe
local checks. `tests/live-security.mjs` and `tests/browser-pass12.cjs` require
explicitly provisioned disposable QA identities; those identities were cleaned
up and are not silently recreated. Do not run the QA harness with a founder's
personal Chrome profile or point the legacy simulator harness at live routes.

The Supabase/security skills informed explicit grants plus RLS, scoped project
identity checks, server-only provider authority and ordinary-user testing.
React and browser verification informed effect cleanup, callback idempotency,
responsive layouts and clear separation of real versus simulated states.

## Google Identity Services follow-up — 28 September 2026

- Rechecked the exact RealReach MCP URL, two deployed migrations and active
  handlers. All 11 public tables have RLS; exactly one admin remains; the last
  10 cron dispatch executions succeeded. Anonymous API checks still reject
  unauthorized access; provisioning remains HTTP 410. No schema changes.
- Google is External / In production. Brand verification was attempted; Google
  reported missing homepage ownership verification. DNS changes and any paid
  Supabase upgrade were not performed. The owner instead requested direct GIS.
- Web login and signup now render Google's official hosted button. A fresh
  256-bit in-memory nonce is SHA-256 hashed for Google; the original is supplied
  to Supabase `signInWithIdToken`. Duplicate callbacks and expired attempts are
  rejected. No ID token, nonce or client secret is persisted by the integration.
- Existing Supabase session storage, accounts, protected routes and onboarding
  are retained. The email/recovery PKCE callback remains. Signup terms now gate
  both Google and email. Closing Google does not lock the email form; retry is
  available after script/exchange failure. No automatic One Tap login is enabled.
- Production public client ID added to the RealReach Vercel project only.
  Deployment `dpl_6yqVqJG5fMsVAgrXPihMMfTTgzGq` was built and promoted to
  `https://www.realreach.com.ng`. No Git push, backend deployment or paid upgrade.
- Tests: 34 unit/contract regressions pass (five new nonce/exchange cases),
  TypeScript/Vite build passes. Existing production session survived deployment
  and sign-out succeeded. At 390px the account layout had no horizontal overflow.
- The **real production Google chooser visibly says `realreach.com.ng`**;
  it no longer names the Supabase project. Only openid/email/profile requested.
- Real production GIS exchange passed: the owner completed the account click
  (automation could read the popup but input actions timed out), and the browser
  visibly reached `/account` as `userealreach@gmail.com`, with its existing
  profile and no admin option. Refresh restored that session; sign-out returned
  to `/login`. No browser errors/warnings were captured. Database inspection
  confirmed one existing Google account, not a duplicate or admin assignment.
  Fresh-account signup was not independently exercised with a second Google
  identity; signup uses the same exchange plus the existing onboarding hint.
- Local GIS rendered and opened its chooser, but logged an origin warning;
  do not claim local GIS authentication passed. Production GIS showed no such
  console error. Existing registered origins (www/apex/5173/5174) were inspected;
  no Google secret or origin settings were changed.
- Vercel's post-deploy error scan returned no logs. This is not comprehensive
  client-side monitoring or proof that all customers' browsers will succeed.
- Remaining launch gates are unchanged: real Instagram provider testing,
  custom email sender/recovery delivery, payments/ledger, final policies and
  founder-controlled admin MFA enrollment (zero verified factors at this audit).
  Leaked-password protection is still disabled. Rotate the Google secret that
  was shared in chat; it remains server-side and was not added to this build.

Supabase's official GIS documentation informed the hashed/original nonce split.
React review informed cleanup, single-flight exchange and responsive rendering;
Vercel skills informed scoped public environment configuration and deployment.
