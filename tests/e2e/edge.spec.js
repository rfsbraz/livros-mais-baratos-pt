import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
test('Edge metrics preserve outcomes, consent controls and the anonymous wire contract', () => {
  execFileSync(process.execPath, ['tests/e2e/metrics-browser.mjs', 'edge'], {
    stdio: 'inherit',
    timeout: 90000
  });
});
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
    await expect(page.locator('#rate-link')).toHaveAttribute(
      'href',
      'https://microsoftedge.microsoft.com/addons/detail/hcielebbeilidlkedpobbclikllnmggn'
    );
    await expect(page.locator('#report-link')).toHaveAttribute(
      'href',
      /issues\/new\?template=bug_report.yml/
    );
    await expect(page.locator('#delivery-settings')).toHaveCount(0);
    await page.locator('#open-settings').click();
    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.locator('#shop-list input:checked')).toHaveCount(6);
  } finally {
    await context.close();
  }
});
