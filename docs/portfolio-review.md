# Portfolio review

This pass reviews the rendered application, visible text, and the account/watchlist flows. The review is scoped to the local application rather than a claim that every possible browser or hosting environment has been tested.

## Product and visual changes

- Increased small text sizes and fixed contrast in navigation, breadcrumbs, progress labels, and the footer.
- Preserved the charcoal, coral, and sage visual direction, with clearer hierarchy and spacing.
- Kept watch statuses readable on phones instead of encoding them only as colored dots.
- Replaced placeholder catalog limits with 28,302 attributed titles, numbered pagination, adjustable page sizes, and visible snapshot provenance.
- Fixed singular/plural text for titles and episodes, clarified password rules, and used explicit labels for missing metadata.
- Added keyboard focus containment for the mobile menu, inert closed navigation, focus restoration after dialogs, and motion-aware page scrolling.
- Added useful recovery actions for stale edits and separated error notifications from success messages.
- Restored a prominent profile card in the left sidebar, with account-backed picture upload, replacement, and removal in Settings.
- Added a dedicated login entry page for signed-out visitors, while retaining session restoration and public catalog browsing.

## Verification

Verified locally on **October 23, 2026**:

| Check | Result |
| --- | --- |
| API integration tests | 20 passed |
| Chromium browser tests | 17 passed |
| Main-page accessibility and overflow matrix | All five routes passed at 1440, 768, 390, and 320 px |
| Sign-in, registration, and detail accessibility | Standalone sign-in/registration passed at all four widths; no automated WCAG AA violations in tested dialogs |
| TypeScript / production frontend build | Passed |
| Oxlint and Prettier checks | Passed |
| .NET whitespace verification | Passed |
| Published app smoke check | Passed: login entry, SPA routing, production configuration, registration, persistent session, and picture upload/persistence |
| Rendered screenshots | Inspected desktop pages and phone detail/editor dialogs; no browser runtime errors during capture |

GitHub Actions is configured to repeat the test, build, and published-app checks. A remote workflow run has not been executed from this local workspace.

The browser suite checks all five main pages at widths of 1440, 768, 390, and 320 pixels for horizontal overflow and automated WCAG AA violations. It also checks sign-in, registration, detail dialogs, and keyboard focus behavior. Automated checks supplement visual inspection; they do not establish comprehensive accessibility certification.

Behavioral journeys cover registration, login/logout, private watchlists, progress, completion, ratings, notes, profile updates, picture upload/replacement/removal and reload persistence, XML import/export, large-catalog search and navigation, conflicts between tabs, synchronized logout, broken images, missing metadata, unavailable catalogs, and timed-out requests. API tests cover user isolation, image validation and size limits, CSRF requirements, concurrency, bounded XML parsing, and catalog refreshes that preserve user data.

The visual audit helper captures the main pages at all four widths:

```sh
# Both development servers must be running.
cd frontend
node scripts/audit-ui.mjs current
```

It writes screenshots and a machine-readable report to ignored `.tools/ui-audit/current/`. Portfolio screenshots in `docs/screenshots/` are generated with `node scripts/preview.mjs`.

## Scope and limitations

- The catalog is a July 4, 2026 snapshot, not live seasonal data. It includes source links and visible data/license attribution. Full synopses are unavailable for most titles; the UI states that rather than inventing them.
- Poster availability depends on external image hosts. A failed image has a readable title fallback.
- Watch time is estimated from logged progress and known whole-minute runtimes; unknown runtimes are excluded.
- Demo accounts are separate, cannot be signed back into after logout, and are disabled in Production by default.
- Account recovery, email verification, public profiles, and catalog administration are not implemented.
- The automated browser suite uses Chromium. Layouts were checked at phone and tablet widths, rather than on physical devices.
- The production publish can be checked with `scripts/smoke-production.mjs`. Docker files are supplied, but the local Docker engine was unavailable during this review.

For a reviewer: start a demo session, mark an episode watched, edit a rating or note, inspect Insights, then try the sample XML from Settings. Discovery can be explored without signing in.
