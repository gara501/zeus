const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { startGame, optionAction } = require('./story-helpers.cjs');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.waitForSelector('#start-button:enabled');
  await startGame(page);
  await page.waitForFunction(() => !document.querySelector('#music-1').paused && document.querySelector('#music-1').currentTime > .3);
  assert.equal(await page.locator('#music-2').evaluate(audio => audio.paused), true);
  await optionAction(page, 'music');
  await page.waitForFunction(() => document.querySelector('#music-1').paused);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('zeus-progress-v1')).muted), false);
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  assert.equal(await page.locator('#title-music').textContent(), 'Music: off');
  await page.locator('#title-music').click();
  await startGame(page);
  await page.waitForFunction(() => document.querySelector('#music-1').volume > .035);
  await optionAction(page, 'sound');
  assert.equal(await page.locator('#music-1').evaluate(audio => audio.paused), false);
  await optionAction(page, 'sound');
  await page.mouse.move(700, 500);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#music-1').volume < .015);
  await page.locator('#pause').click();
  await page.waitForFunction(() => document.querySelector('#music-1').paused);
  await page.locator('#dialog-button').click();
  await page.waitForFunction(() => !document.querySelector('#music-1').paused);
  const { levels } = await import('../src/levels.js');
  await page.evaluate(ids => localStorage.setItem('zeus-progress-v1', JSON.stringify({ stars: Object.fromEntries(ids.map(id => [id, 3])), muted: false, musicMuted: false })), levels.map(level => level.id));
  await page.reload();
  await page.waitForSelector('#start-button:enabled');
  for (const [index, track] of [[15, 1], [16, 2], [0, 1]]) {
    await page.locator('#levels-button').click();
    await page.locator(`[data-level="${index}"]`).click();
    await page.waitForFunction(track => !document.querySelector(`#music-${track}`).paused && document.querySelector(`#music-${track}`).currentTime > .1, track);
    assert.equal(await page.locator(`#music-${3 - track}`).evaluate(audio => audio.paused), true);
    assert.equal(await page.locator(`#music-${track}`).evaluate(audio => audio.loop && audio.volume <= .06), true);
    await optionAction(page, 'home');
    await page.waitForFunction(() => document.body.dataset.mode === 'title');
    assert.equal(await page.locator('audio').evaluateAll(players => players.every(audio => audio.paused)), true);
  }
  const mix = await page.evaluate(async () => {
    const L = await import('/node_modules/littlejsengine/dist/littlejs.esm.js');
    const { MUSIC_VOLUME, DUCK_VOLUME } = await import('/src/music.js');
    const source = await (await fetch('/src/audio.js')).text();
    const parameters = source.match(/fire: new Sound\(\[([^\]]+)\]/)[1].split(',').map(Number);
    parameters[1] = 0;
    const samples = L.zzfxG(...parameters);
    const rms = data => Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length);
    const fireRms = rms(samples) * L.soundVolume;
    const context = new AudioContext();
    const music = [];
    for (const audio of document.querySelectorAll('audio')) {
      const buffer = await context.decodeAudioData(await (await fetch(audio.src)).arrayBuffer());
      let loudest = 0, peak = 0;
      const window = Math.round(buffer.sampleRate * .1);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let start = 0; start < data.length; start += window) {
          let sum = 0;
          const end = Math.min(start + window, data.length);
          for (let i = start; i < end; i++) { sum += data[i] ** 2; peak = Math.max(peak, Math.abs(data[i])); }
          loudest = Math.max(loudest, Math.sqrt(sum / (end - start)));
        }
      }
      music.push({ duration: buffer.duration, peak: peak * MUSIC_VOLUME, loudestRms: loudest * MUSIC_VOLUME, duckedRms: loudest * DUCK_VOLUME });
    }
    await context.close();
    return { fireRms, music };
  });
  assert.ok(mix.music.every(track => track.peak < .1 && track.duckedRms < mix.fireRms / 2), 'Music must leave measurable headroom for effects');
  assert.deepEqual(errors, []);
  console.log('Music check passed: tracks 1–16/17–25, independent saved controls, looping, pause, ducking and decoded mix:', JSON.stringify(mix));
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
