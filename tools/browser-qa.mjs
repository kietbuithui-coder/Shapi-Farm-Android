// Optional real Chromium smoke test of the built offline file. See docs/production.
// Requires playwright-core and @sparticuz/chromium in node_modules on Linux.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

const executablePath = await chromium.executablePath();
const args = chromium.args.filter(arg => !['--disable-web-security', '--allow-running-insecure-content', '--single-process'].includes(arg));
const browser = await playwright.launch({ executablePath, args, headless: true });
const file = pathToFileURL(resolve('index.html')).href;
const issues = [];
const external = [];
try {
  for (const [width, height] of [[840,380], [390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', err => issues.push(`${width}x${height}: ${err.message}`));
    page.on('request', req => { if (/^https?:/i.test(req.url())) external.push(req.url()); });
    await context.setOffline(true);
    await page.goto(file);
    await page.waitForFunction(() => window.__catLegends && !document.querySelector('#boot:not(.gone)'));
    let state = await page.evaluate(() => ({ scene: __catLegends.scene, mobile: __catLegends.mobile, play: __catLegends._cachedRects.find(r => r.id === 'play') }));
    assert.equal(state.scene, 'home'); assert.equal(state.mobile, true); assert.ok(state.play);
    await page.touchscreen.tap(state.play.x + state.play.w / 2, state.play.y + state.play.h / 2);
    await page.waitForFunction(() => __catLegends.scene === 'run' && __catLegends.run?.state === 'fight', null, { timeout: 30000 }).catch(async error => { console.error('boot state', await page.evaluate(() => ({scene:__catLegends.scene, state:__catLegends.run?.state, paused:__catLegends.paused, overlay:__catLegends.overlay, fade:__catLegends.fade, pending:__catLegends.pending}))); throw error; });
    await page.evaluate(() => {
      const g=__catLegends;g.run.player.invuln=999;g.run.waveEnemiesLeft=999;window.qaCasts=[];window.qaDashes=0;window.qaEvents=[];for(const type of ['pointerdown','pointerup','pointermove','pointercancel','lostpointercapture']) g.canvas.addEventListener(type,e=>window.qaEvents.push([type,e.pointerId,Math.round(e.clientX),Math.round(e.clientY)]));
      const old=g.castSkill.bind(g);g.castSkill=i=>{window.qaCasts.push(i);return old(i);};
      g.run.on('player:dash',()=>window.qaDashes++);
      window.qaHudSlots=0;const draw=g.hud.drawSlot.bind(g.hud);g.hud.drawSlot=(...a)=>{window.qaHudSlots++;return draw(...a);};
    });
    await page.waitForTimeout(80);
    state=await page.evaluate(()=>({buttons:__catLegends.touch.buttons.map(b=>({x:b.x+b.w/2,y:b.y+b.h/2})),stick:__catLegends.touch.stick,dodge:__catLegends.touch.dodgeRect,slots:window.qaHudSlots}));
    assert.equal(state.buttons.length,4);assert.equal(state.slots,0);
    const session=await context.newCDPSession(page), stick=state.stick;
    const move={x:Math.round(stick.cx+25),y:Math.round(stick.cy),id:1};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:Math.round(stick.cx),y:Math.round(stick.cy),id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[move]});
    for(let i=0;i<4;i++){
      const pt={x:Math.round(state.buttons[i].x),y:Math.round(state.buttons[i].y),id:i+2};
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move,pt]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[pt]});
    }
    state=await page.evaluate(()=>({casts:window.qaCasts,active:__catLegends.input.touch.active,mag:__catLegends.input.touch.mag,dodge:__catLegends.touch.dodgeRect,events:window.qaEvents}));
    if (!state.active || !state.mag) console.error('pointer trace', JSON.stringify(state));
    assert.deepEqual(state.casts,[0,1,2,3]);assert.equal(state.active,true);assert.ok(state.mag>0);
    const d=state.dodge, dp={x:Math.round(d.x+d.w/2),y:Math.round(d.y+d.h/2),id:8};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move,dp]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[dp]});
    await page.waitForFunction(()=>window.qaDashes>0,null,{timeout:3000});
    assert.equal(await page.evaluate(()=>__catLegends.input.touch.active),true);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[move]});
    await page.waitForFunction(()=>!__catLegends.input.touch.active);
    const pause=await page.evaluate(()=>{const g=__catLegends;return g.hitRects.find(r=>r.id==='pause') || g.touch.pauseRect;});
    await page.touchscreen.tap(pause.x+pause.w/2,pause.y+pause.h/2);await page.waitForFunction(()=>__catLegends.paused);
    await page.waitForFunction(()=>__catLegends.hitRects.some(r=>r.id==='resume'));
    const resume=await page.evaluate(()=>__catLegends.hitRects.find(r=>r.id==='resume'));
    await page.touchscreen.tap(resume.x+resume.w/2,resume.y+resume.h/2);await page.waitForFunction(()=>!__catLegends.paused);
    await page.evaluate(()=>{const g=__catLegends;g.run.pendingLevelUps=1;g.run.offers=g.run.rollOffers();g.run.setState('levelup');g.offers=g.run.offers;g.overlay='levelup';g.draw();});
    const card=await page.evaluate(()=>__catLegends.hitRects.find(r=>r.id==='offer:0'));
    await page.touchscreen.tap(card.x+card.w/2,card.y+card.h/2);await page.waitForFunction(()=>__catLegends.run.state==='fight');
    const local=await page.evaluate(()=>{const g=__catLegends;g.profile.embers=123;g.store.saveNow();return g.store.storage.persistent;});
    assert.equal(local,true,'Chromium permitted localStorage during this test');
    await page.reload();await page.waitForFunction(()=>__catLegends?.scene==='home');
    assert.equal(await page.evaluate(()=>__catLegends.profile.embers),123);
    await page.waitForFunction(()=>__catLegends._cachedRects.some(r=>r.id==='bossPractice'));
    const practice=await page.evaluate(()=>__catLegends._cachedRects.find(r=>r.id==='bossPractice'));
    await page.touchscreen.tap(practice.x+practice.w/2,practice.y+practice.h/2);
    await page.waitForFunction(()=>__catLegends.scene==='bossPractice' && __catLegends._cachedRects.filter(r=>r.id.startsWith('practice:')).length===5);
    const queen=await page.evaluate(()=>__catLegends._cachedRects.find(r=>r.id==='practice:crystal_queen'));
    await page.touchscreen.tap(queen.x+queen.w/2,queen.y+queen.h/2);
    await page.waitForFunction(()=>__catLegends.scene==='run' && __catLegends.run?.state==='fight');
    assert.equal(await page.evaluate(()=>__catLegends.run.boss?.def.id),'crystal_queen');
    const before=await page.evaluate(()=>({stats:JSON.stringify(__catLegends.profile.stats),embers:__catLegends.profile.embers}));
    await page.evaluate(()=>__catLegends.run.killEnemy(__catLegends.run.boss));
    await page.waitForFunction(()=>__catLegends.scene==='results');
    const after=await page.evaluate(()=>({stats:JSON.stringify(__catLegends.profile.stats),embers:__catLegends.profile.embers,summary:__catLegends.summary}));
    assert.equal(after.embers,before.embers);assert.equal(after.stats,before.stats);assert.equal(after.summary.embers,0);assert.equal(after.summary.challengeBoss,'crystal_queen');
    console.log(`PASS file:// offline ${width}x${height}@2: menu, four skill buttons, multitouch movement/dodge, pause, level-up, reload/save, boss practice`);
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  page.on('pageerror',err=>issues.push(`desktop: ${err.message}`));await context.setOffline(true);await page.goto(file);
  await page.waitForFunction(()=>window.__catLegends);
  await page.evaluate(()=>{const g=__catLegends;g.startRun({catId:'tabby',skills:['claw_slash'],seed:1});g.scene='run';g.run.state='fight';g.run.waveEnemiesLeft=999;g.run.player.invuln=999;});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__catLegends.paused),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__catLegends.paused),false);
  console.log('PASS file:// offline desktop: Escape pauses and resumes');await context.close();
  assert.deepEqual(external,[],'no external network requests');assert.deepEqual(issues,[],'no uncaught browser exceptions');
} finally {await browser.close();}
