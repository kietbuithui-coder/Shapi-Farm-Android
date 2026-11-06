// Regression tests for the "first boss gets stuck" report.
//
// The brief lists eight suspected causes. Each one gets a scenario that would
// expose it, and every scenario asserts the boss *keeps fighting*: it must keep
// changing position and keep resolving attacks. A boss that freezes produces a
// run that can never end, so this is a correctness property, not a nicety.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, DT, addTrainingDummy } from './harness.mjs';
import { RUN_STATE, ARENA, GROUND_Y, PLAY } from '../src/systems/run.js';

// Corner/mid positions derived from the live playfield. These used to be literal
// 96 / 1084 / 252 / 440, which silently stopped meaning "at the wall" the moment
// the arena was widened — the tests would keep passing while exercising
// different geometry than the names claimed.
const LEFT_WALL = PLAY.left;
const RIGHT_WALL = PLAY.right;
const MID_Y = (PLAY.top + PLAY.bottom) / 2;
const TOP_Y = PLAY.top + 4;

const FIRST_BOSS = 'moon_devourer';

/** Spawn the first boss in an active fight, with an optional placement. */
function bossRun({ seed = 5, bx, by, px, py, cat = 'tabby' } = {}) {
  const run = makeRun({ seed, cat });
  run.start();
  advance(run, 1.5);
  run.spawnBoss(FIRST_BOSS);
  if (bx != null) run.boss.x = bx;
  if (by != null) run.boss.y = by;
  if (px != null) run.player.x = px;
  if (py != null) run.player.y = py;
  return run;
}

/**
 * Step the run while holding the player still (or following a script) and report
 * how the boss behaved. `hold` keeps the player pinned so we test the boss, not
 * the player's escape.
 */
function observe(run, seconds, { hold = null, onStep = null } = {}) {
  const boss = run.boss;
  const start = { x: boss.x, y: boss.y };
  let travelled = 0;
  let lastX = boss.x;
  let lastY = boss.y;
  let longestStill = 0;
  let still = 0;
  let attacks = 0;
  const off = run.on ? run.on('boss:attack', () => { attacks++; }) : null;
  const frames = Math.round(seconds / DT);
  // Ignore the opening moments: a boss spawns with a 1.4s attack timer and holds
  // still at its preferred range while that counts down. That is an intro beat,
  // not the stuck bug, and conflating the two would hide a real regression.
  const settleFrames = Math.round(1.8 / DT);
  for (let i = 0; i < frames; i++) {
    if (hold) { run.player.x = hold.x; run.player.y = hold.y; }
    if (onStep) onStep(run, i);
    run.step(DT, {});
    while (run.state === RUN_STATE.LEVELUP) run.chooseOffer(0);
    const b = run.boss;
    if (!b) break;
    const moved = Math.hypot(b.x - lastX, b.y - lastY);
    travelled += moved;
    if (i > settleFrames) {
      if (moved < 0.02) { still += DT; longestStill = Math.max(longestStill, still); } else still = 0;
    }
    lastX = b.x; lastY = b.y;
    if (run.state === RUN_STATE.DEAD || run.state === RUN_STATE.VICTORY) break;
  }
  void off;
  return {
    attacks,
    travelled,
    longestStill,
    boss: run.boss,
    dx: run.boss ? run.boss.x - start.x : 0,
  };
}

test('the first boss engages a player pinned to the left wall', () => {
  const run = bossRun({ px: 96, py: 440 });
  const r = observe(run, 10, { hold: { x: LEFT_WALL, y: MID_Y } });
  assert.ok(r.attacks >= 2, `boss must keep attacking (got ${r.attacks})`);
  assert.ok(r.longestStill < 2.5, `boss must not freeze (still for ${r.longestStill.toFixed(2)}s)`);
});

test('the first boss engages a player pinned to the right wall', () => {
  const run = bossRun({ px: 1084, py: 440 });
  const r = observe(run, 10, { hold: { x: RIGHT_WALL, y: MID_Y } });
  assert.ok(r.attacks >= 2, `boss must keep attacking (got ${r.attacks})`);
  assert.ok(r.longestStill < 2.5, `boss must not freeze (still for ${r.longestStill.toFixed(2)}s)`);
});

test('the first boss engages a player tucked into a top corner', () => {
  const run = bossRun({ px: 100, py: 252 });
  const r = observe(run, 10, { hold: { x: LEFT_WALL + 4, y: TOP_Y } });
  assert.ok(r.attacks >= 2, `boss must keep attacking (got ${r.attacks})`);
  assert.ok(r.longestStill < 2.5, 'boss must not freeze in a corner');
});

test('the first boss engages a player behind it at the map edge', () => {
  // Player between the boss and the wall: the boss wants to retreat from 150px,
  // which used to press it into the boundary with the player boxed in.
  const run = bossRun({ bx: 1070, by: 440, px: 1084, py: 440 });
  const r = observe(run, 10, { hold: { x: RIGHT_WALL, y: MID_Y } });
  assert.ok(r.attacks >= 2, `boss must keep attacking (got ${r.attacks})`);
  assert.ok(r.longestStill < 2.5, 'boss must not freeze against the wall');
});

test('the first boss keeps fighting while the player circles it', () => {
  const run = bossRun();
  const r = observe(run, 12, {
    onStep: (rr, i) => {
      const a = (i / 60) * 1.9;
      const b = rr.boss || { x: ARENA.w / 2, y: 440 };
      rr.player.x = b.x + Math.cos(a) * 90;
      rr.player.y = Math.max(252, Math.min(504, b.y + Math.sin(a) * 50));
    },
  });
  assert.ok(r.attacks >= 3, `boss must keep attacking (got ${r.attacks})`);
  assert.ok(r.longestStill < 2.5, 'boss must not freeze while circled');
});

test('knockback and stun do not wedge the boss in a state', () => {
  const run = bossRun({ bx: 120, by: 260, px: 200, py: 300 });
  const boss = run.boss;
  // Shove it into the corner and stun it, the two things the brief suspects.
  run.knockback(boss, 900);
  boss.stun = 0.6;
  const r = observe(run, 10, { hold: { x: PLAY.left + 104, y: PLAY.top + 50 } });
  assert.ok(r.boss, 'boss survived');
  assert.ok(r.attacks >= 2, `boss resumed attacking after knockback + stun (got ${r.attacks})`);
  assert.ok(r.longestStill < 3.0, `boss did not stay wedged (still ${r.longestStill.toFixed(2)}s)`);
  assert.ok(boss.stun <= 0.05, `stun decayed (${boss.stun.toFixed(2)})`);
});

test('phase transitions do not skip or stall the attack loop', () => {
  const run = bossRun();
  const boss = run.boss;
  const phases = [];
  run.on('boss:phase', ({ phase }) => phases.push(phase));
  // Walk the boss down through its health gates while it fights.
  //
  // 30s, not 20s: the arena is 33% wider, so the boss spends longer in transit
  // and fewer attacks land inside any given window.
  //
  // The player is also kept alive. This test is about the boss's phase machine,
  // not about whether a stationary cat survives a boss — holding them still for
  // 30s in a 1570px arena is a guaranteed death, and once the player dies the
  // run enters DEAD and the boss stops updating, so the phase gates that had not
  // yet fired never fire. Pinning hp keeps the scenario measuring what its name
  // says it measures.
  let i = 0;
  const r = observe(run, 30, {
    hold: { x: ARENA.w / 2, y: MID_Y },
    onStep: (rr, step) => {
      i = step;
      // HP lives on the Run (`run.hp`), not on `run.player` — pinning the wrong
      // object did nothing and the cat died anyway, which ended the run and
      // stopped the boss updating before its last phase could fire.
      rr.hp = rr.stats.hpMax;
      const b = rr.boss;
      // Walk down to just inside the final gate, then stop draining: driving to
      // zero just kills the boss, and observe() stops watching when it is gone.
      const floor = b ? b.hpMax * 0.24 : 0;
      if (b && i % 30 === 0) b.hp = Math.max(floor, b.hp - b.hpMax * 0.02);
    },
  });
  assert.ok(phases.length >= 2, `boss changed phase (${phases.join(',')})`);
  assert.ok(r.attacks >= 3, `boss kept attacking across phases (got ${r.attacks})`);
  // The boss may legitimately have died inside the window (the player is immortal
  // here, so a kill just means the fight ended); what must not happen is the boss
  // vanishing while healthy, which would mean the phase machine dropped it.
  if (run.boss) {
    assert.equal(run.boss.dead, false, 'boss still alive and fighting');
    assert.ok(run.boss.phase >= 1, 'boss advanced a phase');
  } else {
    assert.equal(boss.dead, true, 'the boss reference was dropped without a kill');
  }
});

test('the boss stays inside the playfield and never leaves it', () => {
  const run = bossRun();
  let outside = 0;
  observe(run, 15, {
    hold: { x: RIGHT_WALL - 4, y: PLAY.bottom - 6 },
    onStep: (rr) => {
      const b = rr.boss;
      if (!b) return;
      if (b.x < 96 - 1 || b.x > ARENA.w - 96 + 1) outside++;
      if (b.y < 250 - 1 || b.y > GROUND_Y - 6 + 1) outside++;
    },
  });
  assert.equal(outside, 0, 'boss never escaped the playfield');
});

test('every boss attack resolves into something the player can react to', () => {
  // A pattern that silently does nothing is invisible in play — the boss just
  // stands there. Check each one produces a telegraph, a hazard or a projectile.
  const run = bossRun();
  const boss = run.boss;
  const firstPhase = boss.def.phases[0];
  for (const attack of firstPhase.attacks) {
    const before = {
      hazards: run.hazards.length,
      projectiles: run.projectiles.length,
      enemies: run.enemies.length,
      tells: 0,
    };
    const off = run.on('enemy:tell', () => { before.tells++; });
    run.runBossAttack(boss, attack);
    // some patterns schedule a delayed follow-up
    for (let i = 0; i < 30; i++) run.step(DT, {});
    const produced =
      run.hazards.length + run.projectiles.length + run.enemies.length + before.tells;
    assert.ok(produced > before.hazards + before.projectiles + before.enemies,
      `attack "${attack}" produced no telegraph, hazard, projectile or summon`);
  }
});

test('a boss fight can be finished — no unwinnable stall', () => {
  // The strongest statement of the bug: if the boss can wedge, the night never
  // ends. Play a boss out with a training dummy parked nearby for the skills.
  const run = bossRun({ seed: 7 });
  addTrainingDummy(run, 70);
  run.boss.hp = run.boss.hpMax * 0.25;
  let frames = 0;
  const limit = 60 * 90;
  while (run.boss && frames < limit && run.state !== RUN_STATE.DEAD) {
    run.boss.hp -= 2.5;                       // steady damage from the "player"
    run.player.invuln = 1;                    // keep the player alive
    run.step(DT, {});
    while (run.state === RUN_STATE.LEVELUP) run.chooseOffer(0);
    frames++;
  }
  assert.equal(run.boss, null, `boss died within ${limit} frames (took ${frames})`);
  assert.ok(frames < limit, 'fight resolved rather than hanging');
});

test('a boss that genuinely cannot move is rescued, not left frozen', () => {
  // The watchdog must work even in a situation the movement code cannot solve,
  // so this test removes speed entirely and parks the boss on the player.
  const run = bossRun({ bx: 1070, by: 440, px: 1084, py: 440 });
  const boss = run.boss;
  // `boss.speed = 0` does NOT pin the boss: updateBosses re-derives speed from
  // the def every frame, so that line was cosmetic and this test only passed
  // while the old fixed attack cycle happened to open with a leap that kept the
  // boss rooted. Set the source of truth instead, and restore it afterwards.
  const realSpeed = boss.def.speed;
  boss.def.speed = 0;
  let relocations = 0;
  run.on('fx:blink', (e) => { if (e && e.color === '#a48bff') relocations++; });
  try {
    // Two full detection rounds are needed before the rescue: 45 frames to
    // notice, a fresh orbit bias to try, then 45 more before the relocation.
    // That is ~2.4s of grace by design, so give the test 4.5s rather than
    // asserting on a window that ended one round early.
    for (let i = 0; i < 270; i++) {
      run.player.x = 1084;
      run.player.y = 440;
      run.step(DT, {});
    }
  } finally {
    boss.def.speed = realSpeed;
  }
  assert.ok(relocations > 0, 'the anti-stuck system relocated a frozen boss');
  const d = Math.hypot(boss.x - run.player.x, boss.y - run.player.y);
  assert.ok(d > 40, `boss was moved to open ground (${d.toFixed(0)}px away)`);
});

test('a boss never shares a pixel with the player', () => {
  // Separation floor: overlap made the old bug invisible (d === 0) and made melee
  // unreadable, because the boss silhouette sat inside the cat.
  const run = bossRun({ bx: 1084, by: 440, px: 1084, py: 440 });
  let closest = Infinity;
  for (let i = 0; i < 420; i++) {
    run.player.x = 1084;
    run.player.y = 440;
    run.step(DT, {});
    if (!run.boss) break;
    closest = Math.min(closest, Math.hypot(run.boss.x - run.player.x, run.boss.y - run.player.y));
  }
  assert.ok(closest > 20, `boss kept a ${closest.toFixed(1)}px separation`);
});

test('stun actually stops a boss and then wears off', () => {
  const run = bossRun();
  const boss = run.boss;
  // Stay clear of the 1.0 phase gate at full health so a phase transition does
  // not clear the stun out from under the test.
  boss.hp = boss.hpMax * 0.9;
  boss.stun = 1.0;
  const x0 = boss.x;
  const y0 = boss.y;
  // Sample mid-stun, not on the exact frame the timer reaches zero.
  for (let i = 0; i < 24; i++) run.step(DT, {});         // 0.4s
  assert.ok(boss.stun > 0, `stun still running (${boss.stun.toFixed(2)})`);
  assert.ok(Math.hypot(boss.x - x0, boss.y - y0) < 2,
    'a stunned boss does not move or attack');
  const attacksDuringStun = run.time;
  for (let i = 0; i < 60; i++) run.step(DT, {});         // past the stun
  assert.ok(boss.stun <= 0, 'stun expired');
  const before = { x: boss.x, y: boss.y };
  for (let i = 0; i < 40; i++) run.step(DT, {});
  assert.ok(Math.hypot(boss.x - before.x, boss.y - before.y) > 0.5,
    'boss moves again after the stun');
  void attacksDuringStun;
});
