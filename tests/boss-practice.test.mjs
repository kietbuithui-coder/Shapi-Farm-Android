import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { BOSSES } from '../src/data/enemies.js';
import { bootGame } from './dom.mjs';

test('all five bosses spawn individually in practice and defeating one ends it', () => {
  for (const boss of BOSSES) {
    const run = new Run({ catId: 'tabby', skills: ['claw_slash'], seed: 2, challengeBoss: boss.id });
    run.start();
    assert.equal(run.night, 1); assert.equal(run.wave, 5);
    assert.equal(run.boss.def.id, boss.id); assert.equal(run.enemies.filter(e => e.boss && !e.dead).length, 1);
    run.state = RUN_STATE.FIGHT;
    run.killEnemy(run.boss); run.step(1/60, {});
    assert.equal(run.state, RUN_STATE.VICTORY);
  }
});

test('invalid practice ID falls back to an ordinary first wave', () => {
  for (const challengeBoss of ['not_a_boss', '__proto__']) {
    const run = new Run({catId:'tabby', challengeBoss}); run.start();
    assert.equal(run.challengeBoss, null); assert.equal(run.wave, 1); assert.equal(run.boss, null);
  }
});

test('practice menu is reachable, cards fit on both mobile orientations, and no economy or records are awarded', async () => {
  for (const [width,height] of [[840,380],[390,844],[320,568]]) {
    const {game:g} = await bootGame({width,height});
    g.draw(); assert.ok(g._cachedRects.find(r=>r.id==='bossPractice'));
    g.click('bossPractice'); g.applyPending(); g.draw();
    const cards=g._cachedRects.filter(r=>r.id.startsWith('practice:'));
    assert.equal(cards.length,5);
    for(const c of cards){assert.ok(c.x>=0 && c.y>=0 && c.x+c.w<=width && c.y+c.h<=height);assert.ok(c.w>=45 && c.h>=45);}
    const before={stats:JSON.stringify(g.profile.stats), embers:g.profile.embers, gold:g.profile.gold, lastRun:JSON.stringify(g.profile.lastRun), achievements:JSON.stringify(g.profile.achievements)};
    g.click('practice:void_predator'); g.applyPending();
    assert.equal(g.run.boss.def.id,'void_predator');
    g.run.state=RUN_STATE.FIGHT; g.run.killEnemy(g.run.boss); g.run.step(1/60, {}); g.finishRun(true); g.applyPending();
    assert.equal(g.scene,'results'); assert.equal(g.summary.challengeBoss,'void_predator');
    assert.equal(g.summary.embers,0); assert.equal(g.summary.gold,0);
    assert.deepEqual({stats:JSON.stringify(g.profile.stats), embers:g.profile.embers, gold:g.profile.gold, lastRun:JSON.stringify(g.profile.lastRun), achievements:JSON.stringify(g.profile.achievements)},before);
    g.click('again');g.applyPending();assert.equal(g.run.boss.def.id,'void_predator');
  }
});


test('practice victory survives same-step level-up and simultaneous death stays a defeat', () => {
  for (const dies of [false, true]) {
    const run=new Run({catId:'tabby', skills:['claw_slash'], challengeBoss:'crystal_queen'});
    run.start(); run.state=RUN_STATE.FIGHT; run.killEnemy(run.boss);
    run.updatePickups = () => { run.addXp(run.xpNeed); if (dies) run.hp = 0; };
    run.step(1/60, {});
    assert.equal(run.state, dies ? RUN_STATE.DEAD : RUN_STATE.VICTORY);
  }
});

test('results show the actual credited embers without adding depth bonus twice', async () => {
  const {game:g} = await bootGame();
  g.scene='results';g.summary={victory:false, night:1, level:1, kills:10, time:3, embers:27, depth:4, gold:0};
  const strings=[];const original=g.renderer.ctx.fillText.bind(g.renderer.ctx);
  g.renderer.ctx.fillText=(str,...args)=>{strings.push(str);return original(str,...args);};
  g.draw();assert.ok(strings.includes('+27'));assert.ok(!strings.includes('+36'));
});

test('quitting practice awards nothing and retry keeps the boss and difficulty', async () => {
  const {game:g}=await bootGame();
  g.difficulty='hard'; g.startRun({catId:'tabby',skills:['claw_slash'],difficulty:'hard',challengeBoss:'crystal_queen'}); g.scene='run';
  const before={stats:JSON.stringify(g.profile.stats),embers:g.profile.embers,gold:g.profile.gold,lastRun:JSON.stringify(g.profile.lastRun)};
  g.run.gold=100;g.run.embersFound=100;g.run.kills=20;g.paused=true;g.click('quit');g.applyPending();
  assert.equal(g.scene,'results');assert.equal(g.summary.victory,false);assert.equal(g.summary.embers,0);assert.equal(g.summary.gold,0);
  assert.deepEqual({stats:JSON.stringify(g.profile.stats),embers:g.profile.embers,gold:g.profile.gold,lastRun:JSON.stringify(g.profile.lastRun)},before);
  g.click('again');g.applyPending();assert.equal(g.run.boss.def.id,'crystal_queen');assert.equal(g.run.difficulty,'hard');
});
