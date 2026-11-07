import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILL_ACTIONS, skillActionPose, actionDuration } from '../src/systems/skill-animation.js';
import { drawCat } from '../src/art/catart.js';
import { playerPose } from '../src/art/actors.js';
import { addTrainingDummy } from './harness.mjs';

function runWith(skills) {
  const r = new Run({ catId: 'tabby', skills, seed: 10 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999;
  r.player.x = 785; r.player.y = 380; r.player.invuln = 999;
  const e = addTrainingDummy(r, 70); e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999;
  return r;
}
function tick(run, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) run.step(1/60, {});
}
function silhouette(run, id, elapsed, facing = 1) {
  run.player.skillAction = id ? { id, elapsed } : null;
  const canvas = createCanvas(180, 160); const ctx = canvas.getContext('2d');
  drawCat(ctx, run.cat, playerPose(run, 1), { x: 90, y: 135, scale: 1.4, facing });
  const d = ctx.getImageData(0, 0, 180, 160).data;
  return Uint8Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3] > 100 ? 1 : 0);
}
function diff(a, b) { let n = 0; for (let i=0; i<a.length; i++) if (a[i] !== b[i]) n++; return n; }

test('committed skills animate distinct cat silhouettes through all phases in both directions without VFX', () => {
  const run = runWith(['meteor_paw']);
  for (const facing of [-1, 1]) {
    const shapes = [];
    for (const [id, spec] of Object.entries(SKILL_ACTIONS)) {
      const start = silhouette(run, id, spec.startup * 0.15, facing);
      const windup = silhouette(run, id, spec.startup * 0.95, facing);
      const active = silhouette(run, id, spec.startup + spec.active * 0.7, facing);
      const recovery = silhouette(run, id, spec.startup + spec.active + spec.recovery * 0.75, facing);
      assert.ok(diff(start, windup) > 35, `${id}: visible startup ${facing}`);
      assert.ok(diff(windup, active) > 35, `${id}: visible action ${facing}`);
      assert.ok(diff(active, recovery) > 35, `${id}: visible recovery ${facing}`);
      shapes.push([id, active]);
      assert.ok(actionDuration(spec) < 0.5);
      assert.ok(skillActionPose({ id, elapsed: 0.01 }));
    }
    for (let i=0; i<shapes.length; i++) for (let j=i+1; j<shapes.length; j++) {
      assert.ok(diff(shapes[i][1], shapes[j][1]) > 35, `${shapes[i][0]} vs ${shapes[j][0]} (${facing})`);
    }
  }
});

test('buffered skills reserve resources and execute FIFO after recovery', () => {
  const run = runWith(['meteor_paw', 'claw_slash', 'pounce', 'flying_fish']);
  const casts = []; run.on('skill:cast', ({ id }) => casts.push(id));
  assert.equal(run.castSlot(0).ok, true);
  assert.deepEqual(run.castSlot(1), { ok: true, queued: true });
  assert.deepEqual(run.castSlot(2), { ok: true, queued: true });
  assert.deepEqual(run.castSlot(3), { ok: true, queued: true });
  assert.equal(run.slots[2].reserved, 1); assert.equal(run.slots[2].charges, 0);
  const energyAfterReservations = run.energy;
  assert.equal(run.castSlot(2).ok, false, 'the same reserved charge cannot be spent twice');
  tick(run, 0.15); assert.deepEqual(casts, ['meteor_paw']);
  // Even if all remaining energy is spent, accepted inputs keep their reservation.
  run.energy = 0; tick(run, 0.6);
  assert.deepEqual(casts, ['meteor_paw', 'claw_slash', 'pounce', 'flying_fish']);
  assert.equal(run.skillQueue.length, 0); assert.equal(run.slots[2].reserved, 0);
  assert.ok(run.slots[2].recharge > 0 && energyAfterReservations >= 0);
});

test('buffer and action pause together and are refunded when entering a reward', () => {
  const run = runWith(['lunar_beam', 'pounce']); run.castSlot(0);
  const energyBefore = run.energy;
  assert.equal(run.castSlot(1).queued, true); assert.equal(run.energy, energyBefore - run.slots[1].def.cost);
  const elapsed = run.player.skillAction.elapsed;
  run.paused = true; tick(run, 1); run.paused = false;
  assert.equal(run.player.skillAction.elapsed, elapsed); assert.equal(run.skillQueue.length, 1);
  run.setState(RUN_STATE.REWARD);
  assert.equal(run.skillQueue.length, 0); assert.equal(run.player.skillAction, null);
  assert.equal(run.slots[1].charges, 1); assert.equal(run.slots[1].reserved, 0);
  assert.equal(run.energy, energyBefore);
});

test('reserved multi-charge input does not regenerate before it is executed', () => {
  const run = runWith(['meteor_paw', 'pounce']);
  run.slots[1].maxCharges = 2; run.slots[1].charges = 2;
  run.castSlot(0); run.castSlot(1); run.castSlot(1);
  assert.equal(run.slots[1].reserved, 2); assert.equal(run.slots[1].charges, 0);
  tick(run, 0.15); assert.equal(run.slots[1].charges, 0);
  tick(run, 0.5); assert.equal(run.slots[1].reserved, 0);
  assert.equal(run.slots[1].charges, 0); assert.ok(run.slots[1].recharge > 0);
});

test('double leap and thunder step strike once along their actual path', () => {
  for (const id of ['double_leap', 'thunder_step']) {
    const run = runWith([id]); const e = run.enemies[0];
    e.x = run.player.x + 130;
    let hits = 0; run.on('fx:hit', ({ enemy }) => { if (enemy === e) hits++; });
    run.castSlot(0);
    assert.equal(e.hp, e.hpMax, `${id} does not hit instantly at the origin`);
    tick(run, 0.7);
    assert.ok(e.hp < e.hpMax, `${id} hits on the route`);
    assert.equal(hits, 1, `${id} cannot hit the same enemy every frame`);
    if (id === 'thunder_step') assert.ok(e.burnTime > 0 && e.burn > 0, 'lightning scorches a target');
  }
});

test('rank five blink grants the declared longer invulnerability', () => {
  const run = runWith(['blink_paw']); run.player.invuln = 0; run.slots[0].rank = 5;
  run.castSlot(0); assert.ok(run.player.invuln >= 0.6);
});

test('mirror ward reflects one hostile projectile back without duplicating it', () => {
  const run = runWith(['mirror_paw']); const e = run.enemies[0];
  run.player.invuln = 0; run.castSlot(0); tick(run, 0.3);
  assert.ok(run.player.shield > 0); const shield = run.player.shield;
  const projectile = run.spawnProjectile({ x: run.player.x + 10, y: run.player.y - 20, angle: Math.PI, speed: 80, damage: 5, owner: 'enemy', source: 'enemy' });
  run.updateProjectiles(0.02);
  assert.equal(projectile.owner, 'player'); assert.equal(run.projectiles.length, 1);
  assert.ok(run.player.shield < shield);
  for (let i=0; i<120 && run.projectiles.length; i++) run.updateProjectiles(1/60);
  assert.ok(e.hp < e.hpMax, 'returned projectile can damage an enemy');
});

test('gravity well rank three pulls normal enemies, not bosses', () => {
  for (const boss of [false, true]) {
    const run = runWith(['gravity_well']); const e = run.enemies[0]; e.boss = boss;
    run.slots[0].rank = 3; run.castSlot(0); tick(run, 0.3);
    const zone = run.zones[0]; e.x = zone.x + 30; e.y = zone.y; const x = e.x;
    run.updateZones(0.1);
    if (boss) assert.equal(e.x, x); else assert.ok(e.x < x);
  }
});

test('brutal bite rank three extends bleed and healing purr removes slow at rank five', () => {
  const a = runWith(['brutal_bite']); a.slots[0].rank = 3; a.castSlot(0);
  a.time += 0.11; a.updatePassiveEffects(0);
  assert.equal(a.enemies[0].bleedTime, 4.5);
  const b = runWith(['healing_purr']); b.slots[0].rank = 5;
  b.playerSlow = { amount: 0.5, time: 4 }; b.castSlot(0);
  assert.equal(b.playerSlow, null);
});

test('boss-wave charge refresh does not duplicate a buffered charge', () => {
  const run = runWith(['meteor_paw', 'pounce']);
  run.castSlot(0); assert.equal(run.castSlot(1).queued, true);
  run.beginWave(5);
  assert.equal(run.slots[1].reserved, 1); assert.equal(run.slots[1].charges, 0);
  tick(run, 0.5);
  assert.equal(run.slots[1].reserved, 0); assert.equal(run.slots[1].charges, 0);
  assert.ok(run.slots[1].recharge > 0);
});

test('a queued committed cast completes before the next buffered action', () => {
  const run = runWith(['rending_wave', 'starfall_volley', 'claw_slash']);
  const casts = []; run.on('skill:cast', ({ id }) => casts.push(id));
  assert.ok(run.castSlot(0).ok); assert.ok(run.castSlot(1).queued); assert.ok(run.castSlot(2).queued);
  tick(run, 0.6); assert.deepEqual(casts, ['rending_wave', 'starfall_volley']);
  tick(run, 0.6); assert.deepEqual(casts, ['rending_wave', 'starfall_volley', 'claw_slash']);
});

test('frost and whirling have short visible windups, allow movement, and buffer the next cast', () => {
  for (const id of ['frost_nova', 'whirling_claws']) {
    const run = runWith([id, 'claw_slash']); const e = run.enemies[0]; const start = run.player.x;
    const casts = []; run.on('skill:cast', event => casts.push(event.id));
    assert.ok(run.castSlot(0).ok); assert.deepEqual(run.castSlot(1), { ok: true, queued: true });
    for (let i = 0; i < 3; i++) run.step(1/60, { moveX: 1 });
    assert.ok(run.player.x > start); assert.equal(e.hp, e.hpMax, 'impact waits for startup');
    tick(run, 0.5); assert.ok(e.hp < e.hpMax); assert.deepEqual(casts, [id, 'claw_slash']);
    assert.equal(run.skillQueue.length, 0);
  }
});

test('new sustain attacks visibly wind up and buffer the next skill without blocking movement', () => {
  for (const id of ['blood_fang', 'life_drain', 'shadow_strike']) {
    const run = runWith([id, 'claw_slash']); const e = run.enemies[0]; const x = run.player.x;
    const casts = []; run.on('skill:cast', event => casts.push(event.id));
    assert.ok(run.castSlot(0).ok); assert.deepEqual(run.castSlot(1), { ok:true, queued:true });
    for (let i = 0; i < 3; i++) run.step(1/60, { moveX:1 });
    assert.ok(run.player.x > x); assert.equal(e.hp, e.hpMax, `${id}: startup precedes damage`);
    tick(run, 0.5); assert.ok(e.hp < e.hpMax); assert.deepEqual(casts, [id, 'claw_slash']);
  }
});
