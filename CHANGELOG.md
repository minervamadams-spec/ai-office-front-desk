# Changelog

## 0.15.11 — 2026-08-31 (unsigned)

### Added

- **A feedback bubble.** A floating "Feedback" button on every page logs issues locally (until
  you clear them) with an optional current-error-context attachment, and suggests starter entries
  from whatever's already visibly broken — a connector in error status, a failed build. No live
  AI call, no email-sending code, no OAuth scope change: "Email report" just hands everything to
  your own mail client via a plain mailto: link, addressed to you on your own personal install
  and left blank for a generic one to fill in themselves. "Copy report" is the fallback for a
  list too long for a mailto: link's length limit.

## 0.15.10 — 2026-08-31 (unsigned)

### Fixed

- **Touch scrolling now works anywhere on the page**, not just in specific panels. The layout
  locks to two independent-scroll columns — fine with a mouse, since you naturally hover the
  panel you want, but a touch that lands on the header or a gap between panels used to do nothing.
  Any touch/coarse-pointer device now gets natural whole-page scrolling.
- **TikTok bundles and Engineering Handoffs now actually refresh** every 15 seconds, matching the
  header's long-standing "refreshes every 15 sec" text, which nothing previously fulfilled for
  these two panels. A queued TikTok bundle that finishes processing now shows up without a manual
  reload.

## 0.15.9 — 2026-08-31 (unsigned)

### Fixed

- **Slack messages no longer show a raw user ID** (like `U02UAJP0F`) when no real display name is
  available. The author is left blank instead — still shows a real name when the `users:read`
  scope is present, same as before.

## 0.15.8 — 2026-08-31 (unsigned)

### Fixed

- **A second Google account with Gmail disabled (Workspace, Drive-only) now shows its Drive files.**
  The generic dashboard's own bundled build of the Google connection fetched Drive and Gmail
  sequentially and let either one's failure discard data the other had already fetched — a
  Workspace account with Gmail turned off showed nothing at all instead of just its Drive files.
  The two are now fetched independently.

## 0.15.7 — 2026-08-31 (unsigned)

### Fixed

- **Slack messages in the Connected Services panel are cleaner.** "X has joined the channel" and
  similar system notices no longer appear as if they were real messages. Author now shows a real
  display name instead of a raw Slack user ID, when the token has the `users:read` scope (falls
  back silently to the ID otherwise — no setup required, just nicer when available). Inline
  `@mentions` in message text are resolved the same way, and stray line breaks/whitespace are
  collapsed.

## 0.15.6 — 2026-08-31 (unsigned)

### Fixed

- **The "Connected services" panel now updates on its own.** Fixing a connector in Desk Settings
  (a separate part of the screen) never showed up there without a full page reload — nothing on
  the generic dashboard actually auto-refreshed despite the header claiming it does every 15
  seconds. The panel now genuinely polls every 15 seconds.

## 0.15.5 — 2026-08-31 (unsigned)

### Fixed

- **Teams sign-in failures now log the real reason from Microsoft**, not just a generic
  "unexpected error (status N)." Launch the app from a terminal to see it in the console. The
  message shown in Settings is unchanged — still a plain-English summary, never Microsoft's raw
  error jargon.

## 0.15.4 — 2026-08-30 (unsigned)

### Added

- **The generic dashboard now shows what's actually connected.** Desk settings only ever had
  config forms for each service — nothing displayed the result anywhere. A new "Connected
  services" panel on the main dashboard lists live items (issues, messages, cards, etc.) from
  every connector you've hooked up.

## 0.15.3 — 2026-08-30 (unsigned)

### Fixed

- **The generic dashboard's Microsoft Teams connector could fail to complete sign-in** if the
  server wasn't running on its default port (which happens routinely) — same root cause as the
  earlier Google secondary-account fix, caught proactively before anyone hit it. The original
  renderer's own Teams connector was never affected (it already builds its redirect URI from
  whichever port it actually bound).

## 0.15.2 — 2026-08-30 (unsigned)

### Fixed

- **The desk accent color (blue/violet/teal) now actually looks different.** The setting worked
  correctly, but only affected a couple of small text colors — nothing prominent enough to notice.
  Now visibly colors your desk name and the active filter tab.
- **Slack now supports private channels**, not just public ones — list a private channel's name the
  same way, after inviting the bot to it with `/invite`. Needs `groups:read`/`groups:history` scopes
  added to the bot token in addition to the existing `channels:read`/`channels:history`.

## 0.15.1 — 2026-08-30 (unsigned)

### Fixed

- **A genuinely fresh install could show a bare "Not found" page instead of the wizard.** The
  readiness check the app used before displaying the dashboard was polling an API route that
  reports "ready" slightly before the dashboard's very first build actually finishes writing its
  page — a real race, reproduced and confirmed on a machine with no prior install. Now checks the
  actual page instead.
- Bundles portfolio-dashboard's own fixes for stale browser caching (the generic dashboard's
  JS/CSS could get stuck on an old cached version) and a hardcoded internal port that could break
  the "Connect second Gmail account" flow.

## 0.15.0 — 2026-08-30 (unsigned)

### Fixed

- **"Launch at Login" is now reachable regardless of which desk you're using.** It only ever had an
  IPC handler that the original renderer's preload bridge called — anyone on the generic dashboard
  (most installs) had no way to reach this setting at all. Now a native app-menu checkbox item
  (macOS: app menu; Windows/Linux: Window menu) that works identically either way.

## 0.14.0 — 2026-08-30 (unsigned)

### Added

- **"Delete local app data" for the generic dashboard** — Desk settings → "Danger zone". Wipes this
  install's own config, cached data, and connector credentials, then returns you to the first-run
  wizard. Closes the gap the previous release's privacy docs flagged as missing.

## 0.13.0 — 2026-08-30 (unsigned)

### Added

- **"Explore with examples" in the generic dashboard's first-run wizard** — closes a parity gap
  against the old built-in desk's wizard. Populates the desk with clearly-fake illustrative content
  (quick links, notes, a financials snapshot) so you can see what a filled-in Front Desk looks like
  before connecting anything real.

### Fixed

- `docs/PRIVACY.md` and `docs/DATA-HANDLING.md` now accurately describe both desk modes — the
  generic dashboard stores connector credentials as plain files, not OS-keychain-encrypted like the
  original renderer, and both docs previously only described the latter.

## 0.12.0 — 2026-08-30 (unsigned)

### Changed

- **The generic desk now comes from the same live codebase as Command Central**, instead of a
  separately-maintained React renderer. When no personal Portfolio Dashboard checkout is found (the
  ordinary case for anyone installing this), the app now starts a bundled, fully generic snapshot of
  that same dashboard — seeded empty, with its own first-run wizard (name your desk, pick a look,
  connect a service) and all 7 connectors (GitHub, Slack, Teams, Notion, Linear, Asana, Trello)
  wired in and working. The old built-in renderer is kept only as a last-resort fallback if the
  bundled dashboard fails to start.
- Nothing changes for an install that already has its own Portfolio Dashboard checkout — that path
  is untouched.

## 0.11.0 — 2026-08-30 (unsigned)

### Added

- **Trello is now a real, working connector** — the seventh. An API key and token generated from
  your own Trello account, no OAuth needed. Shows your open cards across every board — title, due
  date, and a link.

## 0.10.0 — 2026-08-30 (unsigned)

### Added

- **Asana is now a real, working connector** — the sixth. A personal access token from your own
  account, no OAuth needed. Shows incomplete tasks assigned to you across every workspace you belong
  to — title, due date, and a link.

## 0.9.0 — 2026-08-30 (unsigned)

### Added

- **Linear is now a real, working connector** — the fifth. A personal API key from your own Linear
  account, no OAuth needed. Shows issues currently assigned to you: identifier, title, state, and a
  link.

## 0.8.0 — 2026-08-30 (unsigned)

### Added

- **Notion is now a real, working connector** — the fourth one. Even simpler than the others: an
  internal integration secret from your own Notion workspace, no OAuth handshake at all. Open each
  page you want tracked in Notion and share it with your integration ("…" → Connections); the app
  shows recently-edited pages among whatever's been shared, with title, last-edited time, and a link.

## 0.7.0 — 2026-08-30 (unsigned)

### Added

- **Microsoft Teams is now a real, working connector** — the third one, after GitHub and Slack. Reuses
  the exact same public-client OAuth-with-PKCE mechanism already proven for Outlook (no client secret,
  no new broker infrastructure) — just a Chat.Read scope on the same kind of Azure app registration,
  which can be the same one already used for Outlook. Shows recent chat message previews (HTML
  stripped, truncated, never the full message) from your Microsoft Teams chats.

## 0.6.0 — 2026-08-30 (unsigned)

### Added

- **Slack is now a real, working connector** — the second one, after GitHub. Read-only via a Bot User
  OAuth Token from a Slack app the installer creates in their own workspace (no OAuth app registration
  with us, no client secret to embed — the same reason this could be built without the token-broker
  work Miro still needs). Shows recent message previews (truncated, never the full message) from the
  public channels you list.

### Changed

- **GitHub's connector is simpler and more explicit** — instead of an opaque "everything you're
  involved in across all of GitHub" search, it now works off a plain list of repositories you type in
  (`owner/repo`, one per line or comma-separated), the same shape as Jira's saved-search field and
  Slack's new channel list. Easier to explain, easier to control, and needs a narrower, repo-scoped
  token.

## 0.5.0 — 2026-08-30 (unsigned)

### Added

- **GitHub is now a real, working connector** — the first step in closing the gap between "documented
  as needing a connector" and actually having one. Reads open issues and pull requests assigned to or
  mentioning you via a read-only, fine-grained personal access token (same installer-owned-token
  pattern as Jira — no OAuth app registration needed). Shows up in Connections on the dashboard the
  same way Jira/Google/Outlook do, with sync/disconnect.
- Teams, Miro, Slack, Notion, Linear, Asana, and Trello remain genuinely unbuilt — the Settings catalog
  is honest about this rather than implying they're available elsewhere.

## 0.4.1 — 2026-08-30 (unsigned)

### Fixed

- **Background color was too dark.** The built-in fallback dashboard's background is now `#f2f3f5`,
  matching the Portfolio Dashboard's own real branding color (`--paper` in its stylesheet) exactly,
  instead of a guessed sandalwood tone.
- **A real installed copy could spawn a redundant, competing Portfolio Dashboard server process.**
  This app previously always checked a hardcoded port (4173) for an already-running dashboard before
  deciding to start its own — if the real one happened to be running on a different port (as it was
  on 2026-08-30, started by another tool on 4174), this app couldn't find it, concluded nothing was
  running, and spawned a second, competing instance. It now reads the same lock file the dashboard's
  own server writes (which records the port it's actually listening on) and connects to that instance
  directly — no more guessing, no more duplicate servers, and one real installed app (in
  `/Applications`, not a scratch test copy) is now the single, permanent, Dock-pinned icon for this on
  Minerva's machine, the same package anyone else installs.

## 0.4.0 — 2026-08-30 (unsigned)

### Added

- **Collapsible cards** — click any card's header to collapse it to just the title, click again to
  expand. Collapsed state is saved with your layout.
- **Start automatically at login** — a toggle in Settings → Startup, backed by the OS's own login-item
  mechanism (nothing custom to go stale).
- **"Ask AI for ideas" now copies the prompt and opens the tool in one click** — "Open in Claude" /
  "Open in ChatGPT" / "Open in Gemini" replaces the old separate copy-then-you-open-it-yourself flow.
  It still can't paste into the page itself (this app has no AI API and no browser-automation access
  into whatever opens), so there's one paste (⌘V) left once the page loads — but it's one click
  instead of a five-step round trip.
- Add-item forms (Notes, Projects & tasks, Routines, Affirmations, Quick Launch) now sit behind a
  small "+ Add …" link instead of always-visible input fields, matching the request for a more
  compact resting state.

### Changed

- **Two independently-scrolling columns**, each sized to the window instead of the whole page
  scrolling as one — matches feedback that reaching a card shouldn't require scrolling past the
  other column first. This also fixes a real drag-and-drop bug: dragging a card from the right
  column to the left column could fail if the target had scrolled out of view during a single
  shared page scroll; with both columns independently visible in the same viewport, that failure
  mode goes away.
- **Background is now a warm sandalwood-gray** instead of a near-white blue-gray, so the white
  cards stand out against it rather than blending in.
- Quick Launch's dashboard card is now clean icon chips only — the pencil/× edit controls on every
  chip moved to a new "Quick Launch links" section in Settings, since that's the surface for upkeep,
  not the one you glance at daily.
- List rows (Routines, Projects & tasks, Notes, Affirmations) dropped their standalone Edit/Delete/
  reorder-arrow buttons — click a row to edit it in place; Delete now lives inside that edit view,
  next to Save/Cancel. Note: per-item up/down reordering is gone with those arrows — item-level drag
  reordering wasn't in scope for this round; delete-and-re-add is the workaround if you need a
  specific order today.
- General tightened spacing and copy across every card (shorter sample-data labels, smaller row
  padding, smaller card-header padding) per feedback that the layout felt padded and wordy compared
  to the reference dashboard.

## 0.3.0 — 2026-08-30 (unsigned)

### Added

- **Cards can now be dragged and dropped directly on the live Dashboard** — no trip to Settings
  needed to rearrange. Dragging one card onto another reorders it there and switches columns if
  dropped into the other one; dragging into empty space at the bottom of a column moves it to the
  end of that column. The same reordering logic now backs both the Dashboard and the Settings/
  Wizard layout editor, so "move a card" only has one implementation.
- **"✨ Ask AI for ideas"** on Routines, Projects & tasks, Notes, Affirmations, and Focus — expands
  to a copyable, tailored prompt for that card. This app has no AI API of its own, so it's a real
  copy-and-paste prompt rather than a fake pre-filled deep-link into any particular AI tool.
- Quick Launch entries are now compact chips with a colored icon badge (keyword-matched generic
  glyph, not a fetched brand logo) instead of a stacked list of plain text links.

### Changed

- The left column of the two-column layout is now wider (about 1.8:1) to match the emphasis most
  installers give their primary cards.
- General visual polish: rounder corners and subtle shadows on cards, slightly larger/rounder
  buttons and input fields, and a pressed/disabled state on buttons.

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
