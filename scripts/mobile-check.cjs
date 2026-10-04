const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { revealStory, optionAction } = require('./story-helpers.cjs');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const context = await browser.newContext({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#start-button').tap();
  await page.waitForSelector('body[data-mode="story"]');
  // Track actual rendered lines, including automatic replacement and viewport changes.
  await page.evaluate(() => {
    window.captionSamples = [];
    const sample = () => {
      const text = document.querySelector('#story-text');
      if (document.body.dataset.mode === 'story') {
        const range = document.createRange(); range.selectNodeContents(text);
        const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)));
        window.captionSamples.push({ text: text.textContent, lines: lines.size, fragment: document.querySelector('#cinematics').dataset.storyFragment });
      }
      requestAnimationFrame(sample);
    };
    sample();
  });
  await page.locator('#story-next').tap();
  const first = await page.locator('#cinematics').getAttribute('data-story-fragment');
  await page.waitForFunction(first => document.querySelector('#cinematics').dataset.storyFragment !== first, first);
  assert.equal(await page.evaluate(() => captionSamples.some(sample => sample.text === '')), true, 'Old subtitles disappear before the next fragment');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 390, height: 740 });
  await revealStory(page);
  assert.equal(await page.evaluate(() => captionSamples.every(sample => sample.lines <= 2)), true, 'Narration never exceeds two rendered lines');
  assert.ok((await page.locator('#story-scene').boundingBox()).height < 200, 'Narration leaves the scene visible');
  await page.screenshot({ path: 'artifacts/mobile-subtitles.png' });
  await page.locator('#story-next').tap();
  await page.waitForSelector('body[data-mode="playing"]');
  const { levels } = await import('../src/levels.js');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true, musicMuted: true })), levels.map(level => level.id));
  await page.reload();
  await page.waitForSelector('#levels-button:enabled');
  const select = async index => {
    await page.locator('#levels-button').tap();
    await page.locator(`[data-level="${index}"]`).tap();
    await page.waitForSelector('body[data-mode="playing"]');
  };
  const home = async () => { await optionAction(page, 'home', true); await page.waitForSelector('body[data-mode="title"]'); };
  await select(2);
  assert.equal(await page.locator('#mirror-controls input').count(), 1);
  const slider = page.locator('#mirror-0');
  const before = await slider.inputValue(), box = await slider.boundingBox();
  assert.ok(box.height >= 44);
  const cdp = await context.newCDPSession(page);
  const x = value => box.x + 8 + (box.width - 16) * value / 180;
  const touch = async (type, angle) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x(angle), y: box.y + box.height / 2 }] });
  await touch('touchStart', Number(before));
  for (const angle of [140, 110, 80, 50]) { await touch('touchMove', angle); await page.waitForTimeout(35); }
  await touch('touchEnd');
  await page.waitForTimeout(100);
  assert.notEqual(await slider.inputValue(), before, 'A real touch drag moves the assigned mirror');
  assert.equal(await page.locator('#ammo').textContent(), '0', 'A slider gesture must never fire');
  await slider.evaluate(input => { input.value = '45'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.mirror-lever output').textContent === '45.0°');
  await page.screenshot({ path: 'artifacts/mobile-mirror-controls.png' });
  const mirrorPoint = await require('./board-helpers.cjs').boardPoint(page, 1, -1.5);
  await page.touchscreen.tap(mirrorPoint.x, mirrorPoint.y);
  await page.waitForSelector('body[data-mode="victory"]');
  assert.equal(await page.locator('#ammo').textContent(), '1', 'Tapping a mirror on mobile fires the bolt and solves the rotated route');
  await page.waitForSelector('body[data-mode="playing"]');
  await home();
  await select(16);
  assert.equal(await page.locator('#mirror-controls input').count(), 2);
  await page.locator('#mirror-1').evaluate(input => { input.value = '90'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('.mirror-lever output')[1].textContent === '90.0°');
  const untouched = await page.locator('#mirror-0').inputValue();
  await optionAction(page, 'restart', true);
  await page.waitForFunction(() => document.querySelectorAll('.mirror-lever output')[1].textContent !== '90.0°');
  assert.equal(await page.locator('#mirror-0').inputValue(), untouched, 'M2 controls only its assigned mirror');
  await page.setViewportSize({ width: 844, height: 500 });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.bottom-panel').getBoundingClientRect().bottom <= innerHeight), true);
  await page.screenshot({ path: 'artifacts/mobile-mirrors-landscape.png' });
  assert.deepEqual(errors, []);
  console.log('Mobile check passed: real touch sliders, isolated input, numbered assignments, rotation/reset, tap-to-fire victory, portrait/landscape and automatic two-line subtitles.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
