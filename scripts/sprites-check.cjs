// Visual checks for the supplied sheets, against development or built preview.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { startGame } = require('./story-helpers.cjs');
const path = require('node:path');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], sheets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (/\/(zeus|tileset|totem|madera|metal|nubes|water|mirror).*\.png/.test(response.url())) {
      if (![200, 304].includes(response.status())) errors.push(`Sheet HTTP ${response.status()}: ${response.url()}`);
      sheets.push(response.url());
    }
  });
  await page.goto(process.argv[4] || 'http://127.0.0.1:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await startGame(page);
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.waitForSelector('#level-name');
  await page.waitForTimeout(500);
  assert.equal(new Set(sheets).size, 8, 'All eight game sheets must load in the build');
  const aim = async (x, y) => {
    const point = await page.evaluate(({ x, y }) => {
      const box = document.querySelector('#game canvas').getBoundingClientRect();
      const scale = Math.min((box.width - 44) / 16.5, (box.height - 310) / 8.5);
      return { x: box.x + box.width / 2 + x * scale, y: box.y + box.height / 2 - (y - .1) * scale };
    }, { x, y });
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(50);
  };
  const screenshot = name => page.screenshot({ path: path.resolve(`artifacts/sprites-${name}.png`) });
  await aim(4, 1.5);
  await screenshot('idle');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#ammo').textContent === '2');
  await page.waitForTimeout(390);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#overlay').hidden);
  await page.evaluate(() => { document.querySelector('#overlay').style.visibility = 'hidden'; });
  await page.waitForTimeout(50);
  await screenshot('casting');
  const frozen = await page.locator('#game').screenshot();
  await page.waitForTimeout(400);
  assert.ok(frozen.equals(await page.locator('#game').screenshot()), 'Pause must freeze the sprite and ray');
  await page.evaluate(() => { document.querySelector('#overlay').style.visibility = ''; });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Victory!');
  await page.evaluate(() => { document.querySelector('#overlay').style.visibility = 'hidden'; });
  await screenshot('victory');
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#start-button').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.waitForSelector('#level-name');
  await page.waitForTimeout(500);
  await aim(-6, -1.5);
  await screenshot('left');
  for (let shot = 0; shot < 3; shot++) {
    await page.keyboard.press('Space');
    await page.waitForFunction(remaining => document.querySelector('#ammo').textContent === String(remaining), 2 - shot);
    if (shot < 2) await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
  }
  await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'There Is More to Learn');
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.querySelector('#overlay').style.visibility = 'hidden'; });
  await screenshot('lost');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('zeus-progress-v1'));
    save.stars.bronze = 3;
    localStorage.setItem('zeus-progress-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#start-button').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.locator('#home').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'title');
  await page.locator('#levels-button').click();
  await page.waitForSelector('[data-level="2"]:enabled');
  await page.locator('[data-level="2"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.waitForFunction(() => document.querySelector('#level-name').textContent === 'A New Direction');
  await page.waitForTimeout(100);
  await aim(1.7, -1.5);
  await page.waitForFunction(() => document.querySelector('#game').style.cursor === 'grab');
  await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('#game').style.cursor === 'grabbing');
  await aim(1.8, -.7);
  assert.match(await page.locator('#hint').textContent(), /Rotate freely/);
  await page.mouse.up();
  await screenshot('mirror-size');
  assert.equal(await page.locator('#ammo').textContent(), '3', 'Dragging the new outer rim must not fire');
  await aim(1, -1.5);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Victory!');
  assert.deepEqual(errors, []);
  console.log('Sprite checks passed: eight sheets, idle, mirrored aim, cropped cast, frozen pause, victory, loss and mirror rim rotation.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
