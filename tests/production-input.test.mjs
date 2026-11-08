import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom.mjs';

async function fight(){const b=await bootGame();b.game.startRun({catId:'tabby',skills:['claw_slash'],seed:3});b.game.scene='run';b.game.run.state='fight';b.game.run.waveEnemiesLeft=999;b.game.draw();return b;}

test('Esc/P pause and resume, without processing held gameplay input during pause',async()=>{
  const b=await fight();b.dispatch('keydown',{code:'Escape',repeat:false});assert.equal(b.game.paused,true);
  b.dispatch('keydown',{code:'Digit1',repeat:false});assert.equal(b.game.input.pressed.cast[0],false);
  b.dispatch('keydown',{code:'Escape',repeat:true});assert.equal(b.game.paused,true);
  b.dispatch('keydown',{code:'Escape',repeat:false});assert.equal(b.game.paused,false);
  b.dispatch('keydown',{code:'KeyP',repeat:false});assert.equal(b.game.paused,true);
  b.dispatch('keydown',{code:'KeyP',repeat:false});assert.equal(b.game.paused,false);
});

test('gamepad start toggles pause and resume once per press, even while paused',async()=>{
  const b=await fight(),buttons=Array.from({length:16},()=>({pressed:false,value:0}));
  Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:0,getGamepads:()=>[{connected:true,axes:[0,0],buttons}]},configurable:true});
  const tick=()=>b.game.tick(1/60);buttons[9].pressed=true;tick();assert.equal(b.game.paused,true);
  tick();assert.equal(b.game.paused,true);buttons[9].pressed=false;tick();buttons[9].pressed=true;tick();assert.equal(b.game.paused,false);
});

test('pause controls cannot hide or block a reward choice',async()=>{
  const b=await fight();b.game.run.state='reward';b.game.overlay='reward';
  b.dispatch('keydown',{code:'Escape',repeat:false});assert.equal(b.game.paused,false);
});
