import { test, expect } from '@playwright/test';
import { launchApp, freshUserDataDir } from './helpers';

/** Native HTML5 drag-and-drop isn't triggered by raw mouse.move/down/up in Chromium — dispatch the
 * actual dragstart/dragover/drop DOM events with a real DataTransfer, with small pauses so React can
 * flush the dragstart state update before dragover/drop fire, mirroring real gesture timing. */
async function dragCardOnto(window: import('@playwright/test').Page, sourceEyebrow: string, targetEyebrow: string) {
  const source = window.locator('.draggable-card').filter({ has: window.locator('.eyebrow', { hasText: new RegExp(`^${sourceEyebrow}$`) }) });
  const target = window.locator('.draggable-card').filter({ has: window.locator('.eyebrow', { hasText: new RegExp(`^${targetEyebrow}$`) }) });

  await source.evaluate((el) => {
    (window as unknown as { __dt: DataTransfer }).__dt = new DataTransfer();
    el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: (window as unknown as { __dt: DataTransfer }).__dt }));
  });
  await window.waitForTimeout(50);
  await target.evaluate((el) => el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: (window as unknown as { __dt: DataTransfer }).__dt })));
  await window.waitForTimeout(50);
  await target.evaluate((el) => el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: (window as unknown as { __dt: DataTransfer }).__dt })));
  await window.waitForTimeout(50);
  await source.evaluate((el) => el.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: (window as unknown as { __dt: DataTransfer }).__dt })));
}

test('dragging a card on the live dashboard reorders it next to the drop target, and persists', async () => {
  const userDataDir = freshUserDataDir();
  const app = await launchApp(userDataDir);
  const window = await app.firstWindow();
  await window.getByRole('button', { name: 'Explore with examples' }).click();
  await window.getByText('Front Desk pilot rollout').waitFor();

  const eyebrowOrder = async () => window.evaluate(() => Array.from(document.querySelectorAll('.draggable-card .eyebrow')).map((el) => el.textContent));

  await expect.poll(eyebrowOrder).toEqual(['FOCUS', 'PROJECTS & TASKS', 'ROUTINES', 'CONNECTIONS', 'NOTES']);

  await dragCardOnto(window, 'FOCUS', 'NOTES');

  // Focus moves out of column 1 (dropping it into Notes' column) and now sits immediately before Notes.
  await expect.poll(eyebrowOrder).toEqual(['PROJECTS & TASKS', 'ROUTINES', 'CONNECTIONS', 'FOCUS', 'NOTES']);

  // Reordering the live dashboard should persist like any other design change — relaunch and confirm.
  await app.close();

  const relaunched = await launchApp(userDataDir);
  const relaunchedWindow = await relaunched.firstWindow();
  await relaunchedWindow.getByText('Front Desk pilot rollout').waitFor();
  await expect.poll(() => relaunchedWindow.evaluate(() => Array.from(document.querySelectorAll('.draggable-card .eyebrow')).map((el) => el.textContent)))
    .toEqual(['PROJECTS & TASKS', 'ROUTINES', 'CONNECTIONS', 'FOCUS', 'NOTES']);
  await relaunched.close();
});
