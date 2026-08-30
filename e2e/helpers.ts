import { _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import electronPath from 'electron';

const mainEntry = path.join(__dirname, '..', '.vite', 'build', 'main.js');

/** A fresh temp userData dir per test — real E2E runs must never touch an installer's real profile. */
export function freshUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-e2e-'));
}

export async function launchApp(userDataDir: string = freshUserDataDir()): Promise<ElectronApplication> {
  if (!fs.existsSync(mainEntry)) {
    throw new Error(`Built main entry not found at ${mainEntry} — run "npm run package" (or any electron-forge build) first.`);
  }
  return electron.launch({
    args: [mainEntry],
    executablePath: electronPath as unknown as string,
    env: {
      ...process.env,
      FRONT_DESK_TEST_USER_DATA_DIR: userDataDir,
      // These tests exercise the standalone installer experience, not whatever happens to be running
      // on the machine that built it — without both overrides, a real Portfolio Dashboard checkout
      // (FRONT_DESK_DASHBOARD_ROOT) or anything already listening on :4173 (FRONT_DESK_DASHBOARD_URL,
      // a global, machine-wide port — including this same app already running for real) makes the
      // app load that instead of its own renderer, and every test below fails waiting for content
      // that was never going to appear.
      FRONT_DESK_DASHBOARD_ROOT: path.join(userDataDir, 'no-dashboard-here'),
      FRONT_DESK_DASHBOARD_URL: 'http://127.0.0.1:1'
    }
  });
}
