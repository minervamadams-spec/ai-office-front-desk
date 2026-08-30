import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const packagedApp = path.join(__dirname, '..', 'out', 'AI Office Front Desk-darwin-arm64', 'AI Office Front Desk.app', 'Contents', 'MacOS', 'AI Office Front Desk');

test.skip(!fs.existsSync(packagedApp), 'Run "npm run make" first — this checks the real packaged .app, not the dev build.');

test('the real packaged app (not just the dev-mode build) starts and persists data — regression test for the copied better-sqlite3 missing its own "bindings" dependency', async () => {
  // wizard.spec.ts and friends launch node_modules/electron + .vite/build/main.js directly, which
  // resolves better-sqlite3 from the *source* node_modules — that's a different copy than the one
  // forge.config.ts's afterCopy hook puts inside the actual packaged .app. That gap is exactly how a
  // previous version of this app shipped a working require('better-sqlite3') that then couldn't
  // find its own 'bindings' dependency at runtime once packaged, silently breaking every store.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-e2e-packaged-'));
  const app = await electron.launch({
    executablePath: packagedApp,
    env: {
      ...process.env,
      FRONT_DESK_TEST_USER_DATA_DIR: userDataDir,
      FRONT_DESK_DASHBOARD_ROOT: path.join(userDataDir, 'no-dashboard-here'),
      FRONT_DESK_DASHBOARD_URL: 'http://127.0.0.1:1',
      // Without this, the real packaged app now correctly finds the bundled generic dashboard (see
      // forge.config.ts's afterCopy hook) and loads that instead of the old renderer this test checks.
      FRONT_DESK_BUNDLED_DASHBOARD_ROOT: path.join(userDataDir, 'no-bundled-dashboard-here')
    }
  });
  const window = await app.firstWindow();
  await expect(window.getByText('Your dashboard lives on this computer')).toBeVisible();
  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await expect(window.getByText('Front Desk pilot rollout')).toBeVisible();
  await app.close();

  expect(fs.existsSync(path.join(userDataDir, 'front-desk.sqlite'))).toBe(true);
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
