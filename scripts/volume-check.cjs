const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { startGame } = require('./story-helpers.cjs');
let browser;
(async () => {
 browser = await chromium.launch({headless:true,executablePath:process.argv[3]});
 const page = await browser.newPage({viewport:{width:390,height:740},hasTouch:true});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
 await page.waitForSelector('#start-button:enabled');
 assert.ok((await page.locator('#scene-background').getAttribute('src')).includes('intro-mobile'));
 await page.screenshot({path:'artifacts/title-mobile-new.png'});
 await page.setViewportSize({width:1280,height:800});
 await page.waitForFunction(()=>document.querySelector('#scene-background').src.includes('/title.png'));
 await startGame(page);
 const volume = async value => {
  await page.locator('#pause').click(); await page.waitForSelector('body[data-mode="paused"]');
  await page.locator('#music-volume').fill(String(value));
  await page.waitForFunction(value=>document.querySelector('#music-volume-value').textContent===`${value}%`,value);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zeus-progress-v1')).musicVolume),value/100);
  await page.locator('#dialog-button').click(); await page.waitForSelector('body[data-mode="playing"]');
 };
 await volume(100);
 await page.waitForFunction(()=>document.querySelector('#music-1').volume>.115);
 const miss=await require('./board-helpers.cjs').boardPoint(page,-6,-1.5);
 await page.mouse.click(miss.x,miss.y);
 await page.waitForFunction(()=>document.querySelector('#music-1').volume<.025);
 await page.waitForFunction(()=>document.querySelector('#shot-state').textContent==='Ready to fire');
 await volume(0);
 await page.waitForFunction(()=>document.querySelector('#music-1').paused && document.querySelector('#music-1').volume===0);
 await volume(25);
 await page.waitForFunction(()=>!document.querySelector('#music-1').paused && Math.abs(document.querySelector('#music-1').volume-.03)<.001);
 await page.reload(); await page.waitForSelector('#start-button:enabled');
 await startGame(page);
 await page.locator('#pause').click(); await page.waitForSelector('body[data-mode="paused"]');
 assert.equal(await page.locator('#music-volume').inputValue(),'25');
 for(const [width,height] of [[390,740],[320,568],[568,320]]) {
  await page.setViewportSize({width,height}); await page.waitForTimeout(100);
  assert.equal(await page.locator('.dialog').evaluate(dialog=>{
   const box=dialog.getBoundingClientRect();return box.top>=0 && box.bottom<=innerHeight && dialog.scrollHeight<=dialog.clientHeight;
  }),true,`Volume and zoom fit without scrolling: ${width}x${height}`);
 }
 await page.setViewportSize({width:390,height:740});
 await page.screenshot({path:'artifacts/options-volume-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Volume passed: playback gain, ducking, zero, saved preference, responsive title image and compact options.');
 await browser.close();
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
