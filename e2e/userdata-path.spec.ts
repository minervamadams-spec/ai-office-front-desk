import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import electronPath from 'electron';

const mainEntry = path.join(__dirname, '..', '.vite', 'build', 'main.js');

test('userData stays pinned to the original "ai-office-front-desk" folder name, not the display name', async () => {
  // Deliberately does NOT set FRONT_DESK_TEST_USER_DATA_DIR — this is the one test that needs to see
  // where the app decides to put a real installer's data by default. A fake HOME keeps it off any
  // real profile either way. Regression test for: app.setName() silently retargeting every real
  // installer at a second, empty "AI Office Front Desk" profile folder alongside their real one.
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-e2e-home-'));
  const app = await electron.launch({
    args: [mainEntry],
    executablePath: electronPath as unknown as string,
    env: { ...process.env, HOME: fakeHome, FRONT_DESK_DASHBOARD_ROOT: path.join(fakeHome, 'no-dashboard-here'), FRONT_DESK_DASHBOARD_URL: 'http://127.0.0.1:1' }
  });
  const userDataPath = await app.evaluate(({ app }) => app.getPath('userData'));
  expect(path.basename(userDataPath)).toBe('ai-office-front-desk');
  await app.close();
});
