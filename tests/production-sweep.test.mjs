import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/production-sweep.mjs';

test('seeded production sweep repeats the exact same result without god mode', () => {
  const opts={catId:'tabby',seed:42,difficulty:'normal',limit:35};
  const a=simulate(opts),b=simulate(opts);assert.deepEqual(a,b);assert.equal(a.assisted,false);assert.deepEqual(a.errors,[]);assert.ok(a.kills>0);
});

test('assisted traversal reaches victory across nine nights (progression plumbing, not balance)', () => {
  const result=simulate({catId:'tabby',seed:3,difficulty:'normal',limit:3600,assisted:true});
  assert.equal(result.state,'victory');assert.deepEqual(result.nights,[1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(result.errors,[]);assert.ok(result.bosses.length>0);assert.ok(result.kills>0);
});

import { Run, RUN_STATE, DASH_COST } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';

test('bot dodges urgent danger through the same energy-limited input as a player', () => {
  const run=new Run({catId:'tabby',skills:['claw_slash'],seed:3});run.state=RUN_STATE.FIGHT;run.waveEnemiesLeft=999;
  run.player.x=700;run.player.y=380;run.hazards.push({x:680,y:380,radius:100,t:0,delay:1});
  const bot=new BotBrain(run);const input=bot.update(1/60);assert.equal(input.dodge,true);assert.ok(input.moveX>0);
  const energy=run.energy;run.step(1/60,input);assert.ok(run.player.dashCd>0);assert.ok(run.energy<=energy-DASH_COST+1);assert.ok(!run.dashQueue?.length);
  assert.equal(bot.update(1/60).dodge,false);
  const noEnergy=new Run({catId:'tabby',skills:['claw_slash'],seed:3});noEnergy.state=RUN_STATE.FIGHT;noEnergy.energy=0;
  noEnergy.hazards.push({x:noEnergy.player.x-20,y:noEnergy.player.y,radius:100,t:0,delay:1});assert.equal(new BotBrain(noEnergy).update(1/60).dodge,false);
});

test('bot with no skills retains a valid movement range',()=>{
  const run=new Run({catId:'tabby',skills:[],seed:3});const bot=new BotBrain(run);
  assert.deepEqual(bot.preferredRange(),{near:80,far:160});
});

test('nine-night campaign ends at victory; the later boss rotation is not silently reachable', async () => {
  const { bossForNight, actForNight } = await import('../src/data/acts.js');
  const run=new Run({catId:'tabby',skills:['claw_slash'],seed:3});run.night=9;run.wave=5;run.state=RUN_STATE.FIGHT;run.onWaveClear();
  assert.equal(run.state,RUN_STATE.VICTORY);assert.equal(run.night,9);
  assert.equal(bossForNight(13,actForNight(13)),'void_predator');assert.equal(bossForNight(14,actForNight(14)),'crystal_queen');
});
