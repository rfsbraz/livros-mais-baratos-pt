import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const out = resolve(process.env.STORE_OUTPUT || 'store-listing');
for (const dir of ['icons', 'promo', 'screenshots', 'metadata', 'website', 'source', 'upload']) {
  await mkdir(`${out}/${dir}`, { recursive: true });
}
const root = resolve('dist/chrome');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) {
      throw Error();
    }
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[
        extname(file)
      ] || 'text/plain'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="16" y="16" width="96" height="96" rx="16" fill="#172e59"/><path d="M36 38h22v52H36z" fill="#fff"/><path d="M65 32h27v58H65z" fill="#97bbff"/><path d="M31 94h66v4H31z" fill="#fff"/></svg>`;
await writeFile(`${out}/source/icon.svg`, logo);
await writeFile(`${out}/icons/icon-master.svg`, logo);
const logoData = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;
const product = price =>
  `<html><head><title>A Criada</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn: '9789895701124', name: 'A Criada', offers: { price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></head><body><h1>A Criada</h1></body></html>`;
const baseStyle = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:'Segoe UI',Arial,sans-serif;background:#172e59;color:#fff}.brand{display:flex;align-items:center;gap:12px;font-size:21px;font-weight:600}.brand img{width:64px;height:64px}.copy{position:absolute;left:64px;top:64px;width:590px}h1{font:normal 64px/1.08 Georgia,serif;margin:65px 0 24px;letter-spacing:-1.4px}p{font-size:23px;line-height:1.5;color:#c7d9ff;max-width:515px}.footer{position:absolute;bottom:32px;left:64px;font-size:13px;color:#becfed}.frame{position:absolute;left:750px;top:68px;width:430px;height:655px;border-radius:12px;overflow:hidden;box-shadow:0 20px 65px #07152d88;background:white;border:1px solid #526c94}iframe{border:0;width:430px;height:655px}.caption{position:absolute;right:100px;bottom:39px;color:#c7d9ff;font-size:13px}.spines{display:flex;gap:14px;position:absolute;left:64px;bottom:110px;align-items:flex-end}.spines i{display:block;width:32px;height:75px;background:#97bbff;border-radius:3px}.spines i:nth-child(2){height:100px;background:#fff}.spines i:nth-child(3){height:85px;background:#3c68b0}`;
const stage = (title, copy, caption, iframe = true) =>
  `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><div class="copy"><div class="brand"><img src="${logoData}">Livros Mais Baratos PT</div><h1>${title}</h1><p>${copy}</p></div><div class="spines"><i></i><i></i><i></i></div>${iframe ? `<div class="frame"><iframe src="${origin}/popup.html"></iframe></div>` : ''}<div class="caption">${caption}</div><div class="footer">Demonstração com preços ilustrativos. Portes não incluídos.</div></body></html>`;
try {
  const icon = await browser.newPage();
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 300, 512, 1024]) {
    await icon.setViewportSize({ width: size, height: size });
    await icon.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${logo}`
    );
    await icon.screenshot({ path: `${out}/icons/icon-${size}.png`, omitBackground: true });
  }
  await icon.close();
  const promo = await browser.newPage();
  const promoSmall = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#172e59;color:white;font-family:'Segoe UI',Arial;height:280px;display:flex;align-items:center;padding:24px;gap:16px}img{width:128px;height:128px}h1{font:normal 30px/1.12 Georgia;margin:0}small{display:block;font:14px 'Segoe UI';color:#bbd2ff;margin-top:18px}</style><img src="${logoData}"><h1>Livros Mais<br>Baratos PT<small>O mesmo livro.<br>Um preço melhor.</small></h1>`;
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.setContent(promoSmall);
  await promo.screenshot({ path: `${out}/promo/small-440x280.png` });
  await writeFile(`${out}/source/promo-small.html`, promoSmall);
  const marquee = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#172e59;color:white;width:1400px;height:560px;font-family:'Segoe UI',Arial}.brand{position:absolute;left:80px;top:65px;font-size:26px}h1{position:absolute;left:80px;top:155px;font:normal 68px/1.12 Georgia;margin:0;letter-spacing:-1px}p{position:absolute;left:82px;bottom:62px;font-size:22px;color:#c7d9ff}img{position:absolute;right:90px;top:65px;width:430px;height:430px;transform:rotate(-7deg)}.shelf{position:absolute;right:72px;bottom:72px;width:445px;height:5px;background:#7198dc}</style><div class="brand">Livros Mais Baratos PT</div><h1>O mesmo livro.<br>Um preço melhor.</h1><p>Avisos automáticos para a mesma edição.</p><div class="shelf"></div><img src="${logoData}">`;
  await promo.setViewportSize({ width: 1400, height: 560 });
  await promo.setContent(marquee);
  await promo.screenshot({ path: `${out}/promo/marquee-1400x560.png` });
  await writeFile(`${out}/source/promo-marquee.html`, marquee);
  await promo.close();
  const scenes = [
    [
      '02-comparar-edicao',
      'Compara o total.<br>Inclui os portes.',
      'A mesma edição, com portes estimados.<br>Custos desconhecidos ficam identificados.',
      'Interface real · comparação manual',
      'compare'
    ],
    [
      '03-portes-e-campanhas',
      'Portes claros.<br>Campanhas com fim.',
      'Define os portes e mínimos da loja.<br>As campanhas só valem<br>dentro das datas indicadas.',
      'Interface real · regras introduzidas pelo utilizador',
      'shipping'
    ],
    [
      '04-estante-historico',
      'O preço ao longo<br>das tuas consultas.',
      'Só observações desta instalação.<br>Sem históricos de terceiros.',
      'Interface real · dados de demonstração',
      'history'
    ],
    [
      '05-precos-alvo',
      'Define o preço.<br>Recebe um aviso.',
      'Guarda um alvo para o livro<br>ou para o total com portes.<br>As consultas são agendadas.',
      'Interface real · preços-alvo da estante',
      'targets'
    ]
  ];
  for (const [name, title, copy, caption, mode] of scenes) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1
    });
    const data = {
      selectedStores: ['wook', 'bertrand', 'continente', 'bookcover'],
      autoEnabled: true,
      saved: {
        9789895701124: { isbn: '9789895701124', title: 'A Criada' },
        9789723830637: { isbn: '9789723830637', title: 'A Leste do Paraíso' },
        9789722369718: { isbn: '9789722369718', title: 'Antes que o Café Arrefeça' }
      },
      history: {
        9789895701124: [
          {
            store: 'wook',
            price: 1946,
            currency: 'EUR',
            condition: 'NewCondition',
            availability: 'InStock',
            at: Date.UTC(2026, 10, 2, 12)
          },
          {
            store: 'bertrand',
            price: 1751,
            currency: 'EUR',
            condition: 'NewCondition',
            availability: 'InStock',
            at: Date.UTC(2026, 10, 2, 12)
          }
        ]
      }
    };
    data.shipping = {
      region: 'mainland',
      rules: {
        mainland: {
          bertrand: { source: 'manual', fee: 350, expiresAt: Date.UTC(2026, 10, 5, 12) },
          continente: { source: 'manual', fee: 499, expiresAt: Date.UTC(2026, 10, 5, 12) }
        }
      }
    };
    data.history['9789895701124'].unshift({
      store: 'wook',
      price: 2240,
      currency: 'EUR',
      condition: 'NewCondition',
      at: Date.UTC(2026, 9, 28, 12),
      source: 'manual'
    });
    if (mode === 'targets') {
      data.saved = {
        9789895701124: {
          isbn: '9789895701124',
          title: 'A Criada',
          watch: { enabled: true, target: 1850, basis: 'delivered' }
        }
      };
    }
    if (mode === 'enable') {
      delete data.selectedStores;
      delete data.autoEnabled;
      data.saved = {};
      data.history = {};
    }
    await page.addInitScript(
      ({ data, html }) => {
        let state = structuredClone(data);
        window.chrome = {
          storage: {
            local: {
              get: async () => state,
              set: async x => {
                state = { ...state, ...x };
              }
            }
          },
          permissions: { contains: async () => true },
          tabs: { query: async () => [{ id: 1, url: 'https://www.wook.pt/livro/a-criada' }] },
          scripting: { executeScript: async () => [{ result: { html } }] }
        };
      },
      { data, html: product('20.00') }
    );
    await page.route('https://**/*', r => r.fulfill({ status: 403, body: 'No fixture' }));
    await page.route('https://www.wook.pt/**', r =>
      r.fulfill({ contentType: 'text/html', body: product('20.00') })
    );
    await page.route('https://www.bertrand.pt/**', r =>
      r.fulfill({ contentType: 'text/html', body: product('18.00') })
    );
    await page.route('https://www.continente.pt/**', r =>
      r.fulfill({ contentType: 'text/html', body: product('19.00') })
    );
    await page.route('https://bookcover.pt/**', r =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            sku: '9789895701124',
            type: 'simple',
            name: 'A Criada',
            prices: { price: '1750', currency_code: 'EUR', currency_minor_unit: 2 },
            permalink: 'https://bookcover.pt/product/a-criada',
            is_in_stock: false
          }
        ])
      })
    );
    await page.setContent(stage(title, copy, caption));
    const f = page.frameLocator('iframe');
    await f.locator('#isbn').inputValue();
    await f.locator('#book').waitFor({ state: 'visible' });
    if (mode === 'compare' || mode === 'history') {
      await f.locator('#compare').click();
      await f.locator('#status').filter({ hasText: '4 de 4 preços' }).waitFor();
      if (mode === 'compare') {
        await f.locator('#book').evaluate(el => window.scrollTo(0, el.offsetTop - 18));
      } else {
        await page.addStyleTag({ content: '.frame{top:150px;height:500px}iframe{height:500px}' });
        await f.locator('#history-section').evaluate(el => (el.open = true));
        await f.locator('#history-section').evaluate(el => window.scrollTo(0, el.offsetTop - 18));
      }
    }
    if (mode === 'shipping') {
      await f.locator('#open-settings').click();
      await f.locator('#delivery-settings').evaluate(el => (el.open = true));
      await f.locator('#shipping-store').selectOption('bertrand');
      await f.locator('#shipping-minimum').fill('25.00');
      await f.locator('#shipping-promo').check();
      await f.locator('#promo-end').fill('2026-11-10T23:59');
      await f.locator('#shipping-form').evaluate(el => window.scrollTo(0, el.offsetTop - 10));
    }
    if (mode === 'targets') {
      await page.addStyleTag({ content: '.frame{top:140px;height:480px}iframe{height:480px}' });
      await f.locator('body').evaluate(el => (el.style.paddingBottom = '400px'));
      await f.locator('.saved').evaluate(el => window.scrollTo(0, el.offsetTop - 20));
    }
    if (mode === 'shops') {
      await f.locator('#open-settings').click();
      await f.locator('#shops').evaluate(el => (el.open = true));
      await f.locator('#shops').evaluate(el => window.scrollTo(0, el.offsetTop));
    }
    if (mode === 'enable') {
      assert.equal(await f.locator('#auto-toggle').getAttribute('aria-pressed'), 'true');
      await page.addStyleTag({ content: '.frame{top:105px;height:550px}iframe{height:550px}' });
    }
    await f.locator('body').evaluate(() => document.activeElement?.blur());
    await page.screenshot({ path: `${out}/screenshots/${name}-1280x800.png` });
    await writeFile(`${out}/source/${name}.html`, stage(title, copy, caption));
    await page.close();
  }
  // Run the shipping content-script UI with a deterministic reply; do not draw a mock notification.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC' });
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00Z'));
  const scene = stage(
    'Um aviso.<br>Uma opção<br>mais barata.',
    'Continua na página do livro.<br>A extensão mostra a poupança<br>e a ligação para a outra loja.',
    'Aviso real · página de demonstração',
    false
  );
  const demo = `<div style="position:absolute;right:60px;top:70px;width:480px;height:600px;background:#eef3fc;border-radius:12px;padding:30px;color:#172e59"><div style="font-size:13px;color:#536278;border-bottom:1px solid #d1dcee;padding-bottom:18px">Página de livro · demonstração</div><div style="display:flex;gap:26px;margin-top:32px"><div style="width:130px;height:185px;flex-shrink:0;background:#2458bb;color:white;padding:20px;font:25px/1.2 Georgia;border-left:7px solid #173f8f">A Criada<small style="display:block;font:11px Arial;margin-top:48px">Freida McFadden</small></div><div><h2 style="font:30px Georgia;margin:10px 0">A Criada</h2><p style="font-size:14px;color:#536278">Freida McFadden</p><strong style="font-size:30px">20,00 €</strong><p style="font-size:12px;color:#536278">ISBN 9789895701124</p></div></div></div>`;
  await page.route('https://www.wook.pt/**', r =>
    r.fulfill({
      contentType: 'text/html',
      body: scene.replace(
        '</body>',
        `${demo}<script type="application/ld+json">${JSON.stringify({ '@type': 'Book', isbn: '9789895701124', name: 'A Criada', offers: { price: '20.00', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } })}</script></body>`
      )
    })
  );
  await page.route(`${origin}/**`, async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'access-control-allow-origin': '*',
        'access-control-allow-private-network': 'true'
      }
    });
  });
  await page.addInitScript(
    ({ origin }) => {
      window.chrome = {
        runtime: {
          getURL: p => origin + '/' + p,
          sendMessage: async () => ({
            isbn: '9789895701124',
            name: 'Bertrand',
            url: 'https://www.bertrand.pt/pesquisa/9789895701124',
            price: 1800,
            currency: 'EUR',
            saving: 200,
            checkedAt: Date.UTC(2026, 10, 3, 12, 30)
          }),
          onMessage: { addListener() {}, removeListener() {} }
        },
        storage: {
          local: { get: async () => ({ autoEnabled: true, selectedStores: ['wook', 'bertrand'] }) },
          onChanged: { addListener() {}, removeListener() {} }
        }
      };
    },
    { origin }
  );
  await page.goto('https://www.wook.pt/livro/a-criada');
  // Bundled local modules are fulfilled over the same HTTPS demo origin to avoid mixed-content restrictions.
  await page.route('https://www.wook.pt/modules/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({
      contentType: 'text/javascript',
      body: await readFile(`${root}/${file}`, 'utf8')
    });
  });
  await page.evaluate(async () => {
    (await import('/modules/content-main.js')).start();
  });
  await page.locator('#lmb-price-alert').waitFor();
  await page.locator('#lmb-price-alert').evaluate(el => {
    el.style.right = '86px';
    el.style.bottom = '100px';
    el.style.width = '430px';
  });
  await page.screenshot({ path: `${out}/screenshots/01-aviso-automatico-1280x800.png` });
  await page.close();
  const preview = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const imgs = [];
  for (const file of [
    '01-aviso-automatico',
    '02-comparar-edicao',
    '03-portes-e-campanhas',
    '04-estante-historico',
    '05-precos-alvo'
  ]) {
    imgs.push({
      file: `${file}-1280x800.png`,
      src: `data:image/png;base64,${(await readFile(`${out}/screenshots/${file}-1280x800.png`)).toString('base64')}`
    });
  }
  await preview.setContent(
    `<style>body{background:#e5ebf4;font:16px Arial;margin:25px;color:#172e59}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;border-radius:8px}p{margin:6px 0}</style><h1>Livros Mais Baratos PT · Chrome Web Store</h1><main>${imgs.map(x => `<div><img src="${x.src}"><p>${x.file}</p></div>`).join('')}</main>`
  );
  await preview.screenshot({ path: `${out}/preview.png`, fullPage: true });
  await preview.close();
  const pngs = [
    ...imgs.map(x => `screenshots/${x.file}`),
    'promo/small-440x280.png',
    'promo/marquee-1400x560.png',
    ...[16, 24, 32, 48, 64, 96, 128, 256, 300, 512, 1024].map(n => `icons/icon-${n}.png`)
  ];
  const inventory = [];
  for (const file of pngs) {
    const b = await readFile(`${out}/${file}`);
    const w = b.readUInt32BE(16),
      h = b.readUInt32BE(20);
    if (file.startsWith('screenshots')) {
      assert(w === 1280 && h === 800);
    }
    inventory.push({ file, width: w, height: h, bytes: b.length, colorType: b[25] });
  }
  await writeFile(
    `${out}/asset-manifest.json`,
    JSON.stringify({ demoDate: '2026-11-04', version, assets: inventory }, null, 2)
  );
  await cp('dist/chrome', `${out}/source/extension`, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await cp(`${out}/icons/icon-${size}.png`, `${out}/source/extension/icons/${size}.png`);
  }
  const manifest = JSON.parse(await readFile(`${out}/source/extension/manifest.json`, 'utf8'));
  manifest.description =
    'Compara livros em Portugal com portes estimados, alertas de preço-alvo e histórico das tuas próprias consultas.';
  assert(manifest.description.length <= 132);
  await writeFile(
    `${out}/source/extension/manifest.json`,
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await cp('LICENSE', `${out}/source/extension/LICENSE`);
  await cp(
    `dist/livros-mais-baratos-pt-${version}.zip`,
    `${out}/upload/livros-mais-baratos-pt-${version}-store.zip`
  );
  console.log(
    JSON.stringify({
      output: out,
      assets: inventory.length,
      summaryCharacters: manifest.description.length
    })
  );
} finally {
  await browser.close();
  server.close();
}
