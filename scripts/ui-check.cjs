const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { startGame, optionAction } = require('./story-helpers.cjs');
const path = require('node:path');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.waitForSelector('#start-button:enabled');
  const checkTitleButtons = async () => {
    const sizes = await page.locator('#title-screen > button:visible').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect(), style = getComputedStyle(button);
      return [box.width, box.height, style.fontSize, style.fontFamily];
    }));
    assert.ok(sizes.every(size => JSON.stringify(size) === JSON.stringify(sizes[0])), 'Title buttons share dimensions and typography');
  };
  await checkTitleButtons();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#levels-button').isVisible(), false);
  assert.equal(await page.evaluate(() => document.fonts.check('400 16px Cinzel') && document.fonts.check('400 16px "Pixelify Sans"')), true);
  await page.screenshot({ path: path.resolve('artifacts/ui-title.png') });
  await startGame(page);
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  assert.equal(await page.locator('#current-level').textContent(), '01');
  assert.equal(await page.locator('.level-nav, #level-select').count(), 0);
  assert.equal(await page.locator('.ammo-pip').count(), 3);
  assert.equal(await page.locator('.ammo-pip.spent').count(), 0);
  await page.screenshot({ path: path.resolve('artifacts/ui-game.png') });
  await page.locator('#pause').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'paused');
  assert.equal(await page.locator('#dialog-title').textContent(), 'Options');
  assert.equal(await page.locator('.bottom-panel button').count(), 0, 'Secondary buttons must leave the footer clear');
  assert.equal(await page.locator('#option-actions button:visible').count(), 4);
  const frozenClock = await page.locator('#clock').textContent();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#clock').textContent(), frozenClock, 'Options freezes the level clock');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#sound').evaluate(button => button === document.activeElement), true, 'Focus wraps inside the modal');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#dialog-button').evaluate(button => button === document.activeElement), true);
  await page.screenshot({ path: path.resolve('artifacts/ui-pause.png') });
  assert.equal(await page.locator('.ammo-pip.spent').count(), 0, 'UI clicks must not fire');
  await page.locator('#dialog-button').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.mouse.move(670, 330);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelectorAll('.ammo-pip.spent').length === 1);
  await optionAction(page, 'restart');
  await page.waitForFunction(() => document.querySelectorAll('.ammo-pip.spent').length === 0);
  const { levels } = await import('../src/levels.js');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: true })), levels.map(level => level.id));
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await checkTitleButtons();
  await page.screenshot({ path: path.resolve('artifacts/ui-title-unlocked.png') });
  await page.locator('#levels-button').click();
  await page.locator('[data-level="14"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.waitForFunction(() => document.querySelectorAll('.ammo-pip').length === 5);
  await page.screenshot({ path: path.resolve('artifacts/ui-five-rays.png') });
  const checkFits = () => page.evaluate(() => {
    const top = document.querySelector('.topbar').getBoundingClientRect();
    const bottom = document.querySelector('.bottom-panel').getBoundingClientRect();
    const controls = [...document.querySelectorAll('.controls button')].map(button => button.getBoundingClientRect());
    return document.documentElement.scrollWidth <= innerWidth && top.right <= innerWidth && bottom.bottom <= innerHeight && controls.every(box => box.left >= 0 && box.right <= innerWidth);
  });
  for (const [width, height, name] of [[390, 740, 'narrow'], [844, 500, 'short']]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    assert.equal(await checkFits(), true, `HUD and controls must fit ${name}`);
    if (name === 'short') {
      assert.equal(await page.evaluate(() => {
        const top = document.querySelector('.topbar').getBoundingClientRect();
        const current = document.querySelector('.current-level').getBoundingClientRect();
        return current.left >= top.left && current.right <= top.right;
      }), true, 'Resizing must keep the active lesson visible');
      assert.equal(await page.evaluate(() => {
        const scale = Math.max(8, Math.min((innerWidth - 44) / 16.5, (innerHeight - 285) / 8.5));
        const top = innerHeight / 2 + (.6 - 4.25) * scale;
        const bottom = innerHeight / 2 + (.6 + 4.25) * scale;
        return document.querySelector('.lesson-info').getBoundingClientRect().bottom < top && document.querySelector('.bottom-panel').getBoundingClientRect().top > bottom;
      }), true, 'The board must stay between the lesson and controls in short windows');
    }
    await page.screenshot({ path: path.resolve(`artifacts/ui-${name}.png`) });
    await page.locator('#pause').click();
    await page.waitForFunction(() => document.body.dataset.mode === 'paused');
    const dialog = await page.locator('.dialog').boundingBox();
    assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height, 'Pause must fit the viewport');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.dataset.mode === 'playing');
    assert.equal(await page.locator('#pause').evaluate(button => button === document.activeElement), true, 'Closing options restores focus');
  }
  const checkDialog = async () => {
    await page.waitForSelector('#option-actions:not([hidden])');
    assert.equal(await page.locator('#option-actions button:visible').count(), 4);
    const layout = await page.locator('.dialog').evaluate(dialog => {
      const box = dialog.getBoundingClientRect();
      const buttons = [...dialog.querySelectorAll('button')].filter(button => button.checkVisibility());
      return { fits: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
        noScroll: dialog.scrollHeight <= dialog.clientHeight && dialog.scrollWidth <= dialog.clientWidth,
        actionsVisible: buttons.every(button => { const b = button.getBoundingClientRect(); return b.top >= box.top && b.bottom <= box.bottom && b.left >= box.left && b.right <= box.right; }) };
    });
    assert.deepEqual(layout, { fits: true, noScroll: true, actionsVisible: true }, 'The modal and every action must fit without scroll or clipping');
  };
  await page.locator('#pause').click();
  await page.waitForSelector('body[data-mode="paused"]');
  for (const [width, height] of [[390, 740], [320, 568], [568, 320], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await checkDialog();
  }
  await page.screenshot({ path: path.resolve('artifacts/options-compact-landscape.png') });
  await optionAction(page, 'home');
  await page.waitForSelector('body[data-mode="title"]');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#levels-button').click();
  await page.locator('[data-level="0"]').click();
  await page.waitForSelector('body[data-mode="playing"]');
  await page.mouse.move(640, 200);
  for (let shot = 0; shot < 3; shot++) {
    await page.keyboard.press('Space');
    await page.waitForFunction(count => Number(document.querySelector('#ammo').textContent) === count, 2 - shot);
    if (shot < 2) await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
  }
  await page.waitForSelector('body[data-mode="lost"]');
  for (const [width, height] of [[1280, 800], [390, 740], [320, 568], [568, 320], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await checkDialog();
  }
  await page.screenshot({ path: path.resolve('artifacts/retry-compact-landscape.png') });
  assert.deepEqual(errors, []);
  console.log('UI check passed: local fonts, Mana Soul states, 3/5 ammunition pips, spending/reset, isolated UI clicks, narrow/short HUD and dialogs.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
