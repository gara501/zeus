const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { optionAction } = require('./story-helpers.cjs');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 740 }]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 700 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
    await page.waitForSelector('#levels-button:visible');
    await page.locator('#levels-button').click();
    await page.locator('[data-level="0"]').click();
    await page.waitForSelector('body[data-mode="playing"]');
    const shoot = async (x, y) => {
      const point = await page.evaluate(({ x, y }) => {
        const canvas = document.querySelector('#game canvas').getBoundingClientRect();
        const scale = Math.min((canvas.width - 44) / 16.5, (canvas.height - 310) / 8.5);
        return { x: canvas.x + canvas.width / 2 + x * scale, y: canvas.y + canvas.height / 2 - (y - .1) * scale };
      }, { x, y });
      if (viewport.width < 700) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    };
    for (let shot = 1; shot <= 6; shot++) {
      await shoot(-6, -1.5);
      await page.waitForFunction(shot => Number(document.querySelector('#ammo').textContent) === shot, shot);
      await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
      assert.equal(await page.locator('body').getAttribute('data-mode'), 'playing');
    }
    assert.equal(await page.locator('#ammo-pips').textContent(), '6 · ∞');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shoot(4, 1.5);
    await page.waitForSelector('body[data-mode="victory"]');
    assert.equal(await page.locator('#stars').textContent(), '★☆☆');
    assert.equal(await page.locator('#ammo').textContent(), '7');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zeus-progress-v1')).stars['first-spark']), 1);
    await page.reload();
    await page.waitForSelector('#levels-button:visible');
    await page.locator('#levels-button').click();
    await page.locator('[data-level="0"]').click();
    await page.waitForSelector('body[data-mode="playing"]');
    assert.equal(await page.locator('#ammo').textContent(), '0');
    await shoot(-6, -1.5);
    await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
    await optionAction(page, 'restart', viewport.width < 700);
    await page.waitForFunction(() => document.querySelector('#ammo').textContent === '0');
    await shoot(4, 1.5);
    await page.waitForSelector('body[data-mode="victory"]');
    assert.equal(await page.locator('#stars').textContent(), '★★★');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zeus-progress-v1')).stars['first-spark']), 3);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Unlimited bolts passed on desktop and touch: six misses, victory, stars, reset, saved progress and HUD fit.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
