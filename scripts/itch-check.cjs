// Smoke-check an extracted release running inside a sandboxed iframe.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(process.argv[4] || 'http://127.0.0.1:4175/');
  const game = page.frameLocator('iframe');
  await game.locator('#start-button:enabled').waitFor();
  await game.locator('#start-button').click();
  await game.locator('#story-next:enabled').waitFor();
  for (let i = 0; i < 100; i++) {
    if (await game.locator('#cinematics').getAttribute('data-story-complete') === 'true') break;
    await game.locator('#story-next').click();
    await page.waitForTimeout(35);
  }
  await game.locator('#story-next').filter({ hasText: 'Begin the Journey' }).waitFor();
  await game.locator('#story-next').click();
  await game.locator('body[data-mode="playing"]').waitFor();
  assert.equal(await game.locator('#level-name').textContent(), 'The First Spark');
  assert.equal(await game.locator('#ammo').textContent(), '3');
  await game.locator('#pause').click();
  await game.locator('body[data-mode="paused"]').waitFor();
  await game.locator('#dialog-button').click();
  await game.locator('body[data-mode="playing"]').waitFor();
  await page.screenshot({ path: 'artifacts/itch-iframe.png' });
  assert.deepEqual(errors, []);
  console.log('itch.io release smoke check passed: extracted ZIP, nested asset paths, sandboxed iframe, intro, gameplay and pause.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
