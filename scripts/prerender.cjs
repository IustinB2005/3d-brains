// Regenerates the SEO assets. Run after changing the landing page:
//   python3 -m http.server 8080 &   (from the repo root)
//   node scripts/prerender.cjs
// It writes the static landing HTML into index.html (so search engines see
// real content without running JS), the social share image and the icons.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE || 'http://localhost:8080';

(async () => {
  const browser = await chromium.launch();

  // 1. Static landing HTML
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + '/');
  await page.waitForSelector('.hero');
  const html = await page.$eval('#app', (el) => el.innerHTML);
  const file = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/<!--prerender:start-->[\s\S]*<!--prerender:end-->/, `<!--prerender:start-->${html}<!--prerender:end-->`);
  fs.writeFileSync(file, out);
  console.log('index.html: pre-rendered', html.length, 'bytes');

  // 2. Social share image (1200×630)
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await og.goto(BASE + '/');
  await og.waitForSelector('.hero');
  await og.addStyleTag({ content: '.landing{max-width:1200px;padding:0 56px}.hero{padding:40px 0 0;gap:48px}.fine,.lnav-links{display:none}' });
  await og.waitForTimeout(400);
  await og.screenshot({ path: path.join(ROOT, 'assets/og-image.png') });
  console.log('assets/og-image.png');

  // 3. PNG icons from the SVG logo
  const svg = fs.readFileSync(path.join(ROOT, 'assets/logo.svg'), 'utf8');
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" style="display:block;margin:${pad}px" `)}</body></html>`);
    await p.screenshot({ path: path.join(ROOT, 'assets', name), omitBackground: true });
    console.log('assets/' + name);
  }
  await browser.close();
})();
