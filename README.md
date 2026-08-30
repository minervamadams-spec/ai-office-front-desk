# AI Office Front Desk

A local-first, installer-owned desktop work desk. Everything — your profile, your connections,
your cached data, your secrets — lives in this app's own local storage on your computer. There is
no account with us, no server we run, and no telemetry. You choose what to connect; each connection
you add is between your computer and that service directly.

See [`docs/PRIVACY.md`](docs/PRIVACY.md) and [`docs/DATA-HANDLING.md`](docs/DATA-HANDLING.md) for
exactly what's stored and where. See [`docs/SUPPORT.md`](docs/SUPPORT.md) for support contact
placeholders to fill in before a real release.

## Installing (end users)

There's no hosted download yet — build the installer yourself (see below), then hand someone
either the `.dmg` or the zip (`out/make/zip/darwin/arm64/*.zip` — it includes a plain-text
`README.txt` alongside the app, written for a non-technical installer, not a developer). Either
way:

- **macOS**: open the `.dmg` (or unzip the zip) and drag the app into `Applications`.
- **Windows**: run the generated Squirrel setup `.exe` from `out/make/squirrel.windows/<arch>/`.

The app is unsigned (no Apple Developer / code-signing certificate configured yet), so macOS
Gatekeeper will block the first launch — right-click the app and choose "Open" once to bypass it
(covered in the bundled README.txt too). This step doesn't require anything from the developer —
it's a one-time click any installer can do themselves.

No other setup is required from the developer for someone else to install and use this app: it
runs entirely standalone (sample data, manual lists, and every connector are opt-in from inside
the app itself). The one exception is the "Personal Dashboard" bridge in `dashboardRoot()` in
`src/main/main.ts` — that only ever activates on a machine that already has a specific local
checkout at `~/Projects/GitHub/portfolio-dashboard`; on every other machine it's silently skipped
and the standalone UI below opens instead, with no dialog or error shown.

## Auto-updates

`update-electron-app` (official Electron tooling) is wired into `main.ts`, pointed at
[github.com/minervamadams-spec/ai-office-front-desk](https://github.com/minervamadams-spec/ai-office-front-desk)
(public — the free `update.electronjs.org` proxy this library uses only serves public releases).
Every packaged, installed copy checks that repo hourly and applies new releases in the background —
no reinstall needed. Windows updates via Squirrel.Windows; macOS updates via Squirrel.Mac, which
needs the `.zip` artifact specifically (already configured above) rather than the `.dmg`.

To ship a fix to everyone who already has it installed:

```bash
npm run publish   # wraps `electron-forge publish` — builds, then uploads the release artifacts
```

Bump `version` in `package.json` first — Squirrel only offers an update when the published version
is newer than what's installed.

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
