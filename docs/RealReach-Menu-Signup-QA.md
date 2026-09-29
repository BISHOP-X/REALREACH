# Mobile menu and Google signup — 2026-09-29

## Changes

- Replaced the narrow landing-page dropdown with a full-height, scrollable mobile navigation panel, complete navigation, signup and login actions.
- Added modal background isolation, scroll locking, Escape/close controls, focus restoration and keyboard wrap. The panel closes when switching to the desktop layout.
- Removed the unchecked terms checkbox prerequisite that made signup's official Google button look broken. A visible Terms/Privacy notice now precedes both signup methods. Loading and submission safeguards remain.
- No Google credentials, nonce exchange, Supabase account rules or backend authorization were changed.

## Verified

- `npm test`: 41 passed, including two new source-regression tests. These are not a substitute for browser or backend integration tests.
- `npm run build`: passed; existing main-bundle size warning remains.
- Real browser at measured 360 × 567, 390 × 844 and 430 × 932 CSS pixels: menu opens, all four navigation links fit without horizontal overflow, short screens scroll, Get started reaches signup, body unlocks and email signup is enabled.
- Escape restores focus to the menu trigger; keyboard Tab wraps inside the panel. Business anchor navigation closes the menu. Resizing to 1440-pixel desktop closes the panel and restores scrolling.
- Production signup: the official Google button is fully opaque and not inert without ticking a checkbox. Clicking it opens Google's account chooser displaying `realreach.com.ng`, not the Supabase project reference.
- Closing the Google popup leaves both Google and email usable. No account was created and no full Google credential exchange was performed in this test.
- Local browser error scan returned no errors during the menu/signup checks.

## Deployment

Promoted production deployment `dpl_69CvoDH2KUBjDb9sW3y7stzxJAtN` to the live domain. Verified the changed menu and signup on `https://www.realreach.com.ng` after promotion.

Local screenshot evidence (not committed): `outputs/mobile-menu-fixed.png` and `outputs/signup-google-fixed.png`.
