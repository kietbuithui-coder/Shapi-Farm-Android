import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({catId:'tabby',skills:[id],seed:13});
  r.state=RUN_STATE.FIGHT; r.waveEnemiesLeft=999; r.player.x=785; r.player.y=380; r.player.invuln=999;
  r.stats.crit=0; r.slots[0].rank=rank; return r;
}
function dummy(r, hp=100000, fraction=1) {
  const e=addTrainingDummy(r,50); e.hpMax=hp; e.hp=hp*fraction; e.speed=0; e.attackCd=999; return e;
}
function release(r, seconds=0.3) { r.time+=seconds; r.updatePassiveEffects(0); }
function near(a,b) { assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`); }

test('executioner executes normal/elite at its ranked threshold, not just six times base damage', () => {
  for(const [rank,threshold] of [[1,0.2],[2,0.25],[3,0.25],[4,0.25],[5,0.35]]) {
    for(const elite of [false,true]) {
      const r=setup('executioner',rank), e=dummy(r,100000,threshold);e.elite=elite;
      let visual; r.on('fx:execute', v => visual=v); r.castSlot(0); release(r);
      assert.ok(e.dead,`rank ${rank} elite=${elite}`); assert.equal(visual.kill,true);
      near(r.statsTotals.damage,100000*threshold);
    }
    const r=setup('executioner',rank), e=dummy(r,100000,threshold+0.001);r.castSlot(0);release(r);
    assert.equal(e.dead,false);assert.ok(e.hp < e.hpMax*(threshold+0.001));
  }
});

test('executioner does not execute real bosses and minibosses but hits harder below threshold', () => {
  for (const kind of ['boss','mini']) for (const weak of [false,true]) {
    const r=setup('executioner',5);
    if(kind==='boss') r.spawnBoss('moon_devourer'); else r.spawnMiniBoss('grub_mother');
    const e=kind==='boss'?r.boss:r.miniBoss; e.x=r.player.x+50;e.y=r.player.y;e.hpMax=100000;e.hp=weak?30000:50000;
    const before=e.hp;r.castSlot(0);release(r);assert.equal(e.dead,false);
    near(before-e.hp,r.skillDamage(r.slots[0].def,2.4*1.3)*(weak?6:1));
  }
});

test('executioner rank four resets on its own normal kill or execution, but not a surviving hit', () => {
  for(const [hp,frac,killed] of [[100000,0.2,true],[20,1,true],[100000,1,false]]) {
    const r=setup('executioner',4),e=dummy(r,hp,frac);r.castSlot(0);release(r);
    assert.equal(e.dead,killed);assert.equal(r.slots[0].charges,killed?1:0);
    if(killed) assert.equal(r.slots[0].recharge,0);else assert.ok(r.slots[0].recharge>0);
  }
});

test('soul siphon rank threshold, heal, and additive damage stacks apply on actual kills', () => {
  for(const [rank,threshold,heal,stack] of [[1,.25,.08,0],[2,.25,.12,0],[3,.25,.12,.04],[4,.35,.12,.04],[5,.35,.12,.07]]) {
    const r=setup('soul_siphon',rank),e=dummy(r,100000,threshold);r.hp=50;r.castSlot(0);release(r);
    assert.ok(e.dead,`rank ${rank}`);near(r.hp,50+r.stats.hpMax*heal);near(r.soulDamageBonus,stack);
    const target=dummy(r); const before=target.hp; r.hitEnemy(target,100,{source:'skill'});
    near(before-target.hp,100*(1+stack));
    const over=setup('soul_siphon',rank), e2=dummy(over,100000,threshold+.001);over.hp=50;over.castSlot(0);release(over);
    assert.equal(e2.dead,false);assert.equal(over.hp,50);assert.equal(over.soulDamageBonus,0);
  }
});

test('soul siphon stacks additively and also rewards a normal damage kill above threshold', () => {
  const r=setup('soul_siphon',5);r.hp=50;const one=dummy(r,10,1);r.castSlot(0);release(r);
  assert.ok(one.dead);near(r.soulDamageBonus,.07);near(r.hp,50+r.stats.hpMax*.12);
  const two=dummy(r,100000,.2);r.energy=100;r.slots[0].charges=1;r.slots[0].recharge=0;r.slots[0].cd=0;
  r.player.skillAction=null;r.castSlot(0);release(r);assert.ok(two.dead);near(r.soulDamageBonus,.14);
  const victim=dummy(r);const hp=victim.hp;r.hitEnemy(victim,100,{source:'minion'});near(hp-victim.hp,114);
});

test('soul siphon cannot execute a real boss or miniboss at low health or get an unearned reward', () => {
  for(const kind of ['boss','mini']) {
    const r=setup('soul_siphon',5);if(kind==='boss') r.spawnBoss('moon_devourer');else r.spawnMiniBoss('grub_mother');
    const e=kind==='boss'?r.boss:r.miniBoss;e.x=r.player.x+50;e.y=r.player.y;e.hpMax=100000;e.hp=10000;
    r.hp=50;r.castSlot(0);release(r);assert.equal(e.dead,false);assert.ok(e.hp<10000);
    assert.equal(r.hp,50);assert.equal(r.soulDamageBonus,0);
  }
});

test('brutal bite rank upgrades extend bleed, leech real damage, and execute non-bosses', () => {
  for(const rank of [1,3,4]) {
    const r=setup('brutal_bite',rank), e=dummy(r,100000,1);r.hp=50;r.castSlot(0);release(r,.12);
    const dealt=e.hpMax-e.hp;near(r.hp-50,dealt*(rank>=4?.25:.12));near(e.bleedTime,rank>=3?4.5:3);
  }
  const r=setup('brutal_bite',4),e=dummy(r,100,0.01);r.hp=50;r.castSlot(0);release(r,.12);assert.ok(e.dead);near(r.hp,50.25);
  const fin=setup('brutal_bite',5),target=dummy(fin,100000,.18);fin.castSlot(0);release(fin,.12);assert.ok(target.dead);
});

test('brutal bite rank five cannot instantly execute a real boss or miniboss', () => {
  for (const kind of ['boss','mini']) {
    const r=setup('brutal_bite',5);if(kind==='boss')r.spawnBoss('moon_devourer');else r.spawnMiniBoss('grub_mother');
    const e=kind==='boss'?r.boss:r.miniBoss;e.x=r.player.x+50;e.y=r.player.y;e.hpMax=100000;e.hp=10000;
    r.castSlot(0);release(r,.12);assert.equal(e.dead,false);assert.ok(e.hp<10000 && e.hp>9000);
  }
});

test('zero damage scaling cannot turn a finisher into a free execute', () => {
  for(const id of ['executioner','soul_siphon']) {
    const r=setup(id,5),e=dummy(r,100000,.1);
    const field=id==='executioner'?'skillScaleDamage':'skillScaleHealth';
    r.profile={settings:{[field]:0}};r.castSlot(0);release(r);assert.equal(e.dead,false);near(e.hp,10000);
  }
});

test('new finisher poses wind up while preserving movement and buffer the next skill', () => {
  for(const id of ['brutal_bite','soul_siphon']) {
    const r=new Run({catId:'tabby',skills:[id,'claw_slash'],seed:13});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
    r.player.x=785;r.player.y=380;r.player.invuln=999;const e=dummy(r);const casts=[];r.on('skill:cast',({id})=>casts.push(id));
    r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    const x=r.player.x;for(let i=0;i<3;i++)r.step(1/60,{moveX:1});
    assert.ok(r.player.x>x);assert.equal(e.hp,e.hpMax);
    for(let i=0;i<35;i++)r.step(1/60,{});
    assert.deepEqual(casts,[id,'claw_slash']);assert.ok(e.hp<e.hpMax);assert.equal(r.skillQueue.length,0);
  }
});
