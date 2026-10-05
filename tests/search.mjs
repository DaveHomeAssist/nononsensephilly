import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root = process.cwd();
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = process.env.NNP_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[375,812], [844,390], [1440,900]]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(theme => localStorage.setItem('nononsense-theme', theme), theme);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#find-open').click();
    assert.equal(await page.locator('#find-dlg').evaluate(el => el.matches(':modal')), true);
    assert.equal(await page.locator('#find-q').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#find-list button').first().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#find-list button').nth(1).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#find-close').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#find-list button').last().evaluate(el => el === document.activeElement), true);
    await page.locator('#find-q').fill('zzzz-no-match');
    assert.equal(await page.locator('#find-hint').textContent(), 'Nothing matches.');
    assert.equal(await page.locator('#find-list button').count(), 0);
    await page.locator('#find-q').fill('');
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const report = await page.evaluate(async () => axe.run(document.querySelector('#find-dlg')));
    assert.deepEqual(report.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })), []);
    const rect = await page.locator('.find-card').boundingBox();
    assert.ok(rect.y >= 0 && rect.y + rect.height <= height + 1, 'Search fits the viewport');
    if (process.env.SCREENSHOTS) await page.screenshot({ path: `/tmp/nnp-search-${width}-${theme}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#find-dlg').isVisible(), false);
    assert.equal(await page.locator('#find-open').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('/');
    await page.locator('#find-q').fill('After');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#find-dlg').isVisible(), false);
    assert.ok(await page.locator('dialog[open]').count() > 0, 'Search result opens its destination dialog');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px ${theme}: modal, focus, keyboard selection, empty state, axe and destination`);
  }
  const page = await browser.newPage();
  const malicious = '<img src=x onerror="window.INJECTED=true"> & title';
  const findSource = await readFile('find.js', 'utf8');
  await page.route('**/find.js', route => route.fulfill({ contentType: 'text/javascript', body: `document.querySelector('#event-grid article h3').textContent=${JSON.stringify(malicious)};\n${findSource}` }));
  await page.goto(origin);
  await page.locator('#find-open').click();
  await page.locator('#find-q').fill('onerror');
  assert.match(await page.locator('#find-list').innerText(), /<img src=x onerror=/);
  assert.equal(await page.locator('#find-list img').count(), 0);
  assert.equal(await page.evaluate(() => window.INJECTED), undefined);
  console.log('PASS search titles stay literal text');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
