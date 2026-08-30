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
    // this hook runs after that copy step to also carry over the runtime window icon (used for the
    // Windows/Linux taskbar; macOS Dock icon comes from Info.plist via packagerConfig.icon above).
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        fs.mkdirSync(path.join(buildPath, 'assets'), { recursive: true });
        fs.copyFileSync(path.resolve(__dirname, 'assets/icon.png'), path.join(buildPath, 'assets/icon.png'));
        callback();
      }
    ]
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({ icon: 'assets/icon.icns', name: 'AI Office Front Desk' }),
    new MakerSquirrel({ name: 'AIOfficeFrontDesk', setupIcon: 'assets/icon.ico' })
  ],
  publishers: UPDATE_REPO_OWNER ? [new PublisherGithub({ repository: { owner: UPDATE_REPO_OWNER, name: UPDATE_REPO_NAME }, prerelease: false })] : [],
  hooks: {
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
