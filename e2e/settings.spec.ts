import { test, expect, type Locator } from '@playwright/test';
import path from 'node:path';
import { launchApp, freshUserDataDir } from './helpers';

/** This checkbox's `checked` prop is bound to state that only updates after an IPC round-trip to the
 * main process resolves — Playwright's built-in .check()/.uncheck() verify the DOM synchronously right
 * after the click and don't retry, so they can fail even though the app correctly updates a beat later.
 * Click, then assert with a normal (auto-retrying) expect instead. */
async function toggleAndWaitFor(checkbox: Locator, expectChecked: boolean) {
  await checkbox.click();
  await expect(checkbox).toBeChecked({ checked: expectChecked });
}

test('toggling a card off in Settings removes it from the live dashboard', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();

  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await expect(window.getByText('Front Desk pilot rollout')).toBeVisible();

  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await toggleAndWaitFor(window.getByRole('checkbox', { name: /Projects & tasks/ }), false);
  await window.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(window.getByText('Front Desk pilot rollout')).not.toBeVisible();
  await app.close();
});

test('layout export then import round-trips your real card choices through the real IPC handlers', async () => {
  // Playwright can't click a native save/open dialog, but it can stub the `dialog` module inside the
  // app's own main process via evaluate() — everything else (IPC, sanitizeDesign, file I/O) is real.
  const app = await launchApp();
  const window = await app.firstWindow();
  const exportPath = path.join(freshUserDataDir(), 'exported-layout.json');

  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await window.getByRole('button', { name: 'Settings', exact: true }).click();

  // Turn off a card so the exported file provably reflects a non-default choice.
  await toggleAndWaitFor(window.getByRole('checkbox', { name: /Projects & tasks/ }), false);

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog;
  }, exportPath);
  await window.getByRole('button', { name: 'Export layout' }).click();
  await expect(window.getByText(`Saved to ${exportPath}`)).toBeVisible();

  // Turn it back on locally, then import the exported file and confirm it snaps back to off —
  // proving the import actually changed live state, not just that the button did something.
  await toggleAndWaitFor(window.getByRole('checkbox', { name: /Projects & tasks/ }), true);
  await window.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(window.getByText('Front Desk pilot rollout')).toBeVisible();

  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog;
  }, exportPath);
  await window.getByRole('button', { name: 'Import layout' }).click();
  await expect(window.getByText('Layout imported.')).toBeVisible();
  await expect(window.getByRole('checkbox', { name: /Projects & tasks/ })).not.toBeChecked();

  await window.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(window.getByText('Front Desk pilot rollout')).not.toBeVisible();

  await app.close();
});

test('Sync all connections is disabled with nothing connected, and diagnostics export never leaks card content', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();
  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await window.getByRole('button', { name: 'Settings', exact: true }).click();

  await expect(window.getByRole('button', { name: 'Sync all now' })).toBeDisabled();

  const exportPath = path.join(freshUserDataDir(), 'diagnostics.json');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog;
  }, exportPath);
  await window.getByRole('button', { name: 'Export diagnostics' }).click();
  await expect(window.getByText(`Saved to ${exportPath}`)).toBeVisible();

  await app.close();
});
