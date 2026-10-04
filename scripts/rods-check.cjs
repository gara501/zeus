const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
let browser;
(async () => {
 browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
 const { levels } = await import('../src/levels.js');
 const { solutionPlans } = await import('./level-solutions.js');
 for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 740 }]) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width < 700 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true, musicMuted: true })), levels.map(level => level.id));
  const point = (x, y) => page.evaluate(({ x, y }) => {
   const box = document.querySelector('#game canvas').getBoundingClientRect();
   let scale, centerY;
   if (document.querySelector('#interface.touch-mirrors:not([hidden])')) {
    const top = document.querySelector('.lesson-info').getBoundingClientRect().bottom + 12;
    const bottom = document.querySelector('.bottom-panel').getBoundingClientRect().top - 12;
    scale = Math.max(8, Math.min((box.width - 44) / 16.5, (bottom - top) / 8.5));
    centerY = (top + bottom) / 2;
   } else {
    scale = Math.max(8, Math.min((box.width - 44) / 16.5, (box.height - (box.height < 550 ? 285 : 310)) / 8.5));
    centerY = box.y + box.height / 2 + (box.height < 550 ? .6 : .1) * scale;
   }
   return { x: box.x + box.width / 2 + x * scale, y: centerY - y * scale };
  }, { x, y });
  for (const index of [8, 9, 24]) {
   await page.reload();
   await page.waitForSelector('#levels-button:visible');
   await page.locator('#levels-button').click();
   await page.locator(`[data-level="${index}"]`).click();
   await page.waitForSelector('body[data-mode="playing"]');
   await page.screenshot({ path: `artifacts/rod-${index + 1}-${viewport.width}.png` });
   for (const action of solutionPlans[index]) {
    if (action.rotate) {
     const mirrors = levels[index].mirrors.filter(m => m.rotatable).sort((a, b) => b.y - a.y || a.x - b.x);
     for (const [x, y, angle] of action.rotate) {
      if (viewport.width < 700) {
       const number = mirrors.findIndex(m => m.x === x && m.y === y);
       let degrees = (angle * 180 / Math.PI + 180) % 180;
       degrees = Math.round(degrees * 2) / 2;
       await page.locator(`#mirror-${number}`).evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, degrees);
       await page.waitForTimeout(70);
      } else {
       const center = await point(x, y), end = await point(x + .65 * Math.cos(angle), y + .65 * Math.sin(angle));
       await page.mouse.move(center.x, center.y); await page.waitForTimeout(60);
       await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 3 }); await page.waitForTimeout(60); await page.mouse.up();
      }
     }
    }
    if (action.fire) {
     await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
     const target = await point(...action.fire);
     if (viewport.width < 700) await page.touchscreen.tap(target.x, target.y);
     else { await page.mouse.move(target.x, target.y); await page.waitForTimeout(50); await page.keyboard.press('Space'); }
     await page.waitForTimeout(150);
    }
   }
   await page.waitForSelector('body[data-mode="victory"]');
   assert.equal(Number(await page.locator('#ammo').textContent()), levels[index].idealShots);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(errors, []);
  await page.close();
 }
 console.log('Rod tutorials and advanced diagonal route passed with mouse and mobile sliders/taps.');
 await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
