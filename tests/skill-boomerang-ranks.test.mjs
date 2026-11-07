import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({ catId:'tabby', skills:[id], seed:31 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.player.invuln = 999; r.stats.crit = 0; r.slots[0].rank = rank; return r;
}
function release(r) { r.time += 0.12; r.updatePassiveEffects(0); }
function enemy(r, dx, dy = 0) {
  const e = addTrainingDummy(r, dx); e.y = r.player.y + dy; e.hp = e.hpMax = 100000;
  e.speed = 0; e.attackCd = 999; return e;
}
function tick(r, seconds) { for(let i=0;i<Math.ceil(seconds*60);i++) r.step(1/60, {}); }

test('both returning weapons turn rather than vanish when their outbound hit cap is reached', () => {
  for(const id of ['magic_yarn','paw_boomerang']) {
    const r = setup(id); const a = enemy(r, 70, -8), b = enemy(r, 120, -8);
    let hitsA = 0; r.on('fx:hit', ({enemy}) => { if(enemy === a) hitsA++; });
    r.castSlot(0); release(r); const pr = r.projectiles[0]; pr.angle = 0;
    tick(r, 0.3); assert.ok(pr.returning && r.projectiles.includes(pr), id);
    assert.ok(a.hp < a.hpMax && b.hp < b.hpMax); tick(r, 0.5);
    assert.equal(hitsA, 2, 'the first enemy can be hit once on each leg');
    assert.equal(r.projectiles.length, 0);
  }
});

test('paw boomerang rank three reaches more enemies before reversing', () => {
  for(const rank of [1,3]) {
    const r = setup('paw_boomerang',rank); const foes = [55,100,145,190].map(dx => enemy(r,dx,-8));
    r.castSlot(0); release(r); const pr = r.projectiles[0]; pr.angle = 0;
    tick(r,0.42); assert.ok(pr.returning); assert.equal(foes.filter(e => e.hp < e.hpMax).length, rank===1?2:4);
  }
});

test('rank five returning paw leech cannot use damage exceeding enemy HP', () => {
  const r = setup('paw_boomerang',5); const e = enemy(r,70,-8); e.hp = 1; r.hp = 50;
  r.castSlot(0); release(r); const pr = r.projectiles[0]; r.projectiles = [pr]; pr.angle = 0;
  for(let i=0;i<20 && !e.dead;i++) r.updateProjectiles(1/60);
  assert.ok(e.dead); assert.ok(Math.abs(r.hp - 50.2) < 1e-6);
});

test('rending wave rank two widens the actual projectile hitbox by 30 percent', () => {
  const radii = [];
  for(const rank of [1,2]) {
    const r = setup('rending_wave', rank); r.castSlot(0); tick(r,0.3); radii.push(r.projectiles[0].radius);
  }
  assert.ok(Math.abs(radii[1] / radii[0] - 1.3) < 1e-9);
});

test('needle barrage upgrades retain shot counts and pierce one target', () => {
  const r = setup('needle_barrage', 5); const shots = [];
  r.castSlot(0); tick(r,0.6); shots.push(...r.projectiles);
  assert.equal(shots.length, 12); assert.ok(shots.every(p => p.pierce === 1));
});

test('rending wave width upgrade reaches an offset enemy that rank one misses', () => {
  const hits = [];
  for (const rank of [1,2]) {
    const r = setup('rending_wave',rank); const e = enemy(r,120,0);
    r.castSlot(0); tick(r, 0.3); const pr = r.projectiles[0];
    pr.x = r.player.x; pr.y = r.player.y - 20; pr.angle = 0;
    // Fixed spacing falls between the two hitbox radii, including enemy radius.
    e.y = r.player.y - 8 + 39;
    for(let i=0;i<40 && r.projectiles.length;i++) r.updateProjectiles(1/60);
    hits.push(e.hp < e.hpMax);
  }
  assert.deepEqual(hits, [false,true]);
});

test('projectile poses wind up, preserve movement, and buffer the next skill', () => {
  for(const id of ['magic_yarn','paw_boomerang','needle_barrage']) {
    const r = new Run({ catId:'tabby', skills:[id,'claw_slash'], seed:31 });
    r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x=785; r.player.y=380; r.player.invuln=999;
    enemy(r,250); const events=[]; r.on('skill:cast', ({id})=>events.push(id)); const x=r.player.x;
    assert.ok(r.castSlot(0).ok); assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    for(let i=0;i<3;i++) r.step(1/60,{moveX:1});
    assert.ok(r.player.x>x); assert.equal(r.projectiles.length,0,`${id} waits for windup`);
    tick(r,0.55); assert.deepEqual(events,[id,'claw_slash']); assert.equal(r.skillQueue.length,0);
    assert.ok(r.projectiles.length>0,`${id} emits real projectiles`);
  }
});

test('a returning paw can strike a real boss on both legs when a second target forces the turn', () => {
  const r = setup('paw_boomerang'); r.spawnBoss('moon_devourer'); const boss = r.boss;
  boss.x = r.player.x + 70; boss.y = r.player.y - 8; boss.attackTimer = 999;
  enemy(r, 150, -8); let hits = 0; r.on('fx:hit', event => { if(event.enemy === boss) hits++; });
  r.castSlot(0); release(r); const pr = r.projectiles[0]; pr.angle = 0;
  for(let i=0;i<100 && r.projectiles.includes(pr);i++) r.updateProjectiles(1/60);
  assert.equal(hits, 2); assert.equal(r.projectiles.length, 0);
});
