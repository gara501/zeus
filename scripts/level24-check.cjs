const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const { levels } = await import('../src/levels.js');
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 740 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
    await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true, musicMuted: true })), levels.map(level => level.id));
    await page.reload();
    await page.waitForSelector('#start-button:enabled');
    const activate = locator => mobile ? locator.tap() : locator.click();
    await activate(page.locator('#levels-button'));
    await activate(page.locator('[data-level="23"]'));
    await page.waitForSelector('body[data-mode="playing"]');
    assert.equal(await page.locator('#level-name').textContent(), 'The Return of Thunder');
    const position = (x, y) => page.evaluate(({ x, y, mobile }) => {
      const canvas = document.querySelector('#game canvas').getBoundingClientRect();
      const top = document.querySelector('.lesson-info').getBoundingClientRect().bottom + 12;
      const bottom = document.querySelector('.bottom-panel').getBoundingClientRect().top - 12;
      const scale = Math.max(8, Math.min((canvas.width - 44) / 16.5, (mobile ? bottom - top : canvas.height - 310) / 8.5));
      return { x: canvas.width / 2 + x * scale, y: (mobile ? (top + bottom) / 2 : canvas.height / 2 + .1 * scale) - y * scale };
    }, { x, y, mobile });
    if (mobile) {
      for (const id of ['mirror-0', 'mirror-1']) {
        await page.locator(`#${id}`).focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
        await page.locator(`#${id}`).evaluate(input => { input.value = '45'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      }
      await page.waitForFunction(() => [...document.querySelectorAll('.mirror-lever output')].every(output => output.textContent === '45.0°'));
    } else {
      for (const y of [-2.5, 1.5]) {
        const center = await position(-4, y), end = await position(-3.4, y + .6);
        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.waitForTimeout(80);
        await page.mouse.up();
      }
    }
    assert.equal(await page.locator('#ammo').textContent(), '0');
    await page.screenshot({ path: `artifacts/level24-${mobile ? 'mobile' : 'desktop'}.png` });
    const point = await position(-4, -2.5);
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else { await page.mouse.move(point.x, point.y); await page.keyboard.press('Space'); }
    await page.waitForFunction(() => document.querySelector('#ammo').textContent === '1');
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#shot-state').textContent(), 'Bolt in flight · wait until it finishes');
    if (!mobile) {
      await page.locator('#pause').click();
      await page.waitForSelector('body[data-mode="paused"]');
      const clock = await page.locator('#clock').textContent();
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('#clock').textContent(), clock);
      await page.locator('#dialog-button').click();
    }
    await page.waitForSelector('body[data-mode="victory"]');
    assert.equal(await page.locator('#ammo').textContent(), '1');
    assert.deepEqual(errors, []);
    console.log(`Level 24 passed on ${mobile ? 'mobile' : 'desktop'}: two adjustable mirrors, full cloud relay, one-bolt victory.`);
    await page.close();
  }
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
