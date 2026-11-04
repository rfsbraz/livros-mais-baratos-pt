import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
test('Edge package loads with native storage and settings', async () => {
  const root = resolve('dist/edge');
  const context = await chromium.launchPersistentContext('', {
    channel: process.env.EDGE_CHANNEL || 'msedge',
    headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto('chrome-extension://' + id + '/popup.html');
    await page.locator('#open-settings').click();
    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.locator('#shop-list input:checked')).toHaveCount(6);
  } finally {
    await context.close();
  }
});
