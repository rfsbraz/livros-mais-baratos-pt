import { buildSync, transformSync } from 'esbuild';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { zipFiles } from './zip.mjs';
export const runtimeFiles = () => [
  'affiliate.js',
  'metrics.js',
  'metrics-config.js',
  'metrics-schema.json',
  'metrics-validation.js',
  'auto-rules.js',
  'background.html',
  'background.js',
  'book-alerts-sync.js',
  'compare.js',
  'comparison-values.js',
  'comparison-metrics.js',
  'content-entry.js',
  'content-main.js',
  'content.js',
  'core.js',
  'data.js',
  'feedback.js',
  'store-links.js',
  'history-view.js',
  'offscreen.html',
  'offscreen.js',
  'parser.js',
  'promotions.js',
  'promotion-view.js',
  'popup.css',
  'popup.html',
  'popup.js',
  'price-cache.js',
  'offers.js',
  'stores.js',
  'watch.js',
  'woo-products.js',
  'shopify-search.js',
  'shopify-products.js',
  ...readdirSync('icons').map(f => 'icons/' + f),
  'LICENSE'
];
export function manifestFor(browser, source) {
  const manifest = structuredClone(source);
  if (browser === 'firefox') {
    delete manifest.minimum_chrome_version;
    manifest.permissions = manifest.permissions.filter(p => p !== 'offscreen');
    manifest.background = { page: 'background.html' };
    manifest.browser_specific_settings = {
      gecko: {
        id: 'livros-mais-baratos-pt@rfsbraz.github.io',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['websiteContent', 'browsingActivity'],
          optional: ['technicalAndInteraction']
        }
      },
      // data_collection_permissions só existe a partir do Firefox 142 para Android.
      gecko_android: { strict_min_version: '142.0' }
    };
  }
  return manifest;
}
// Firefox não tem a API offscreen e o AMO assinala qualquer chamada no código, mesmo sem execução.
export function firefoxBackground(source) {
  return transformSync(source, {
    define: { 'chrome.offscreen': 'undefined' },
    minifySyntax: true,
    target: 'firefox140'
  }).code;
}
if (process.argv[1]?.endsWith('build-multi.mjs') || process.argv[1]?.endsWith('build.mjs')) {
  const arg = process.argv.indexOf('--browser');
  const target = arg < 0 ? 'chrome' : process.argv[arg + 1];
  if (!['chrome', 'firefox', 'edge', 'all'].includes(target)) {
    throw new Error('Unknown browser');
  }
  execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
  const source = JSON.parse(readFileSync('manifest.json'));
  for (const browser of target === 'all' ? ['chrome', 'firefox', 'edge'] : [target]) {
    const dir = 'dist/' + browser;
    mkdirSync(dir, { recursive: true });
    const manifest = manifestFor(browser, source);
    writeFileSync(dir + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    for (const file of runtimeFiles()) {
      mkdirSync(dir + '/' + file.split('/').slice(0, -1).join('/'), { recursive: true });
      cpSync(file, dir + '/' + file);
    }
    if (browser === 'firefox') {
      writeFileSync(
        dir + '/background.js',
        firefoxBackground(readFileSync('background.js', 'utf8'))
      );
      buildSync({
        entryPoints: ['content-entry.js'],
        bundle: true,
        format: 'iife',
        target: 'firefox140',
        outfile: dir + '/content.js'
      });
    }
    const entries = ['manifest.json', ...runtimeFiles()].map(name => ({
      name,
      data: readFileSync(dir + '/' + name)
    }));
    const output = `dist/livros-mais-baratos-pt-${source.version}-${browser}.zip`;
    zipFiles(entries, output);
    if (browser === 'chrome') {
      cpSync(output, `dist/livros-mais-baratos-pt-${source.version}.zip`);
    }
    console.log(output);
  }
}
