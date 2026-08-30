import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';

// Matches src/main/main.ts's UPDATE_REPO — set both once a real GitHub repo exists (see README's
// "Auto-updates" section). Leaving this unset just means `npm run publish` has nothing configured
// to publish to yet; it doesn't affect `npm run make`, which never touches publishers.
const UPDATE_REPO_OWNER = 'minervamadams-spec';
const UPDATE_REPO_NAME = 'ai-office-front-desk';

// Bridges postPackage's outputPaths to postMake, which needs them to find the README it should
// rezip alongside the .app — both hooks run within the same `electron-forge make` invocation.
let packagedOutputPaths: string[] = [];

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.protovate.ai-office-front-desk',
    appCategoryType: 'public.app-category.productivity',
    name: 'AI Office Front Desk',
    icon: 'assets/icon',
    darwinDarkModeSupport: true,
    // The Vite plugin's packaging ignore only lets `.vite/` through (see its own resolveForgeConfig) —
    // these hooks run after that copy step to carry over what else the app needs at runtime that
    // Vite can't bundle into main.js: the window icon (Windows/Linux taskbar; macOS Dock icon comes
    // from Info.plist via packagerConfig.icon above) and better-sqlite3's native binary (a real
    // .node file, not JS — main.js just does a plain `require('better-sqlite3')` for it at runtime,
    // which needs the real package, AND its own `bindings`/`file-uri-to-path` runtime dependencies
    // (used to locate the compiled binary), present under node_modules relative to main.js).
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        fs.mkdirSync(path.join(buildPath, 'assets'), { recursive: true });
        fs.copyFileSync(path.resolve(__dirname, 'assets/icon.png'), path.join(buildPath, 'assets/icon.png'));
        for (const dep of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
          fs.cpSync(path.resolve(__dirname, 'node_modules', dep), path.join(buildPath, 'node_modules', dep), { recursive: true });
        }
        // Snapshot of portfolio-dashboard's generic-mode code (scripts/public + the empty-shape
        // config/data examples — never her real config/data/secrets) for the fallback dashboard a
        // generic install shows when no personal checkout is found (see main.ts's
        // ensureBundledDashboardServer). buildPath is Contents/Resources/app; this needs to land at
        // Contents/Resources/dashboard-bundle (a sibling of app/, matching process.resourcesPath at
        // runtime), one level up from buildPath. Only bundled when the sibling checkout exists on
        // the build machine — Minerva's own — so a CI or other machine without it just skips this,
        // same as `npm run make` already behaves today for anything else that's optional.
        const dashboardSource = path.resolve(__dirname, '..', 'portfolio-dashboard');
        if (fs.existsSync(dashboardSource)) {
          const dashboardTarget = path.join(buildPath, '..', 'dashboard-bundle');
          for (const dir of ['scripts', 'public']) {
            fs.cpSync(path.join(dashboardSource, dir), path.join(dashboardTarget, dir), { recursive: true });
          }
          fs.cpSync(path.join(dashboardSource, 'config', 'examples'), path.join(dashboardTarget, 'config', 'examples'), { recursive: true });
          fs.cpSync(path.join(dashboardSource, 'data', 'examples'), path.join(dashboardTarget, 'data', 'examples'), { recursive: true });
        } else {
          console.warn('portfolio-dashboard checkout not found beside this repo — packaging without the bundled generic dashboard.');
        }
        callback();
      }
    ]
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    // No `name:` override — MakerDMG bakes a fixed name in when one's set, so an arm64 and an x64
    // build collide on the exact same filename and one silently overwrites the other on upload.
    // Leaving it unset gets forge's own default, which includes the version and arch.
    new MakerDMG({ icon: 'assets/icon.icns' }),
    new MakerSquirrel({ name: 'AIOfficeFrontDesk', setupIcon: 'assets/icon.ico' })
  ],
  // draft: false matters — update.electronjs.org (what update-electron-app checks against) only
  // serves published releases; a draft release silently never reaches anyone already installed.
  publishers: UPDATE_REPO_OWNER ? [new PublisherGithub({ repository: { owner: UPDATE_REPO_OWNER, name: UPDATE_REPO_NAME }, prerelease: false, draft: false })] : [],
  hooks: {
    // better-sqlite3 is a native module — whatever ABI it's currently built for (plain Node, from
    // `npm install` or `npm test` last rebuilding it) is very likely NOT what the packaged app's
    // Electron runtime needs, and a mismatched build doesn't just fail to load — it *segfaults* the
    // whole process. Rebuilding it for Electron right before every package/make/publish means this
    // is never something that has to be remembered by hand.
    prePackage: async (_config, _platform, arch) => {
      // Must target the arch actually being packaged (electron-forge make --arch=x64 on this arm64
      // Mac, for instance) — without -a, this always rebuilds for the host's own arch, silently
      // producing a package with a native module for the wrong CPU.
      execFileSync('npx', ['electron-rebuild', '-f', '-w', 'better-sqlite3', '-a', arch], { cwd: __dirname, stdio: 'inherit' });
    },
    // Drops a plain-text README next to the .app in every packaged output directory.
    postPackage: async (_config, { outputPaths }) => {
      packagedOutputPaths = outputPaths;
      for (const outputPath of outputPaths) {
        fs.copyFileSync(path.resolve(__dirname, 'assets/DISTRIBUTION-README.txt'), path.join(outputPath, 'README.txt'));
      }
    },
    // MakerZIP's darwin output only zips the .app bundle itself (see its own make()), so the README
    // dropped above never rides along — rebuild that one artifact to include both, since a README an
    // end user has to open the app bundle to find isn't one they'll ever see before double-clicking it.
    postMake: async (_config, results) => {
      for (const result of results) {
        if (result.platform !== 'darwin') continue;
        const outputPath = packagedOutputPaths.find((p) => path.basename(p) === `AI Office Front Desk-${result.platform}-${result.arch}`);
        if (!outputPath) continue;
        for (const artifactPath of result.artifacts) {
          if (!artifactPath.endsWith('.zip')) continue;
          fs.rmSync(artifactPath, { force: true });
          execFileSync('zip', ['-r', '-y', '-q', artifactPath, 'AI Office Front Desk.app', 'README.txt'], { cwd: outputPath });
        }
      }
      return results;
    }
  },
  plugins: [new VitePlugin({
    build: [
      { entry: 'src/main/main.ts', config: 'vite.main.config.ts' },
      { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts' }
    ],
    renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }]
  })]
};

export default config;
