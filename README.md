# RealReach

RealReach is a mobile-first marketplace for genuine human attention. Nigerian businesses create campaigns around verified participation, while earners discover clear opportunities and build a trusted platform history.

This repository contains an Instagram-only, mobile-first **early-access application** and a separately labelled product demo. The default routes now use real Supabase accounts and private profile/business records. The Instagram verification pilot has deployed server-side code, but its live provider credentials and controlled proof test are pending. This is not a production earning or payment service.

Supabase Auth, schema, RLS, the sole-admin boundary and three Edge Functions are connected to the RealReach-only project. Google sign-in is enabled and its real local callback/session/sign-out flow has passed; public email delivery still needs custom SMTP. PocketFi and cash payments are not connected. The historical simulator lives only under `/demo`: all its permissions, funds, verification and payouts are simulated, and its demo admin is open only for sample testing. Use sample information in that demo.

See [the pass 1/2 QA report](docs/RealReach-Pass-1-2-QA.md) for exact deployment, test results and remaining external gates. The older frontend QA document is a historical report, not the current backend status.

## Stack

- React 19
- TypeScript
- Vite
- Custom responsive design system
- Vercel deployment

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Put the RealReach URL, publishable key and public `VITE_GOOGLE_CLIENT_ID` in `.env.local`. Never add service-role, Google client-secret, Instagram or payment credentials to a `VITE_` variable. Web Google login/signup uses Google's official Identity Services button and a nonce-protected `signInWithIdToken` exchange with Supabase, not a redirect through the Supabase hostname. Keep `/auth/callback` for email confirmation/recovery and existing OAuth links. Run `npm run build` for a production bundle. A successful build does not prove provider activation.

Run `npm test` on Node 22.6+ (Node 24 recommended) for the state-machine regression suite.

## Real-account routes

- `/login`, `/signup`, `/auth/callback` — real password/OAuth integration
- `/verify-email`, `/forgot-password`, `/reset-password` — actual Auth API flows; delivery requires configured SMTP
- `/account` — profile, preferred front, authenticator, sign-out
- `/earn`, `/business` — real-account readiness workspaces
- `/earn/instagram`, `/business/instagram` — private unpaid verification pilot
- `/earn/wallet`, `/business/wallet` — truthful payment-disabled screens
- `/admin` — designated admin only, with AAL2 required by the privileged API

## Demo routes (prefix every path below with `/demo`)

- `/` — marketing website
- `/signup`, `/login` — worker/business authentication previews
- `/verify-email`, `/forgot-password`, `/reset-password` — account lifecycle previews
- `/earn` — Instagram task discovery, search, filters and saved tasks
- `/earn/my-tasks`, `/earn/assignments/:id` — resumable assignments, verification and receipts
- `/earn/wallet`, `/earn/profile` — balances, bank placeholders, withdrawals and account settings
- `/business` — campaign delivery and funding overview
- `/business/campaigns/new` — four-step campaign builder
- `/business/campaigns/:id` — delivery, pause/resume/close, CSV receipt export
- `/business/billing`, `/business/settings` — demo top-ups and Instagram connection states
- `/admin`, `/admin/proofs`, `/admin/payouts` — exception and payout simulation
- `/help`, `/terms`, `/privacy` — preview guide and limitations

## Try the simulated complete loop

1. Open `/demo/business` and create a campaign. Review the quote and publish with demo funds.
2. Switch to Worker using the workspace switcher. Open the campaign and accept a place.
3. Simulate the verification message, preview the Instagram action, then request a check.
4. Open **Demo controls**, advance the demo clock by 48 hours, and pass the final check.
5. Visit Wallet; add a sample bank, request a withdrawal, and simulate success or failure.
6. Return to Business to inspect the same assignment and its delivery receipt.

The initial balances and sample campaigns are explicitly demo data. Worker and business fronts represent separate simulated participants so the same tester can walk both sides; this is not authorization to earn from one's own business in production. Progress survives refresh and is synchronized between tabs on the same origin. This browser-only simulation is not safe for concurrent real-money use. Account → Reset demo workspace resets only the new preview; the previous prototype's storage is retained.

## Structure and verification

- `src/live/`: Supabase client, generated types, authentication, real-account pages and responsive UI.
- `supabase/migrations/`: versioned deployed database schema and private job scheduling.
- `supabase/functions/`: authenticated commands, Zernio adapter, signed webhook and job runner.
- `tests/live-security.mjs`, `tests/browser-pass12.cjs`: explicitly provisioned disposable-user integration checks. See the QA report before running; the last QA accounts were cleaned up.
- `src/journey/model.ts`: typed commands, deterministic state transitions, capacity and demo-money invariants.
- `src/journey/store.tsx`: versioned local persistence, cross-tab updates, notices and command errors.
- `src/journey/Worker.tsx`, `Business.tsx`, `Account.tsx`: the connected journeys.
- `src/journey/ui.tsx`, `journey.css`: reusable controls, accessible native dialogs and responsive visual system.
- `src/journey/Product.tsx`: active workspace routing and demo administration. The prior `src/ProductApp.tsx` is retained as a reference but is not imported by the active application.
- `tests/journey.test.mjs`: money/state regressions.
- `tests/browser-journeys.cjs`: legacy demo walkthrough; target `REALREACH_TEST_URL=http://localhost:5173/demo`. Requires Playwright (installed locally or supplied using `REALREACH_PLAYWRIGHT_PATH`). Optional `REALREACH_BROWSER_CDP` connects to a dedicated QA browser. Outputs go to ignored `outputs/qa`.
- `docs/RealReach-Frontend-First-Pass-QA.md`: verification scope and backend handoff.

See `docs/RealReach-Instagram-V1-PRD.md` for the proposed backend contract and commercial release gates. A successful mock journey does not establish live API reliability, payment security, unique-human verification or platform permission.

The [V1 delivery plan](docs/RealReach-V1-Delivery-Plan.md) breaks production work into five tested passes: accounts/access, Instagram verification, persistent marketplace, PocketFi, and controlled release. It records the confirmed single-admin identity and the remaining Google, email and payment setup. The plan itself does not activate those integrations.
