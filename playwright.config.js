import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'chromium', testMatch: 'chromium.spec.js' },
    { name: 'firefox', testMatch: 'firefox.spec.js' },
    { name: 'edge', testMatch: 'edge.spec.js' }
  ]
});
