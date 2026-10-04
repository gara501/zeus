const assert = require('node:assert/strict');

async function revealStory(page) {
  const fragments = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    await page.locator('#story-next:enabled').waitFor();
    if (await page.locator('#story-text').evaluate(text => text.classList.contains('typing'))) {
      await page.locator('#story-next').click();
      await page.waitForFunction(() => !document.querySelector('#story-text').classList.contains('typing'));
    }
    fragments.push(await page.locator('#story-text').textContent());
    const complete = await page.locator('#cinematics').getAttribute('data-story-complete');
    if (complete === 'true') return fragments.join(' ');
    const start = await page.locator('#cinematics').getAttribute('data-story-fragment');
    await page.locator('#story-next').click();
    await page.waitForFunction(start => document.querySelector('#cinematics').dataset.storyFragment !== start, start);
  }
  throw new Error('Story did not reach its final fragment');
}

async function startGame(page) {
  await page.locator('#start-button').click();
  await page.waitForFunction(() => ['story', 'playing'].includes(document.body.dataset.mode));
  if (await page.locator('body').getAttribute('data-mode') === 'story') {
    assert.equal(await page.locator('#chapter-label').textContent(), 'THE JOURNEY BEGINS');
    await revealStory(page);
    await page.locator('#story-next').click();
  }
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
}

async function optionAction(page, id, touch = false) {
  await page.waitForFunction(() => ['playing', 'paused', 'lost'].includes(document.body.dataset.mode));
  const opened = await page.locator('body').getAttribute('data-mode') === 'playing';
  const activate = locator => touch ? locator.tap() : locator.click();
  if (opened) {
    await activate(page.locator('#pause'));
    await page.waitForFunction(() => document.body.dataset.mode === 'paused');
  }
  await activate(page.locator(`#${id}`));
  if (opened && ['music', 'sound'].includes(id)) {
    await activate(page.locator('#dialog-button'));
    await page.waitForFunction(() => document.body.dataset.mode === 'playing');
  }
}

module.exports = { startGame, revealStory, optionAction };
