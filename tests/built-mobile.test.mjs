import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom-built.mjs';
import { addTrainingDummy } from './harness.mjs';

// Exercise the inline JavaScript actually shipped to the phone, via its event listeners.
test('built HTML routes mobile menu, four skills, steering and dodge correctly', async () => {
  const {game,dispatch,bootHidden}=await bootGame();assert.ok(bootHidden);
  Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:5,getGamepads:()=>[],vibrate(){}},configurable:true});
  globalThis.innerWidth=840;globalThis.innerHeight=380;game.resize();game.scene='home';game.draw();
  const send=(type,x,y,id=1)=>dispatch(type,{pointerType:'touch',pointerId:id,clientX:x,clientY:y});
  const play=game._cachedRects.find(r=>r.id==='play');send('pointerdown',play.x+play.w/2,play.y+play.h/2);
  assert.equal(game.pending?.next,'run');assert.equal(game.input.touch.active,false);
  game.pending=null;game.fadeDir=0;game.fade=0;
  game.startRun({catId:'tabby',skills:['claw_slash','healing_purr','pounce','arcane_paw'],seed:1});
  game.scene='run';game.run.state='fight';game.run.waveEnemiesLeft=999;game.run.player.invuln=999;game.overlay=null;addTrainingDummy(game.run,50);game.draw();
  let hudSlots=0;const original=game.hud.drawSlot.bind(game.hud);game.hud.drawSlot=(...a)=>{hudSlots++;return original(...a);};game.draw();
  assert.equal(hudSlots,0);assert.equal(game.touch.buttons.length,4);
  const stick=game.touch.stick;send('pointerdown',stick.cx,stick.cy,2);send('pointermove',stick.cx+30,stick.cy,2);
  const k=game.touch.buttons[0];let cast=0;game.run.on('skill:cast',()=>cast++);
  send('pointerdown',k.x+k.w/2,k.y+k.h/2,3);assert.equal(cast,1);assert.equal(game.input.touch.id,2);
  let dodges=0;game.run.on('player:dash',()=>dodges++);const d=game.touch.dodgeRect;
  send('pointerdown',d.x+d.w/2,d.y+d.h/2,4);game.tick(1/120);game.tick(1/120);assert.equal(dodges,1);
  send('pointercancel',stick.cx,stick.cy,2);assert.equal(game.input.touch.active,false);
  game.camera.snapNext=true;game.run.player.x=96;game.run.player.y=506;game.tick(1/60);game.draw();
  const p=game.renderer.worldToScreen(game.run.player.x,game.run.player.y);
  assert.ok(p.x>=0&&p.x<=840&&p.y>=0&&p.y<=380);
});
