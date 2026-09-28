# RealReach Instagram frontend first pass — implementation and QA

Date: 28 September 2026.

Historical demo-only report. The simulator is now under `/demo`. See
[the newer pass 1/2 report](./RealReach-Pass-1-2-QA.md) for real Supabase accounts,
deployed functions, authorization testing and pending provider activation.

## Outcome

The worker and business workspaces now use one connected browser-local simulator. A campaign created and funded in Business is available in Worker; its assignment, verification states, reward and delivery receipt are reflected on both sides. The active UI is in `src/journey/`.

This is a frontend preview, not a secure backend or a live earning service. Authentication, Instagram access, payment confirmations, bank verification and transfers are explicitly simulated. The previous prototype's browser storage and the existing research documents have been preserved. No deployment or Git push was performed in this pass.

## Implemented journeys

- Worker/business signup and login previews; email confirmation and password-recovery screens; sign-out and workspace switching.
- Instagram task discovery with search, filters, saved tasks, availability, task briefs and a thumb-reachable mobile accept action.
- Assignment reservations, identity-message simulation, sample Instagram profile/post interactions, completion checks, delayed responses, pending rewards, final checks and receipts.
- My tasks, appeals, activity timelines and refresh recovery.
- Business Instagram connection/reconnection/disconnection states.
- Four-step campaign builder: account, brief, budget, review. Includes comment prompts, saved/resumable drafts, funding checks and fixed published terms.
- Campaign delivery, pause/resume, close-and-release-unused-funds behavior and actual CSV receipt export.
- Business top-up success/failure scenarios and a transaction history.
- Worker available/pending/in-withdrawal balances, sample bank setup and payout success/failure scenarios.
- Openly labelled demo admin for exceptions and payout outcomes. No claim that an unprotected frontend is admin security.
- Profile editing, local notification preferences, notifications, help and preview disclosures.
- Versioned persistence, same-origin cross-tab updates, storage failure warnings and a scoped reset of this new demo.

## Design work

- One consistent infinity-style RealReach mark across the public header and new product/auth screens.
- A cohesive plum, warm white, coral and lime identity; editorial headings, quieter operational surfaces and distinct worker/business information hierarchies.
- Phone-first four-item bottom navigation, compact overview cards and fixed task/builder actions above the navigation safe area.
- Desktop side navigation, contextual summaries and a branded split authentication layout using the existing image asset.
- Native modal dialogs with keyboard dismissal and focus restoration; labelled inputs, visible focus, state text, reduced-motion support and improved contrast.

The React review informed separation of state transitions from page rendering, immutable updates, stable command callbacks, effect cleanup and versioned browser persistence. Browser verification informed the contrast corrections, compact mobile overview and docked primary actions.

## Evidence

| Check | Result |
| --- | --- |
| TypeScript and Vite production build | Passed |
| `npm test` | 18 state/money regression tests passed |
| Full browser business → worker → business flow | Passed |
| Comment, delayed verification, exception and admin-resolution flow | Passed |
| Bank setup, payout failure/refund and successful payout | Passed |
| Deposit failure followed by successful demo confirmation | Passed |
| Signup/email preview, profile persistence, sign-out and recovery | Passed |
| Saved task/search/empty-state recovery | Passed |
| Saved draft survives refresh and resumes selected action | Passed |
| Connection disconnect/reconnect | Passed |
| Escape dismisses modal and restores trigger focus | Passed |
| Another open tab receives updated demo balance | Passed |
| 20 routes × 5 viewport sizes | 100 checks passed |
| Browser console and uncaught runtime errors during walkthrough | None captured |
| Focused axe WCAG 2 A/AA scans on six primary screens | No reported violations after corrections; some contrast cases remained tool-incomplete and were visually inspected |
| `git diff --check` | Passed |

Responsive viewports: 360×800, 390×844, 430×932, 768×1024 and 1440×1000. The matrix checks meaningful content, document horizontal overflow and Vite error overlays. This is Chromium responsive testing, not physical-device or Safari certification.

The six accessibility samples were Discover, business Overview, campaign builder first step, worker Wallet, worker Account and Login at mobile width. This is a focused check, not an assertion of complete WCAG conformance on every dynamic state.

Screenshots were visually reviewed for worker discovery, business overview, campaign budget, authentication and the desktop workspaces. Additional flow screenshots and machine-readable results are generated in `outputs/qa/` (ignored by Git).

## State and money regressions

The tests cover:

1. Claim reservation without a second business debit.
2. Duplicate claims and active-work restrictions.
3. Unknown provider responses preserving the assignment without a reward.
4. Pending funds not becoming withdrawable; premature settlement blocked.
5. Idempotent final settlement and reward receipts.
6. Already-following ineligibility without a balance penalty.
7. Expiry of unsubmitted work, not submitted checks or pending rewards.
8. Closing a campaign while preserving pending allocations.
9. Releasing expired allocations only once.
10. Paused/disconnected business behavior.
11. Deposit idempotency and amount validation.
12. One-time funding and immutable published terms.
13. Insufficient campaign funds.
14. Payout holds and exactly-once refund after definite failure.
15. Missing evidence becoming a review, not an automatic payment.
16. Preventing repeat participation on the same target across campaigns.
17. No payout through an appeal for an unverified expired task.
18. No payout through an appeal after its campaign funding was returned.

These are simulator invariants. They do not demonstrate database transactions, genuine multi-user concurrency, provider idempotency or production payment security.

## Boundaries traced

| Boundary | Status |
| --- | --- |
| UI action → typed demo command | Implemented and browser-tested |
| Command → shared campaign/assignment/money state | Implemented and regression-tested |
| State → local persistence and another browser tab | Tested |
| Updated state → both business and worker screens | Tested |
| Browser → authenticated backend | Not connected |
| Backend → Supabase database/RLS | Not implemented in this frontend pass |
| Backend → Instagram evidence | Not connected; scenario controls only |
| Backend → PocketFi collections/transfers | Not connected; no real money moved |

## Reproduce

```powershell
npm run dev -- --port 5173 --strictPort
npm test
npm run build
```

`tests/browser-journeys.cjs` uses Playwright and defaults to `http://localhost:5173`. It can use an installed `playwright` package or a bundled package supplied through `REALREACH_PLAYWRIGHT_PATH`. `REALREACH_BROWSER_CDP` optionally attaches to a dedicated test browser. Do not attach this harness to a personal authenticated browsing session. `REALREACH_TEST_URL` can target another authorized local preview.

## Next backend work

Keep the UI states and interaction contracts, but replace client authority with server-owned records and commands. Implement Supabase Auth and role/ownership enforcement, constrained schema and RLS, transactional reservations and ledger posting, durable verification jobs and signed webhooks. Then integrate and independently test the Instagram provider and PocketFi contract.

Remove open demo admin and scenario controls from any real-money environment. Separate production data from these local fixtures; do not migrate fictitious balances. The Instagram commercial-use restriction remains a separate release gate described in the PRD.
