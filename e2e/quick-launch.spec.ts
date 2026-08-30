import { test, expect } from '@playwright/test';
import { launchApp, freshUserDataDir } from './helpers';

test('a Quick Launch "local app" entry persists across a relaunch', async () => {
  const userDataDir = freshUserDataDir();

  let app = await launchApp(userDataDir);
  let window = await app.firstWindow();
  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await window.getByRole('checkbox', { name: /Quick launch/ }).click();
  await window.getByRole('button', { name: 'Close', exact: true }).click();

  const addForm = window.locator('.routine-add', { has: window.getByRole('combobox', { name: 'Quick launch type' }) });
  await addForm.getByRole('combobox', { name: 'Quick launch type' }).selectOption('app');
  await addForm.getByLabel('Link name').fill('Roblox');
  await addForm.getByLabel('App name').fill('Roblox');
  await addForm.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(window.getByText('Roblox')).toBeVisible();
  await app.close();

  // Reopen against the same profile — this is the real test: does it persist, not just render once.
  app = await launchApp(userDataDir);
  window = await app.firstWindow();
  await expect(window.getByText('Roblox')).toBeVisible();
  await app.close();
});
