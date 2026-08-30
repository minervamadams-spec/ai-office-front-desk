import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('fresh launch shows the Welcome step, not a blank window', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();
  await expect(window.getByText('Your dashboard lives on this computer')).toBeVisible();
  await app.close();
});

test('Explore with examples lands on a populated dashboard', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();
  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await expect(window.getByText('Front Desk pilot rollout')).toBeVisible();
  await expect(window.getByText('CONNECTED SERVICES')).toBeVisible();
  await app.close();
});

test('full manual setup: name the desk, skip connections, finish, see it on the dashboard', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();

  await window.getByRole('button', { name: 'Start setup' }).click();
  await window.getByLabel('Desk name').fill('E2E Test Desk');
  await window.getByLabel('Desk name').blur();
  await window.getByRole('button', { name: 'Next', exact: true }).click(); // Profile -> Connections
  await window.getByRole('button', { name: 'Skip for now' }).click(); // Connections -> Layout
  await window.getByRole('button', { name: 'Next', exact: true }).click(); // Layout -> Finish
  await window.getByRole('button', { name: 'Go to my Front Desk' }).click();

  await expect(window.getByText('E2E Test Desk')).toBeVisible();
  await app.close();
});

test('Settings shows connector status and Delete local app data returns to a fresh Welcome step', async () => {
  const app = await launchApp();
  const window = await app.firstWindow();

  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await expect(window.getByText('Front Desk pilot rollout')).toBeVisible();

  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(window.getByText('Jira connection')).toBeVisible();
  await window.getByRole('button', { name: 'Delete local app data', exact: true }).click();
  await window.getByRole('button', { name: 'Confirm delete' }).click();

  await expect(window.getByText('Your dashboard lives on this computer')).toBeVisible();
  await app.close();
});
