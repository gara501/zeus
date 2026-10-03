const assert = require('node:assert/strict');

async function startGame(page) {
  await page.locator('#start-button').click();
  await page.waitForFunction(() => ['story', 'playing'].includes(document.body.dataset.mode));
  if (await page.locator('body').getAttribute('data-mode') === 'story') {
    assert.equal(await page.locator('#chapter-label').textContent(), 'THE JOURNEY BEGINS');
    await page.locator('#story-next').click();
    await page.waitForFunction(() => !document.querySelector('#story-text').classList.contains('typing'));
    await page.locator('#story-next').click();
  }
  await page.waitForFunction(() => document.body.dataset.mode === 'playing');
}

module.exports = { startGame };
