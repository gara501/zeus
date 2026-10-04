const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { revealStory } = require('./story-helpers.cjs');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const page = await browser.newPage({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { levels } = await import('../src/levels.js');
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true, musicMuted: true })), levels.slice(0, 30).map(level => level.id));
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#start-button').tap();
  await page.waitForSelector('body[data-mode="story"]');
  assert.equal(await page.locator('#narrator-name').textContent(), 'EAGLE');
  await revealStory(page);
  assert.ok((await page.locator('#story-scene').boundingBox()).height < 200);
  await page.screenshot({ path: 'artifacts/eagle-mobile.png' });
  await page.locator('#story-next').tap();
  await page.waitForSelector('body[data-mode="playing"]');
  for (const [id, value] of [['mirror-0', 135], ['mirror-1', 45]]) {
    await page.locator(`#${id}`).evaluate((input, degrees) => { input.value = degrees; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }
  await page.waitForFunction(() => document.querySelector('#mirror-0').value === '135' && document.querySelector('#mirror-1').value === '45');
  const fire = async () => {
    const point = await page.evaluate(() => {
      const top = document.querySelector('.lesson-info').getBoundingClientRect().bottom + 12;
      const bottom = document.querySelector('.bottom-panel').getBoundingClientRect().top - 12;
      const scale = Math.max(8, Math.min((innerWidth - 44) / 16.5, (bottom - top) / 8.5));
      return { x: innerWidth / 2 - 2 * scale, y: (top + bottom) / 2 + 1.5 * scale };
    });
    await page.touchscreen.tap(point.x, point.y);
  };
  await fire();
  await page.waitForFunction(() => document.querySelector('#ammo').textContent === '2');
  await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
  assert.equal(await page.locator('#objectives').textContent(), '0/1', 'A frontal impact blocks the first bolt');
  await page.locator('#pause').tap();
  await page.waitForSelector('body[data-mode="paused"]');
  const time = await page.locator('#clock').getAttribute('data-seconds');
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#clock').getAttribute('data-seconds'), time, 'Pause freezes the patrol clock');
  await page.locator('#dialog-button').tap();
  await page.waitForSelector('body[data-mode="playing"]');
  await page.waitForFunction(() => Number(document.querySelector('#clock').dataset.seconds) >= 3.2);
  await fire();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/monster-mobile-explosion.png' });
  await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
  await fire();
  await page.waitForSelector('body[data-mode="victory"]');
  assert.equal(await page.locator('#ammo').textContent(), '0');
  assert.deepEqual(errors, []);
  console.log('Mobile guardians passed: eagle scene, compact subtitles, frontal block, pause, rear explosion and a real touch victory.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
