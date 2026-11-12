import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
test('native Chromium regression suite', () => {
  for (const file of [
    'browser',
    'extension-smoke',
    'automatic',
    'watch-browser',
    'voucher',
    'metrics-browser',
    'worker-restart',
    'store-availability'
  ]) {
    execFileSync(process.execPath, ['tests/e2e/' + file + '.mjs'], {
      stdio: 'inherit',
      timeout: 90000
    });
  }
});

test('popup store links use the available referral', () => {
  execFileSync(process.execPath, ['tests/e2e/popup-affiliate.mjs'], {
    stdio: 'inherit',
    timeout: 90000
  });
});
