const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { revealStory } = require('./story-helpers.cjs');
let browser, page;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { levels } = await import('../src/levels.js');
  const { UNLOCK_ALL_LEVELS } = await import('../src/config.js');
  const { solutionPlans } = await import('./level-solutions.js');
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true, musicMuted: true })), levels.slice(0, 25).map(level => level.id));
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#levels-button').click();
  await page.waitForSelector('body[data-mode="levels"]');
  assert.equal(await page.locator('.level-card').count(), 35);
  assert.equal(await page.locator('[data-level="25"]').isEnabled(), true);
  assert.equal(await page.locator('[data-level="26"]').isEnabled(), UNLOCK_ALL_LEVELS);
  await page.locator('#levels-back').click();
  await page.locator('#start-button').click();
  const scene = async (file, phrase) => {
    await page.waitForSelector('body[data-mode="story"]');
    assert.equal(await page.locator('#narrator-name').textContent(), 'EAGLE');
    assert.match(await page.locator('#scene-background').getAttribute('src'), new RegExp(file));
    assert.ok((await revealStory(page)).includes(phrase));
    await page.screenshot({ path: `artifacts/${file.replace('.png', '')}-story.png` });
    await page.locator('#story-next').click();
  };
  await scene('aguila1.png', 'master your spirit');
  const point = (x, y) => page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('#game canvas').getBoundingClientRect();
    const scale = Math.min((canvas.width - 44) / 16.5, (canvas.height - 310) / 8.5);
    return { x: canvas.width / 2 + x * scale, y: canvas.height / 2 - (y - .1) * scale };
  }, { x, y });
  for (let index = 25; index < 35; index++) {
    await page.waitForSelector('body[data-mode="playing"]');
    assert.equal(await page.locator('#level-name').textContent(), levels[index].name);
    await page.screenshot({ path: `artifacts/extension-${index + 1}.png` });
    for (const action of solutionPlans[index]) {
      if (!action.during) await page.waitForFunction(() => document.body.dataset.mode !== 'playing' || document.querySelector('#shot-state').textContent === 'Ready to fire');
      if (action.at !== undefined) await page.waitForFunction(at => Number(document.querySelector('#clock').dataset.seconds) >= at, action.at);
      for (const [x, y, angle] of action.rotate ?? []) {
        const center = await point(x, y), end = await point(x + .65 * Math.cos(angle), y + .65 * Math.sin(angle));
        await page.mouse.move(center.x, center.y);
        await page.waitForTimeout(35);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 3 });
        await page.waitForTimeout(50);
        await page.mouse.up();
      }
      if (action.fire) {
        const aim = await point(...action.fire);
        await page.mouse.move(aim.x, aim.y);
        await page.waitForTimeout(25);
        const before = await page.locator('#ammo').textContent();
        await page.keyboard.press('Space');
        await page.waitForFunction(before => document.querySelector('#ammo').textContent !== before, before);
        if (index === 30 && action.at === 3) {
          await page.waitForTimeout(1550);
          await page.screenshot({ path: 'artifacts/monster-explosion.png' });
        }
      }
    }
    await page.waitForSelector('body[data-mode="victory"]');
    assert.equal(Number(await page.locator('#ammo').textContent()), levels[index].shots - levels[index].idealShots);
    console.log(`Level ${index + 1} passed with ${levels[index].idealShots} bolts`);
    if (index === 29) await scene('aguila2.png', 'survive the Titans');
  }
  await page.waitForSelector('body[data-mode="story"]');
  assert.equal(await page.locator('#chapter-label').textContent(), 'FINAL CHAPTER');
  assert.equal(await page.locator('#narrator-name').textContent(), 'EAGLE');
  await revealStory(page);
  await page.locator('#story-next').click();
  await page.waitForSelector('#start-button:enabled');
  assert.equal(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('zeus-progress-v1')).stars).length), 35);
  assert.deepEqual(errors, []);
  console.log('Extension passed: all ten real-control routes, both eagle scenes, 35-level progression and final ending.');
  await browser.close();
})().catch(async error => { console.error(error); await page?.screenshot({ path: 'artifacts/extension-failure.png' }).catch(() => {}); await browser?.close(); process.exitCode = 1; });
