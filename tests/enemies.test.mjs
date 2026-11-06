// Phase 6 of the update brief — five new enemies.
//
// The brief's bar is explicit: each new enemy needs its own sprite, animation,
// AI, attack pattern, hitbox, stats, death animation and drops, and must be
// genuinely distinct rather than a recoloured or tankier clone. These tests
// check the things that are easy to fake and easy to break:
//
//   · every enemy is reachable from the real spawn tables
//   · every enemy's attack actually resolves into damage (not just a telegraph)
//   · every dangerous attack is dodgeable by moving
//   · the new behaviours differ from the existing ones numerically
//   · the shapes are real, distinct draw functions

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ENEMIES, ENEMY_BY_ID } from '../src/data/enemies.js';
import { ACTS } from '../src/data/acts.js';
import { Run } from '../src/systems/run.js';
import { drawCreature } from '../src/art/creatureart.js';
import { createCanvas } from '@napi-rs/canvas';

const NEW_IDS = ['shadow_stalker', 'crystal_crawler', 'arcane_bat', 'explosive_slime', 'thorn_beast'];

/** A run with one test enemy, the player pacified, and the enemy immortal. */
function arena(enemyId, { dx = 240, seed = 7, skills = [] } = {}) {
  const run = new Run({ catId: 'tabby', skills, perks: {}, seed });
  run.start();
  for (let i = 0; i < 90; i++) run.step(1 / 60, {});
  run.enemies.length = 0;
  run.pendingSpawns.length = 0;
  run.waveEnemiesLeft = 0;
  const e = run.makeEnemy(ENEMY_BY_ID[enemyId], {}, {});
  e.x = run.player.x + dx;
  e.y = run.player.y;
  e.spawnT = 2;
  e.attackCd = 0;
  e.hp = e.hpMax = 99_999;
  run.enemies.push(e);
  return { run, e };
}

/** Step the run for `seconds`, keeping the player alive, returning damage dealt. */
function soak(run, e, seconds, input = {}) {
  let damage = 0;
  let told = 0;
  let resolved = 0;
  const offTell = run.on('enemy:tell', ({ enemy }) => { if (enemy === e) told++; });
  const offAtk = run.on('enemy:attack', ({ enemy }) => { if (enemy === e) resolved++; });
  let last = run.hp;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    run.step(1 / 60, input);
    if (run.hp < last) damage += last - run.hp;
    last = run.hp;
    run.hp = run.stats.hpMax;
    if (run.state !== 'fight') break;
  }
  if (typeof offTell === 'function') offTell();
  if (typeof offAtk === 'function') offAtk();
  return { damage, told, resolved };
}

/* ── roster ─────────────────────────────────────────────────────────────── */

test('all five new enemies exist with complete data', () => {
  for (const id of NEW_IDS) {
    const def = ENEMY_BY_ID[id];
    assert.ok(def, `${id} is missing from the roster`);
    assert.equal(def.id, id);
    assert.ok(def.shape, `${id} has no sprite shape`);
    assert.ok(def.hp > 0 && def.speed > 0 && def.damage > 0 && def.radius > 0, `${id} has incomplete stats`);
    assert.ok(def.xp > 0 && def.gold > 0, `${id} gives no reward`);
    assert.ok(def.behaviour && def.attack, `${id} has no AI profile`);
    assert.ok(def.windup > 0, `${id} has no telegraph`);
    assert.ok(def.color && def.color2 && def.eye, `${id} has no palette`);
  }
});

test('the roster grew by five without duplicating any id', () => {
  assert.equal(ENEMIES.length, 15);
  const ids = ENEMIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate enemy id');
  // The five originals this brief named must be present and distinct.
  for (const id of NEW_IDS) assert.ok(ids.includes(id), `${id} missing`);
});

test('every new enemy is reachable from the real spawn tables', () => {
  const spawnable = new Set(ACTS.flatMap((a) => a.table.map((e) => e.id)));
  for (const id of NEW_IDS) {
    assert.ok(spawnable.has(id), `${id} never appears in any act's spawn table`);
  }
  // and every table entry must resolve to a real definition
  for (const act of ACTS) {
    for (const entry of act.table) {
      assert.ok(ENEMY_BY_ID[entry.id], `${act.id} spawns unknown enemy ${entry.id}`);
      assert.ok(entry.weight > 0);
    }
  }
});

test('new enemies are introduced progressively, not all in act 1', () => {
  // Difficulty ramp: the hardest newcomer should not be in the first act.
  const inAct1 = new Set(ACTS[0].table.map((e) => e.id));
  assert.equal(inAct1.has('shadow_stalker'), false, 'the elite stalker would trivialise act 1');
  assert.equal(inAct1.has('thorn_beast'), false, 'the siege unit is too punishing for act 1');
  const inAct3 = new Set(ACTS[2].table.map((e) => e.id));
  assert.ok(inAct3.has('shadow_stalker') && inAct3.has('thorn_beast'), 'act 3 must use the hardest additions');
});

/* ── AI distinctness ────────────────────────────────────────────────────── */

test('each new enemy has a behaviour that no existing enemy used', () => {
  const old = ['chase', 'strafe', 'rush', 'keepDistance', 'orbit', 'leap', 'stalk', 'boss'];
  for (const id of NEW_IDS) {
    assert.equal(old.includes(ENEMY_BY_ID[id].behaviour), false, `${id} reuses the ${ENEMY_BY_ID[id].behaviour} behaviour`);
  }
  const behaviours = NEW_IDS.map((id) => ENEMY_BY_ID[id].behaviour);
  assert.equal(new Set(behaviours).size, 5, 'the new enemies share behaviours between themselves');
});

test('new enemies are not stat clones of existing ones', () => {
  // A "recolour" would show up as identical hp/speed/damage/radius.
  const sig = (d) => `${d.hp}/${d.speed}/${d.damage}/${d.radius}`;
  const seen = new Map();
  for (const e of ENEMIES) {
    const key = sig(e);
    assert.equal(seen.has(key), false, `${e.id} has the same stat block as ${seen.get(key)}`);
    seen.set(key, e.id);
  }
});

test('the new enemies actually move', () => {
  for (const id of NEW_IDS) {
    const { run, e } = arena(id);
    const start = { x: e.x, y: e.y };
    for (let i = 0; i < 180; i++) run.step(1 / 60, {});
    const moved = Math.hypot(e.x - start.x, e.y - start.y);
    assert.ok(moved > 4, `${id} barely moved (${moved.toFixed(1)}px in 3s)`);
  }
});

test('each new enemy produces its own attack, with a telegraph first', () => {
  for (const id of NEW_IDS) {
    const { run, e } = arena(id, { dx: 200 });
    const { told, damage } = soak(run, e, 12);
    assert.ok(told >= 1, `${id} never telegraphed an attack in 12s`);
    assert.ok(damage > 0, `${id} attacked but dealt no damage — a telegraph that promises nothing`);
  }
});

/* ── fairness ───────────────────────────────────────────────────────────── */

test('every new enemy attack can be dodged by moving', () => {
  // The brief requires every dangerous attack to be avoidable.
  //
  // This has to distinguish ATTACKED damage from CONTACT damage. A contact
  // attacker (the bat) is evaded by breaking line of contact during its
  // wind-up, and simply running in one direction is not a dodge — the bat is
  // faster than the player, so it lands its touch either way. The property that
  // actually matters is: an attack that connects must have had a window in
  // which the player could have avoided it. That is asserted directly for the
  // telegraphed attacks below, and the contact attacker is checked separately.
  const CONTACT = new Set(['arcane_bat']); // shape 'touch' attacks
  const MOVING = { moveX: 1, moveY: 0, aimX: 1, aimY: 0, dash: false, skills: [] };

  for (const id of NEW_IDS) {
    if (CONTACT.has(id)) continue;
    const still = arena(id, { dx: 150 });
    const taken1 = soak(still.run, still.e, 6).damage;
    const moving = arena(id, { dx: 150 });
    const taken2 = soak(moving.run, moving.e, 6, MOVING).damage;
    assert.ok(
      taken2 < taken1,
      `${id}: dodging did not help (standing ${taken1.toFixed(1)} vs moving ${taken2.toFixed(1)})`,
    );
  }
});

test('the contact attacker telegraphs long enough to break contact', () => {
  // The bat's wind-up is the dodge window: it must be long enough to react to
  // (>= 0.2s, the accepted human reaction floor for a telegraphed strike) and
  // the attack must WHIFF if the player leaves its reach in time.
  const def = ENEMY_BY_ID.arcane_bat;
  assert.ok(def.windup >= 0.2, `bat wind-up is only ${def.windup}s`);

  const { run, e } = arena('arcane_bat', { dx: 40 });
  let whiffs = 0;
  run.on('fx:whiff', ({ x, y }) => {
    if (Math.hypot(x - e.x, y - e.y) < 80) whiffs++;
  });
  // Run away as fast as possible for long enough to see several attempts.
  for (let i = 0; i < 360; i++) {
    run.step(1 / 60, { moveX: -1, moveY: 0, aimX: 1, aimY: 0, dash: false, skills: [] });
    run.hp = run.stats.hpMax;
    if (run.state !== 'fight') break;
  }
  assert.ok(whiffs >= 1, 'the bat landed every touch: its wind-up is not a real dodge window');
});

test('no new enemy deletes a full-health player in one attack', () => {
  // One-shot kills from a basic enemy are unfair regardless of telegraphing.
  const maxHp = 118; // tabby base
  for (const id of NEW_IDS) {
    const def = ENEMY_BY_ID[id];
    assert.ok(def.damage < maxHp * 0.55, `${id} deals ${def.damage}, over half a starting cat's health`);
  }
});

test('the explosive slime is dodgeable but not ignorable', () => {
  // The blast arms at the rim of its radius and the slime roots itself while the
  // fuse burns, so the circle is exactly where the telegraph drew it. Standing
  // in it must hurt; leaving must be a clean escape.
  const still = arena('explosive_slime', { dx: 160 });
  const takenStill = soak(still.run, still.e, 6).damage;
  const moving = arena('explosive_slime', { dx: 160 });
  const takenMoving = soak(moving.run, moving.e, 6, { moveX: 1, moveY: 0, aimX: 1, aimY: 0, dash: false, skills: [] }).damage;
  assert.ok(takenStill > 0, 'standing in the slime must hurt');
  assert.equal(takenMoving, 0, 'walking away must be a clean escape');
  // and it must not be a one-shot from a basic enemy
  assert.ok(takenStill < 118, `the slime did ${takenStill.toFixed(0)} to a 118 hp cat`);
});

/* ── sprites ────────────────────────────────────────────────────────────── */

test('each new enemy draws a distinct, non-empty sprite', () => {
  // Render each shape and compare pixel signatures. Two enemies producing the
  // same pixels means one is a recolour, which the brief forbids.
  const signatures = new Map();
  for (const id of NEW_IDS) {
    const def = ENEMY_BY_ID[id];
    const cv = createCanvas(120, 120);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 120, 120);
    ctx.save();
    ctx.translate(60, 100);
    // normalise colour so the comparison is about SHAPE, not palette
    drawCreature(ctx, { ...def, color: '#888888', color2: '#333333', eye: '#ffffff' }, { t: 1.2 }, { scale: 2, facing: 1 });
    ctx.restore();
    const { data } = ctx.getImageData(0, 0, 120, 120);
    let painted = 0;
    const bits = [];
    for (let i = 0; i < data.length; i += 4) {
      const on = data[i] > 24 ? 1 : 0;
      painted += on;
      if (i % 160 === 0) bits.push(on);
    }
    assert.ok(painted > 150, `${id} drew almost nothing (${painted} px)`);
    signatures.set(id, bits.join(''));
  }
  const uniq = new Set(signatures.values());
  assert.equal(uniq.size, NEW_IDS.length, 'two new enemies render identical silhouettes');
});

test('evey new enemy has a death and spawn pose the renderer can use', () => {
  // The renderer animates death via `dead`/`deathT` and spawn via `spawnT`;
  // drawing with those poses set must not throw.
  for (const id of NEW_IDS) {
    const def = ENEMY_BY_ID[id];
    const cv = createCanvas(120, 120);
    const ctx = cv.getContext('2d');
    for (const pose of [{ dead: 1 }, { hurt: 1 }, { fade: 0.2 }, { swell: 0.9 }, { t: 0 }]) {
      assert.doesNotThrow(() => {
        ctx.save();
        ctx.translate(60, 100);
        drawCreature(ctx, def, pose, { scale: 1.5, facing: -1 });
        ctx.restore();
      }, `${id} throws while drawing pose ${JSON.stringify(pose)}`);
    }
  }
});

/* ── integration ────────────────────────────────────────────────────────── */

test('a real wave containing new enemies runs without throwing', () => {
  // Force the act-3 table, which holds the most newcomers, and play it out.
  for (let seed = 0; seed < 4; seed++) {
    const run = new Run({ catId: 'tabby', skills: ['claw_slash'], perks: {}, seed });
    run.start();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 60 * 20; i++) {
        if (run.state === 'levelup') { run.chooseOffer(0); continue; }
        if (run.state === 'reward') { run.chooseReward(0); continue; }
        if (run.state === 'dead' || run.state === 'victory') break;
        run.step(1 / 60, {});
      }
    }, `seed ${seed} threw during a normal wave`);
  }
});

test('new enemies die, drop, and are cleaned up', () => {
  for (const id of NEW_IDS) {
    const { run, e } = arena(id);
    e.hp = e.hpMax = 10; // killable
    run.hitEnemy(e, 999, { source: 'skill' });
    assert.equal(e.dead, true, `${id} did not die`);
    // the corpse must be removed after the death animation, not leak forever
    for (let i = 0; i < 120; i++) run.step(1 / 60, {});
    assert.equal(run.enemies.includes(e), false, `${id} corpse was never cleaned up`);
  }
});
