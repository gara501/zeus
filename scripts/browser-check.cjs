// Run with a Playwright installation and Chrome/Edge executable as arguments.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { startGame, revealStory, optionAction } = require('./story-helpers.cjs');
const path = require('node:path');

let browser, page;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.waitForSelector('#start-button:enabled');
  await startGame(page);
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  await startGame(page);
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await page.waitForTimeout(500);

  const position = async (x, y) => page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('#game canvas');
    const box = canvas.getBoundingClientRect();
    const padding = box.height < 550 ? 285 : 310;
    const scale = Math.max(8, Math.min((box.width - 44) / 16.5, (box.height - padding) / 8.5));
    return { x: box.x + box.width / 2 + x * scale, y: box.y + box.height / 2 - (y - (box.height < 550 ? .6 : .1)) * scale };
  }, { x, y });
  const pointAt = async (x, y) => { const point = await position(x, y); await page.mouse.move(point.x, point.y); await page.waitForTimeout(40); };
  const shootAt = async (x, y) => {
    await pointAt(x, y);
    const before = await page.locator('#ammo').textContent();
    await page.keyboard.press('Space');
    await page.waitForFunction(before => document.querySelector('#ammo').textContent !== before, before);
  };
  const text = selector => page.locator(selector).textContent();
  const story = async chapter => {
    await page.waitForFunction(() => document.body.dataset.mode === 'story');
    assert.match(await text('#chapter-label'), chapter === 4 ? /FINAL/ : new RegExp(String(chapter)));
    const clock = await text('#clock');
    await page.waitForTimeout(300);
    const partial = await text('#story-text');
    assert.ok(partial.length > 0 && partial.length < 100, 'The story starts with a typewriter effect');
    const narration = await revealStory(page);
    assert.ok(narration.length > partial.length);
    assert.equal(await text('#clock'), clock, 'Story time must not advance the puzzle');
    await page.screenshot({ path: path.resolve(`artifacts/chapter-${chapter}.png`) });
    await page.locator('#story-next').click();
  };

  assert.equal(await text('#level-name'), 'The First Spark');
  await page.screenshot({ path: path.resolve('artifacts/level-1.png') });
  await page.locator('#pause').click();
  await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Options');
  assert.equal(await text('#dialog-title'), 'Options');
  const pausedClock = await text('#clock');
  await page.waitForTimeout(1100);
  assert.equal(await text('#clock'), pausedClock);
  assert.equal(await text('#ammo'), '3');
  await page.locator('#dialog-button').click();
  await shootAt(4, 1.5);
  await page.waitForTimeout(150);
  assert.equal(await text('#shot-state'), 'Bolt in flight · wait until it finishes');
  await page.keyboard.press('Space');
  assert.equal(await text('#ammo'), '2', 'A busy shot must not spend more ammunition');
  await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Victory!');
  console.log('Level 1 and pause passed');
  assert.equal(await text('#ammo'), '2');
  await page.waitForFunction(() => document.querySelector('#level-name').textContent === 'The Secret of Bronze');
  await page.waitForTimeout(650);
  await shootAt(-1, -1.5);
  console.log('Level 2 passed');
  await page.waitForFunction(() => document.querySelector('#level-name').textContent === 'A New Direction');
  await page.waitForTimeout(650);

  await pointAt(1, -1.5);
  await page.mouse.down();
  const anglePoint = await position(1 + .8, -1.5 + .8);
  await page.mouse.move(anglePoint.x, anglePoint.y, { steps: 8 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  assert.equal(await text('#ammo'), '3', 'Dragging a mirror must not fire');
  await page.screenshot({ path: path.resolve('artifacts/level-3.png') });
  await shootAt(1, -1.5);
  const extraLevels = [
    ['The Voice of Water', -1, -1.5, 'water'],
    ['One Spark, Two Destinations', -1, -1.5, 'water-branches'],
    ['The Metal Path', -1, -1.5, 'metal'],
    ['Where Paths Meet', -1, -.5, 'metal-fork'],
    ['The Patience of Fire', 0, -.5, 'wood', 2, 3],
    ['Opening a Breach', 0, -.5, 'fragile', 3, 3],
    ['The Path You Leave', -1, -.5, 'clear-path', 4, 5],
    ['The Crystal Moment', 0, -.5, 'crystal', 1, 4],
    ['The Thunder That Waits', 0, -.5, 'charge-cloud', 1, 3],
    ['Choosing the Sky', -2, 1.5, 'cloud-trap'],
  ];
  for (const [name, x, y, image, neededShots = 1, initialCharges = 3] of extraLevels) {
    await page.waitForFunction(name => document.querySelector('#level-name').textContent === name, name);
    await page.waitForTimeout(650);
    assert.equal(await page.evaluate(() => {
        const top = document.querySelector('.topbar').getBoundingClientRect();
        const current = document.querySelector('.current-level').getBoundingClientRect();
        return current.left >= top.left && current.right <= top.right;
    }), true, 'The active lesson must stay visible in the navigation');
    await page.screenshot({ path: path.resolve(`artifacts/${image}.png`) });
    if (image === 'cloud-trap') {
      await shootAt(-2, -.5);
      await page.waitForTimeout(500);
      assert.equal(await text('#objectives'), '0/1');
      assert.equal(await text('#ammo'), '2');
      await page.keyboard.press('KeyR');
      await page.waitForFunction(() => document.querySelector('#ammo').textContent === '3');
    }
    await shootAt(x, y);
    if (image === 'water' || image === 'charge-cloud') {
      await page.waitForTimeout(430);
      const charges = await text('#ammo');
      await page.keyboard.press('Space');
      assert.equal(await text('#ammo'), charges, 'Conduction and stored charges must block another shot');
      if (image === 'charge-cloud') await page.screenshot({ path: path.resolve('artifacts/cloud-charged.png') });
      await page.locator('#pause').click();
      await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Options');
      const clock = await text('#clock');
      await page.waitForTimeout(1100);
      assert.equal(await text('#clock'), clock);
      assert.equal(await text('#objectives'), '0/1');
      await page.locator('#dialog-button').click();
    }
    for (let extra = 1; extra < neededShots; extra++) {
      await page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
      assert.equal(await text('#objectives'), '0/1');
      await page.screenshot({ path: path.resolve(`artifacts/${image}-cleared.png`) });
      await shootAt(x, y);
    }
    await page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Victory!' && !document.querySelector('#overlay').hidden);
    assert.equal(await text('#ammo'), String(initialCharges - neededShots));
    console.log(`${name} passed`);
    if (image === 'water-branches') await story(1);
    if (image === 'clear-path') await story(2);
    await page.waitForFunction(() => document.querySelector('#overlay').hidden);
  }
  const waitLesson = async name => {
    await page.waitForFunction(name => document.querySelector('#level-name').textContent === name, name);
    await page.waitForTimeout(650);
  };
  const waitReady = () => page.waitForFunction(() => document.querySelector('#shot-state').textContent === 'Ready to fire');
  const waitVictory = () => page.waitForFunction(() => document.querySelector('#dialog-title').textContent === 'Victory!' && !document.querySelector('#overlay').hidden);
  await waitLesson('The Strength of Three Sparks');
  await page.screenshot({ path: path.resolve('artifacts/multi-hit.png') });
  for (let i = 0; i < 3; i++) {
    await shootAt(3, -.5);
    if (i < 2) { await waitReady(); assert.equal(await text('#objectives'), '0/1'); }
  }
  await waitVictory();
  assert.equal(await text('#ammo'), '1');
  console.log('Multi-hit totem passed');
  await waitLesson('The Order of Thunder');
  await shootAt(3, -.5);
  await waitReady();
  assert.match(await text('#objective-status'), /Wrong order/);
  assert.equal(await text('#objectives'), '0/3');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.resolve('artifacts/ordered.png') });
  for (const [x, y] of [[0, 1.5], [3, -.5], [0, -2.5]]) {
    await shootAt(x, y);
    if (y !== -2.5) await waitReady();
  }
  await waitVictory();
  assert.equal(await text('#ammo'), '2');
  console.log('Ordered totems and wrong-order reset passed');
  await story(3);
  await waitLesson('Before the Light Fades');
  await shootAt(1, 1.5);
  await waitReady();
  assert.equal(await text('#objectives'), '1/2');
  await page.screenshot({ path: path.resolve('artifacts/timed.png') });
  await page.locator('#pause').click();
  const frozenWindow = await text('#objective-status');
  await page.waitForTimeout(1100);
  assert.equal(await text('#objective-status'), frozenWindow);
  await page.locator('#dialog-button').click();
  await page.waitForFunction(() => document.querySelector('#objectives').textContent === '0/2');
  assert.match(await text('#objective-status'), /Time expired/);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(100);
  await shootAt(1, 1.5);
  await waitReady();
  await shootAt(1, -2.5);
  await waitVictory();
  assert.equal(await text('#ammo'), '2');
  console.log('Timed totems, timeout reset and paused window passed');
  await page.waitForFunction(() => document.body.dataset.mode === 'story');
  assert.equal(await text('#chapter-label'), 'ADVANCED TRAINING');
  assert.match(await page.locator('#scene-background').getAttribute('src'), /ready.*\.png/);
  await revealStory(page);
  assert.match(await text('#story-title'), /Real Training/);
  await page.screenshot({ path: path.resolve('artifacts/ready.png') });
  await page.locator('#story-next').click();
  const rotateMirror = async (x, y, angle) => {
    await pointAt(x, y);
    await page.mouse.down();
    const point = await position(x + .8 * Math.cos(angle), y + .8 * Math.sin(angle));
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await page.waitForTimeout(60);
    await page.mouse.up();
  };
  const snapshot = name => page.screenshot({ path: path.resolve(`artifacts/advanced-${name}.png`) });
  await waitLesson('The Bronze Zigzag');
  await rotateMirror(-2, -1.5, Math.PI / 4);
  await rotateMirror(3, 1.5, -Math.PI / 4);
  await snapshot('three-bounces');
  await shootAt(-2, -1.5); await waitVictory();
  console.log('Three mirror bounces passed');
  await waitLesson('The Labyrinth Breach');
  await rotateMirror(-2, 2.5, Math.PI / 4);
  await shootAt(-2, -1.5); await waitReady();
  await snapshot('burned-route');
  await shootAt(-2, -1.5); await waitVictory();
  await waitLesson('The Pulse of the Sky');
  await shootAt(-1, -.5);
  await page.waitForTimeout(500);
  await snapshot('cloud-cycle');
  await page.locator('#pause').click();
  const frozenCycle = await text('#clock');
  await page.waitForTimeout(800);
  assert.equal(await text('#clock'), frozenCycle);
  await page.locator('#dialog-button').click();
  await waitVictory();
  await waitLesson('A Meeting of Thunder');
  await page.keyboard.press('KeyR');
  await shootAt(-1, -.5); await waitVictory();
  await waitLesson('Two Echoes, One Moment');
  await page.keyboard.press('KeyR');
  await shootAt(-2, -.5); await waitVictory();
  await waitLesson('The Hands of Thunder');
  await page.keyboard.press('KeyR');
  await shootAt(-3, -1.5);
  await page.waitForTimeout(850);
  await snapshot('return-charge');
  await rotateMirror(-3, 1.5, (Math.PI + Math.atan2(-4, 7)) / 2);
  await waitVictory();
  console.log('Cyclic clouds, crystal timing, synchronized branches and rotation during charge passed');
  await waitLesson('The Melody of Bronze');
  for (const angle of [Math.PI / 4, (Math.PI / 2 + Math.atan2(-2, 4)) / 2, -Math.PI / 4]) {
    await rotateMirror(-2, 1.5, angle);
    await shootAt(-2, -1.5);
    if (angle !== -Math.PI / 4) await waitReady();
  }
  await waitVictory();
  await waitLesson('The Return of Thunder');
  await rotateMirror(-4, -2.5, Math.PI / 4);
  await rotateMirror(-4, 1.5, Math.PI / 4);
  await shootAt(-4, -2.5); await waitVictory();
  await waitLesson('The Threshold of the Titan');
  await page.keyboard.press('KeyR');
  await rotateMirror(1, -1.5, Math.PI / 4);
  await rotateMirror(-4, -.5, -Math.PI / 4);
  for (let i = 0; i < 3; i++) { await shootAt(-3, -1.5); await waitReady(); }
  await snapshot('final-prepared');
  const seconds = () => page.evaluate(() => {
    const [minutes, seconds] = document.querySelector('#clock').textContent.split(':').map(Number);
    return minutes * 60 + seconds;
  });
  if ((await seconds()) % 6 >= 2) await page.waitForFunction(() => {
    const [minutes, seconds] = document.querySelector('#clock').textContent.split(':').map(Number);
    return (minutes * 60 + seconds) % 6 === 0;
  });
  await shootAt(-3, -1.5); await waitVictory();
  assert.equal(await text('#ammo'), '1');
  console.log('Ordered rebounds, alternative timed routes and final combination passed');
  await story(4);
  await page.waitForSelector('#start-button:enabled');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('zeus-progress-v1')));
  assert.equal(Object.keys(save.stars).length, 25);
  assert.equal(save.stars.turn, 3);
  await page.locator('#start-button').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await optionAction(page, 'home');
  await page.waitForFunction(() => document.body.dataset.mode === 'title');
  await page.locator('#levels-button').click();
  await page.locator('[data-level="2"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  await shootAt(5, -2.5);
  await optionAction(page, 'restart');
  await page.waitForFunction(() => document.querySelector('#ammo').textContent === '3');
  assert.equal(await text('#ammo'), '3');
  assert.equal(await text('#clock'), '00:00');

  await page.setViewportSize({ width: 390, height: 740 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.resolve('artifacts/narrow.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, [], `Browser errors: ${errors.join(', ')}`);
  console.log('Browser check passed: 25 levels, serial shots, destructive boxes, two-hit blocks, mirror chains, cloud cycles, timed branches, rotation during storage, final story, save and narrow viewport.');
  await browser.close();
})().catch(async error => {
  console.error(error);
  if (page) await page.screenshot({ path: path.resolve('artifacts/browser-failure.png') }).catch(() => {});
  if (browser) await browser.close();
  process.exitCode = 1;
});
