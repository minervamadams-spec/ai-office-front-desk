# Changelog

## 0.2.0 — 2026-08-30 (unsigned)

### Added

- Quick Launch now supports two new kinds of entry alongside plain web links (macOS only):
  - **Local app** — launches an installed Mac app by name (e.g. "Roblox"), for anything that isn't
    a website.
  - **Link in a specific Chrome profile** — opens a URL inside a *named* Chrome profile rather than
    whichever one Chrome currently has focused. Built for installers who keep separate Chrome
    profiles per Google account (e.g. a personal profile and a child's school profile) and want a
    link to always land in the right one. The profile picker reads Chrome's own profile list (name
    + signed-in account) directly, so nobody has to know or guess Chrome's internal "Profile 3"-
    style folder names.
- Both new kinds run the local command via an argument array, never a shell string, so nothing
  typed into a name/URL/profile field can be interpreted as a shell command.

## 0.1.4 — 2026-08-30 (unsigned)

### Fixed

- **A completed Google sign-in still ended in "Could not complete the request to Google."** — a
  real tester hit this right after finishing the browser sign-in successfully. Root cause: any
  thrown error (not just network failures) was being flattened through the same generic mapper,
  which discarded oauth-pkce's own already-specific messages — including "The authorization
  response did not match this request," the exact message produced by retrying in a stale sign-in
  tab left over from an earlier attempt (e.g. one made before fixing the API-enablement issue).
  Thrown errors now surface verbatim instead of being genericized, so this and similar cases are
  actionable on sight instead of needing another round of screenshots to diagnose. If you hit this
  again: close every Google sign-in tab first, then click Connect fresh from Settings.

## 0.1.3 — 2026-08-30 (unsigned)

### Fixed

- **Google connect failing with an opaque "unexpected error (status 403)"** with no way to tell why.
  The adapter was discarding Google's actual OAuth error code and mapping on HTTP status alone.
  Surfaced during a real tester's connect attempt: the token exchange returns a plain OAuth error
  code (`access_denied`, `invalid_grant`, etc.) — that's a fixed, documented, safe-to-show
  vocabulary, unlike the rest of the response. Now mapped to specific guidance: `access_denied` →
  add the account as a Google Cloud test user; a 403 with no matching code → enable the Gmail API
  and Google Drive API (a separate step from creating the OAuth client, easy to miss and exactly
  what this tester had missed).
- The in-app Google connect instructions never mentioned enabling those two APIs or adding test
  users at all — added both, since this is now confirmed to be a common first-connection snag.

## 0.1.2 — 2026-08-30 (unsigned)

### Fixed

- **"A JavaScript error occurred in the main process" on launch** — `update-electron-app` calls
  Squirrel.Mac's `autoUpdater.setFeedURL()` from inside its own `app.on('ready', ...)` handler,
  which throws synchronously ("Could not get code signature for running application") for an
  unsigned build that macOS has translocated. Translocation isn't an edge case — it's the ordinary
  result of opening a downloaded/unzipped app without first dragging it to Applications. Reproduced
  directly (quarantined a copy, confirmed the real `.../AppTranslocation/.../` launch path, watched
  it crash) and fixed with a process-level `uncaughtException` handler: a background update check
  failing must never take down the whole app. Until the app is code-signed, expect update checks to
  silently fail rather than silently succeed — but the app itself will never crash because of it.
- If macOS instead says **"'AI Office Front Desk' is damaged and can't be opened"** — that's
  Gatekeeper's separate, stricter rejection of unsigned software, not actual file corruption. The
  standard fix: `xattr -cr "/path/to/AI Office Front Desk.app"` in Terminal, then open normally.

## 0.1.1 — 2026-08-30 (unsigned)

### Fixed

- **macOS 10.15 (Catalina) couldn't install the app at all** — "You have macOS 10.15.8. The
  application requires macOS 11.0 or later." Electron 36's own minimum target is macOS 11; the app
  is now built on Electron 32, the newest major that still supports 10.15.
- **The above fix alone still didn't work on an actual Catalina Mac** — every Mac that old is
  Intel, and only an Apple Silicon (arm64) build had been published. Built and published an Intel
  (x64) build alongside it (same v0.1.1), verified for real under Rosetta (full UI + all three data
  stores initializing, not just "the binary is the right architecture"). `forge.config.ts`'s
  prePackage hook was rebuilding `better-sqlite3` for the *host* machine's architecture regardless
  of which architecture was actually being packaged — harmless when they matched, silently wrong
  cross-arch — now passes the real target arch through. Added `make:all`/`publish:all` scripts so
  future releases cover both architectures by default instead of only whichever one the developer's
  own Mac happens to be.
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
