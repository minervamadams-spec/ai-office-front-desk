# Changelog

## 0.1.1 — 2026-08-30 (unsigned)

### Fixed

- **macOS 10.15 (Catalina) couldn't install the app at all** — "You have macOS 10.15.8. The
  application requires macOS 11.0 or later." Electron 36's own minimum target is macOS 11; the app
  is now built on Electron 32, the newest major that still supports 10.15.
- Switched the storage engine from `node:sqlite` (a Node built-in) to `better-sqlite3`, because
  Electron 32 bundles Node 20.x, which doesn't have `node:sqlite` at all (added in Node 22.5). Same
  SQLite file format underneath — existing installs' data reads back unchanged, verified directly
  against a real profile carried over from the previous build.
- That native-module swap uncovered a real packaging gap: the copied `better-sqlite3` didn't carry
  its own `bindings`/`file-uri-to-path` runtime dependencies, so the packaged app's stores silently
  failed to initialize (process stayed alive, but never fully started) — fixed, and now covered by
  `e2e/packaged-native-module.spec.ts`, which specifically drives the real packaged `.app` rather
  than the dev-mode build every other E2E test uses (that gap is exactly how this shipped once
  already without being caught).
- Rebuilding `better-sqlite3` for whichever runtime needs it (plain Node for tests, Electron for
  the packaged app) is now automatic — see README's "Native modules" section — rather than a step
  that has to be remembered by hand.

## 0.1.0 — 2026-08-30 (unreleased, unsigned)

Initial pilot build. Not yet code-signed or notarized — see "Known limitations" below.

### Added

- First-run wizard: Welcome, Profile, Connections, Arrange (cards + layout), Finish. Resumable
  and skippable at every step.
- Sample-data mode: usable immediately with no account, no connector, and no configuration.
- Real, read-only connectors:
  - **Jira** — installer-supplied API token, one saved JQL search.
  - **Google** — installer-owned OAuth (PKCE), Gmail inbox-unread count + recent Drive files.
  - **Microsoft Outlook** — installer-owned OAuth (PKCE, no client secret), inbox-unread count +
    recent messages.
  - **Weather** — free, no-account Open-Meteo lookup for one location.
  - **RSS/Atom** — one feed URL, up to 10 recent items.
- Manual, locally-stored lists: Routines, Affirmations (with a daily featured pick), Quick Launch
  (one-click links — useful for AI tools like Claude/ChatGPT, or anything else).
- Two-column desk layout with explicit drag-and-drop card assignment (plus keyboard-accessible
  up/down controls), editable from both the wizard and Settings.
- Settings: appearance, cards & layout, per-connector status/disconnect, diagnostics export,
  delete-all-local-data.
- Full isolation from the original browser-based Portfolio Dashboard — separate app id, data
  directory, and local server; verified no cross-contamination.
- Credential boundary: tokens encrypted via OS key management (Keychain/DPAPI), SQLite holds only
  opaque references.
- Layout-only export/import (Settings → "Share your layout") — shares card choices, order,
  columns, and appearance only; never connections, tokens, or any content you've typed in.
- Release documentation: privacy policy, data-handling page, support guide, third-party notices.
- 50 unit/integration tests (Vitest) covering adapter error mapping, credential boundary,
  profile/design sanitization, and OAuth PKCE math.
- 7 end-to-end tests (Playwright, driving the real packaged app in an isolated temp profile):
  fresh launch, sample-data exploration, full manual wizard walkthrough, Settings delete-data,
  card-toggle removing a card from the live dashboard, layout export/import round-tripping through
  the real IPC handlers (native save/open dialogs stubbed, everything else real), and Settings'
  sync-all/diagnostics-export. Run with `npm run test:e2e`.
- Real app branding: a custom icon (`assets/icon.svg`, built into `.icns`/`.ico`/`.png`), the app
  name "AI Office Front Desk" wired through `package.json`, `forge.config.ts`, and Electron's
  Info.plist/helper-process names (previously showed as the generic "Electron" everywhere), and a
  native application menu (App/Edit/View/Window on macOS, plus a Help menu with About elsewhere).
- A real, working `npm run make` packaging pipeline producing genuine installers
  (`out/make/*.dmg`, `*.zip`, and a Windows Squirrel setup) — see README for the Node 22
  requirement this needed (Node 26's `extract-zip` dependency silently truncates Electron's own
  zip during packaging; this wasn't a sandbox limitation, it's version-specific and reproducible).
- A plain-text `README.txt` (written for a non-technical installer) now ships inside the
  distributable zip alongside the app itself — previously only `README.md` existed, and that's a
  dev-facing doc that never shipped with the app at all.
- Auto-update wiring (`update-electron-app` + `@electron-forge/publisher-github`), gated behind an
  empty `UPDATE_REPO` constant so today's build makes no update checks — activating it (a GitHub
  repo + one publish command, see README's "Auto-updates" section) means future bug fixes reach
  existing installs automatically instead of requiring a full reinstall.

### Changed

- Focus, Projects & tasks, and Notes are now real, editable cards (add/edit/delete, like Routines) —
  previously they were read-only sample lists with no way to add your own content.
- Removed every "sample data" mention from the visible app — the wizard, dashboard subtitle, and
  metrics bar. Every card's empty state now reads "Examples — add your own below and these
  disappear." (or, for the single-line Focus card, "Example — click to set your own.") once real
  content is added, the examples are gone and the card shows only what the installer typed.
- The featured affirmation is now a visible callout (accent-colored left border, tinted background,
  larger italic serif type) instead of blending in as regular body text.

### Fixed

- **A confusing dialog on every non-developer's first launch.** A separate change (the "Personal
  Dashboard" desktop wrapper — see `dashboardRoot()`) made a packaged launch try to start a
  different local project's dev server; when that's not present, which is every machine except its
  one developer's, the app showed a "Your local Portfolio Dashboard could not be started" warning
  before opening anyway. That dialog now only appears if the dashboard was actually configured
  (found on disk) but failed to start — a genuinely broken local setup, not an ordinary install.
  Anyone else's install now goes straight to the standalone app, no dialog.
- **A real installer's data could silently move to a second, empty profile folder.** Branding this
  app's display name via `app.setName('AI Office Front Desk')` also changed Electron's *default*
  userData path to match, from `ai-office-front-desk` to `AI Office Front Desk` — meaning updating
  an existing install could make it look like everything the user had added (routines, layout,
  connections) had vanished, when it was actually just sitting untouched at the old path the app
  no longer read from. userData is now pinned explicitly to the original folder name regardless of
  what the display name is. Added an end-to-end regression test for this (`e2e/userdata-path.spec.ts`).
- E2E test isolation: tests now override the dashboard bridge's port and root path, so they
  reliably exercise the standalone app instead of accidentally depending on whatever happens to be
  running on the machine that built it (previously this could make all 7 tests fail simultaneously,
  for reasons unrelated to the app itself).

### Known limitations

- **Unsigned build.** macOS Gatekeeper and Keychain re-prompt on every relaunch until this is
  code-signed and notarized with a real Apple Developer identity.
- **Windows untested.** Everything above has only been built and run on macOS so far — the
  Squirrel maker config resolves correctly but has not produced or run a real installer on Windows.
- **Live OAuth unverified.** Google/Outlook connect flows are implemented and unit-tested but have
  not been exercised against a real account — that requires an installer-provided OAuth client.
- Teams, Slack, GitHub, Miro, Notion, Linear, Asana, and Trello remain "planned" — catalog entries
  exist and explain what's missing, but no adapter is built for any of them.
