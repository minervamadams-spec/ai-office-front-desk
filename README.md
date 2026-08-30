# AI Office Front Desk

A local-first, installer-owned desktop work desk. Everything — your profile, your connections,
your cached data, your secrets — lives in this app's own local storage on your computer. There is
no account with us, no server we run, and no telemetry. You choose what to connect; each connection
you add is between your computer and that service directly.

See [`docs/PRIVACY.md`](docs/PRIVACY.md) and [`docs/DATA-HANDLING.md`](docs/DATA-HANDLING.md) for
exactly what's stored and where. See [`docs/SUPPORT.md`](docs/SUPPORT.md) for support contact
placeholders to fill in before a real release.

## Installing (end users)

Grab the build matching the installer's Mac from the
[GitHub releases page](https://github.com/minervamadams-spec/ai-office-front-desk/releases) (Apple
menu → About This Mac tells you which chip), or build it yourself (see below) — either the `.dmg`
or the zip (it includes a plain-text `README.txt` alongside the app, written for a non-technical
installer, not a developer). Note that `npm run make`/`package` only builds for the *host*
machine's own architecture by default — use `make:all`/`publish:all` (see "Auto-updates" below) to
produce both.

- **macOS 10.15 (Catalina) or later, Apple Silicon or Intel**: open the `.dmg` (or unzip the zip)
  and drag the app into `Applications`. (Pinned to Electron 32 specifically for the OS floor —
  Electron 33+ raised its own minimum to macOS 11/Big Sur.)
- **Windows**: run the generated Squirrel setup `.exe` from `out/make/squirrel.windows/<arch>/`.

The app is unsigned (no Apple Developer / code-signing certificate configured yet), so macOS
Gatekeeper will block the first launch — right-click the app and choose "Open" once to bypass it
(covered in the bundled README.txt too). This step doesn't require anything from the developer —
it's a one-time click any installer can do themselves.

No other setup is required from the developer for someone else to install and use this app: it
runs entirely standalone (sample data, manual lists, and every connector are opt-in from inside
the app itself).

### Which desk am I looking at

The desk shown is one of three things, resolved in `createWindow()` in `src/main/main.ts`:

1. **The developer's own real dashboard** — only ever activates on a machine that already has a
   specific local checkout at `~/Projects/GitHub/portfolio-dashboard` (`dashboardRoot()`/
   `ensureDashboardServer()`). Silently skipped everywhere else, with no dialog or error shown.
2. **A bundled, fully generic snapshot of that same dashboard codebase** — the ordinary case for
   everyone else. `forge.config.ts`'s `afterCopy` hook packages a copy of that codebase (code and
   empty-shape templates only — never the developer's real config/data/secrets) into the app at
   build time; `ensureBundledDashboardServer()` spawns it pointed at its own private folder inside
   this app's own userData directory, seeded empty with its own first-run wizard and connector
   catalog. Both (1) and (2) are the same underlying dashboard — just pointed at different data.
3. **The original built-in renderer below** (`src/renderer/`) — kept only as a last-resort
   fallback if (2) also fails to start for some reason. Not actively developed against anymore;
   don't expect parity with (1)/(2) going forward.

## Auto-updates

`update-electron-app` (official Electron tooling) is wired into `main.ts`, pointed at
[github.com/minervamadams-spec/ai-office-front-desk](https://github.com/minervamadams-spec/ai-office-front-desk)
(public — the free `update.electronjs.org` proxy this library uses only serves public releases).
Every packaged, installed copy checks that repo hourly and applies new releases in the background —
no reinstall needed. Windows updates via Squirrel.Windows; macOS updates via Squirrel.Mac, which
needs the `.zip` artifact specifically (already configured above) rather than the `.dmg`.

To ship a fix to everyone who already has it installed:

```bash
npm run publish:all   # builds and publishes BOTH arm64 and x64 to the same GitHub release
                       # (npm run publish alone only covers this machine's own architecture)
```

Bump `version` in `package.json` first — Squirrel only offers an update when the published version
is newer than what's installed. Note the auto-updater itself only fetches a build matching the
installed machine's own architecture — an Intel install only ever updates to a newer x64 build, so
skipping the x64 half of a release means Intel installs silently stop receiving updates, not error.

## Building from source

### Prerequisites

- **Node.js 22.x** — this is a hard requirement for the *build tooling*, not the shipped app.
  Node 26 has a reproducible bug in the `extract-zip`/`yauzl` chain that `electron-packager` uses
  to unpack Electron's own binary: it silently stops after extracting a single file and exits
  cleanly (exit code 0, no error), so `npm run make` produces nothing under Node 26. This repo
  pins Node 22 via [`.nvmrc`](.nvmrc) and `package.json`'s `engines` field. If you use
  [nvm](https://github.com/nvm-sh/nvm), just run `nvm use` in this directory.
- macOS or Windows (Linux is untested).

### Commands

```bash
npm install         # installs dependencies — run this under Node 22, so native modules
                     # (e.g. the DMG maker's macos-alias) build against the right Node ABI
npm start            # run the app in dev mode (electron-forge start)
npm run typecheck     # tsc --noEmit
npm test              # unit tests (vitest)
npm run test:e2e       # end-to-end tests driving the real packaged app (playwright)
npm run make            # builds real installers into out/make/ (.dmg + .zip on macOS,
                         # a Squirrel .exe on Windows)
```

If you ever reinstall `node_modules` under a different Node version than you last ran `make`
with, native modules (like the DMG maker's `macos-alias`) will be built for the wrong Node ABI and
`npm run make` will fail with a `NODE_MODULE_VERSION` mismatch — just `npm install` again under
Node 22.

### Native modules: two different runtimes, two different rebuilds

This app stores its data via `better-sqlite3`, a native module — meaning `node_modules` always
holds *one* compiled binary at a time, built for whichever runtime last asked for it. `npm test`
runs under plain Node (host, v22); the packaged app runs under Electron 32's own bundled Node
(v20). These are different ABIs, and a binary built for one segfaults outright under the other —
it doesn't just fail to load. Both `npm test` (via a `pretest` hook) and every packaging command
(`package`/`make`/`publish`, via forge.config.ts's `prePackage` hook) rebuild it automatically for
whichever runtime they need, so this shouldn't ever need to be done by hand — but if you see a
`NODE_MODULE_VERSION` mismatch or a silent crash with no error at all, that's what's wrong, and
`npm rebuild better-sqlite3` (for tests) or `npx electron-rebuild -f -w better-sqlite3` (for the
packaged app) fixes it directly.

### Regenerating the app icon

The source icon is `assets/icon.svg`; `assets/icon.icns`, `assets/icon.ico`, and `assets/icon.png`
are generated from it and checked into git. To change the icon, edit the SVG and run:

```bash
./scripts/build-icons.sh   # macOS only — needs iconutil (built in) and rsvg-convert (brew install librsvg)
```

## What's not built yet

- Code signing / notarization for macOS, and Authenticode signing for Windows — both need a real
  developer certificate, so the installers above are unsigned.
- A hosted release/update feed (Squirrel's `iconUrl`/auto-update endpoint isn't configured).
- Windows has not been build-tested on a real Windows machine — only cross-checked that the
  Squirrel maker config resolves correctly on macOS.
