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
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
 for (const [width,height] of [[375,812],[844,390],[1440,900]]) {
  const page=await browser.newPage({viewport:{width,height}});let posts=0;
  await page.route('**/api/confirm-signup',async route=>{posts++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,confirmed:true})});});
  await page.goto(`${origin}/scores-api/confirm.html#${'a'.repeat(64)}`);
  assert.equal(posts,0);assert.equal(new URL(page.url()).hash,'');
  assert.equal(await page.locator('#confirm').isEnabled(),true);
  await page.evaluate(await readFile('node_modules/axe-core/axe.min.js','utf8'));
  for (const theme of ['light','dark']) {
    if(theme==='dark')await page.locator('#theme').click();
    const report=await page.evaluate(()=>axe.run());
    assert.deepEqual(report.violations.map(v=>({id:v.id,impact:v.impact})),[]);
    const bounds=await page.evaluate(()=>({h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth}));
    assert.ok(bounds.h<=height && bounds.w<=width);
  }
  await page.locator('#confirm').click();
  await page.waitForFunction(()=>document.getElementById('confirm').textContent==='Signup confirmed');
  assert.equal(posts,1);assert.equal(await page.locator('#confirm').isDisabled(),true);
  await page.reload();assert.equal(await page.locator('#confirm').isDisabled(),true);assert.equal(posts,1);
  await page.close();console.log(`PASS confirmation ${width}x${height}: explicit click, token privacy, themes, axe and bounds`);
 }
 const page=await browser.newPage();let attempt=0;
 await page.route('**/api/confirm-signup',async route=>{attempt++;await route.fulfill({status:attempt===1?503:200,contentType:'application/json',body:JSON.stringify(attempt===1?{error:'Please retry'}:{ok:true,confirmed:true})});});
 await page.goto(`${origin}/scores-api/confirm.html#${'b'.repeat(64)}`);
 await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Please retry');
 assert.equal(await page.locator('#confirm').isEnabled(),true);await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('confirm').textContent==='Signup confirmed');assert.equal(attempt,2);
 console.log('PASS confirmation failure remains retryable');
} finally {await browser.close();await new Promise(r=>server.close(r));}
