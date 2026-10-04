const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const { revealStory, optionAction } = require('./story-helpers.cjs');
let browser;
(async () => {
 browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
 const { levels } = await import('../src/levels.js');
 for (const viewport of [{width:390,height:740}, {width:440,height:956}, {width:1280,height:800}]) {
  const mobile = viewport.width < 700;
  const page = await browser.newPage({viewport, hasTouch:mobile});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[4] || 'http://127.0.0.1:5173/');
  await page.waitForSelector('#start-button:enabled');
  await page.locator('#start-button').click();
  await page.waitForSelector('body[data-mode="story"]');
  await revealStory(page);
  const scene = await page.locator('#scene-background').boundingBox();
  assert.ok(scene.height > viewport.height * .65);
  assert.equal(await page.locator('#scene-background').evaluate(img=>getComputedStyle(img).objectFit),'cover');
  assert.ok((await page.locator('#story-scene').boundingBox()).height < 200);
  await page.screenshot({path:`artifacts/responsive-intro-${viewport.width}.png`});
  await page.evaluate(ids=>localStorage.setItem('zeus-progress-v1',JSON.stringify({stars:Object.fromEntries(ids.map(id=>[id,3])),muted:true,musicMuted:true})),levels.map(l=>l.id));
  await page.reload();
  await page.waitForSelector('#levels-button:visible');
  const select = async index => {
   await page.locator('#levels-button').click(); await page.locator(`[data-level="${index}"]`).click();
   await page.waitForSelector('body[data-mode="playing"]'); await page.waitForTimeout(100);
  };
  const point = (x,y)=>page.evaluate(({x,y})=>{
   const canvas=document.querySelector('#game canvas'),box=canvas.getBoundingClientRect(),scale=Number(canvas.dataset.scale);
   return {x:box.x+box.width/2+(x-Number(canvas.dataset.centerX))*scale,y:box.y+box.height/2-(y-Number(canvas.dataset.centerY))*scale};
  },{x,y});
  const shoot = async (x,y) => {
   await page.waitForFunction(()=>document.querySelector('#shot-state').textContent==='Ready to fire');
   const p=await point(x,y);
   if(mobile) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
   await page.waitForTimeout(90);
  };
  await select(15);
  await page.screenshot({path:`artifacts/responsive-level16-${viewport.width}.png`});
  await shoot(1,1.5); await shoot(1,-2.25);
  await page.waitForSelector('body[data-mode="victory"]');
  assert.equal(await page.locator('#ammo').textContent(),'2');
  await page.reload(); await page.waitForSelector('#levels-button:visible'); await select(1);
  if(mobile) {
   const scale=await page.locator('#game canvas').first().evaluate(canvas=>Number(canvas.dataset.scale));
   const old=(viewport.width-44)/16.5;
   assert.ok(scale>old*1.12,'The entire board gets at least 12% larger before zoom');
   await page.screenshot({path:`artifacts/responsive-board-${viewport.width}.png`});
   await page.locator('#pause').tap(); await page.waitForSelector('body[data-mode="paused"]');
   await page.locator('#board-zoom').evaluate(input=>{input.value='150';input.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.waitForFunction(()=>document.querySelector('#board-zoom-value').textContent==='150%');
   await page.screenshot({path:`artifacts/responsive-zoom-options-${viewport.width}.png`});
   await page.locator('#dialog-button').tap(); await page.waitForSelector('body[data-mode="playing"]');
   const session=await page.context().newCDPSession(page);
   const start=await point(-1,-1.5);
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y}]});
   for(let i=1;i<=4;i++) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+i*25,y:start.y}]}); await page.waitForTimeout(30);
   }
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForTimeout(100);
   assert.equal(await page.locator('#ammo').textContent(),'0','Panning must never fire');
   assert.ok(await page.locator('#game canvas').first().evaluate(canvas=>Number(canvas.dataset.centerX)<-.5));
   await page.screenshot({path:`artifacts/responsive-zoom-${viewport.width}.png`});
   await shoot(-1,-1.5); await page.waitForSelector('body[data-mode="victory"]');
   assert.equal(await page.locator('#ammo').textContent(),'1','Zoomed tap still solves the mirror route');
   await page.reload(); await page.waitForSelector('#levels-button:visible'); await select(1);
   await page.locator('#pause').tap();
   await page.waitForSelector('body[data-mode="paused"]');
   assert.equal(await page.locator('#board-zoom').inputValue(),'150','Zoom preference survives reload');
   await page.locator('#board-zoom').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
   await optionAction(page,'home',true); await page.waitForSelector('body[data-mode="title"]');
  } else {
   await optionAction(page,'home'); await page.waitForSelector('body[data-mode="title"]');
  }
  await select(4); await shoot(-1,-1.5);
  await page.waitForSelector('body[data-mode="story"]'); await revealStory(page);
  await page.screenshot({path:`artifacts/responsive-chapter-${viewport.width}.png`});
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Responsive layouts passed: level 16, larger full-board view, zoom/pan/tap, saved zoom and large story artwork.');
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
