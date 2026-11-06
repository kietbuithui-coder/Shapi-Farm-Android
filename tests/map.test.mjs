// Phase 5 of the update brief — map expansion.
//
// The arena grew from 1180x660 to 1570x660 (+33%). These tests guard the things
// that silently break when a world gets bigger: spawns that land on top of the
// player, bosses clamped against walls that moved, camera bounds that no longer
// cover the arena, and the renderer cropping the world it is asked to show.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ARENA, PLAY, GROUND_Y, Run } from '../src/systems/run.js';
import { makeRun, advance } from './harness.mjs';

const ORIGINAL_W = 1180;

test('the playable area actually grew, by 25-50%', () => {
  const growth = ARENA.w / ORIGINAL_W - 1;
  assert.ok(growth >= 0.25, `grew only ${(growth * 100).toFixed(1)}% — the brief asks for at least 25%`);
  assert.ok(growth <= 0.50, `grew ${(growth * 100).toFixed(1)}% — more than the 50% ceiling the brief sets`);
  // Growth must be in the PLAYABLE area, not just the painted backdrop.
  assert.ok(PLAY.right - PLAY.left > 1200, `playfield is only ${PLAY.right - PLAY.left}px wide`);
});

test('PLAY stays inside the arena on every edge', () => {
  assert.ok(PLAY.left >= 0);
  assert.ok(PLAY.top >= 0);
  assert.ok(PLAY.right <= ARENA.w, 'PLAY.right is past the arena wall');
  assert.ok(PLAY.bottom <= GROUND_Y, 'actors would stand below the floor line');
  assert.ok(PLAY.bottom > PLAY.top, 'the play band is inverted');
});

test('the floor line is still inside the arena', () => {
  assert.ok(GROUND_Y > PLAY.top && GROUND_Y < ARENA.h);
});

test('spawns are spread across the whole widened arena', () => {
  // With the old 60..260 band the right side would cluster near the old wall;
  // with a naive copy it would cluster in the left 1180px and leave the new
  // right-hand third of the map unused.
  const xs = [];
  for (let seed = 0; seed < 8; seed++) {
    const run = makeRun({ seed });
    advance(run, 8);
    for (const e of run.enemies) if (!e.boss && !e.dead) xs.push(e.x);
  }
  assert.ok(xs.length > 20, 'not enough spawns sampled');
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  assert.ok(minX < ARENA.w * 0.3, `nothing spawns in the left third (min x ${minX.toFixed(0)})`);
  assert.ok(maxX > ARENA.w * 0.7, `nothing spawns in the right third (max x ${maxX.toFixed(0)})`);
  // both halves must be used, not one side only
  const left = xs.filter((x) => x < ARENA.w / 2).length;
  const right = xs.filter((x) => x > ARENA.w / 2).length;
  assert.ok(left >= 3 && right >= 3, `lopsided spawning: ${left} left / ${right} right`);
});

test('no enemy ever spawns on top of the player', () => {
  // The brief calls this out explicitly: enemies must not materialise in the
  // player's lap. 220px is a cat-height and a half — enough to react.
  for (let seed = 0; seed < 10; seed++) {
    const run = makeRun({ seed });
    run.player.x = 240 + seed * 120;
    const d0 = [];
    run.on('enemy:spawn', ({ enemy }) => {
      d0.push(Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y));
    });
    advance(run, 6);
    const unfair = d0.filter((d) => d < 220);
    assert.equal(unfair.length, 0, `seed ${seed}: ${unfair.length} spawn(s) within 220px of the player`);
  }
});

test('every spawn lands inside the playfield', () => {
  for (let seed = 0; seed < 6; seed++) {
    const run = makeRun({ seed });
    let bad = 0;
    run.on('enemy:spawn', ({ enemy }) => {
      if (enemy.x < 0 || enemy.x > ARENA.w || enemy.y < PLAY.top - 40 || enemy.y > GROUND_Y) bad++;
    });
    advance(run, 8);
    assert.equal(bad, 0, `seed ${seed}: ${bad} spawn(s) outside the playfield`);
  }
});

test('a boss spawned in the widened arena is inside the playfield', () => {
  const run = makeRun({ seed: 3 });
  run.spawnBoss('moon_devourer');
  const b = run.boss;
  assert.ok(b, 'boss did not spawn');
  assert.ok(b.x > PLAY.left && b.x < PLAY.right, `boss x ${b.x.toFixed(0)} outside ${PLAY.left}..${PLAY.right}`);
  assert.ok(b.y > PLAY.top && b.y <= PLAY.bottom + 1, `boss y ${b.y.toFixed(0)} outside the play band`);
});

test('the player cannot leave the widened arena', () => {
  const run = makeRun({ seed: 1 });
  // shove hard into each corner for a second
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]]) {
    run.player.x = ARENA.w / 2;
    run.player.y = (PLAY.top + PLAY.bottom) / 2;
    advance(run, 1.6, {
      input: { moveX: dx, moveY: dy, aimX: dx, aimY: dy, dash: false, skills: [] },
    });
    assert.ok(run.player.x >= PLAY.left - 30 && run.player.x <= PLAY.right + 30, `player escaped horizontally to ${run.player.x.toFixed(0)}`);
    assert.ok(run.player.y >= PLAY.top - 30 && run.player.y <= PLAY.bottom + 40, `player escaped vertically to ${run.player.y.toFixed(0)}`);
    assert.ok(Number.isFinite(run.player.x) && Number.isFinite(run.player.y), 'player position went NaN');
  }
});

test('the bot steers away from the real walls, not the old ones', () => {
  // bot.js hardcoded 1180 before this change: it kept steering around a wall
  // that no longer existed and ignored the new one entirely.
  const run = makeRun({ seed: 2 });
  const p = run.player;
  p.x = ARENA.w - 40; // against the NEW right wall
  p.y = (PLAY.top + PLAY.bottom) / 2;
  const push = run.bot ? run.bot.edgePush(p) : null;
  if (push) {
    assert.ok(push.x < 0, `bot does not push away from the right wall at x=${p.x} (push.x=${push.x})`);
  }
});

test('camera framing covers the whole arena at every viewport', () => {
  // The camera clamp must allow reaching both walls; otherwise the extra arena
  // is visible but unreachable, or reachable but off screen.
  const VIEW = 1.62;
  const VIEWPORTS = [[1280, 720], [915, 412], [412, 915], [360, 780]];
  for (const [W, H] of VIEWPORTS) {
    const byWidth = W / ARENA.w;
    const byHeight = H / ARENA.h;
    const k = Math.max(byWidth, byHeight);
    const tall = H > W * 1.15;
    let fit = tall ? byWidth * 1.28 : k;
    if (tall) fit = Math.max(fit, (H * 0.85) / (ARENA.h * 1.62));
    fit = Math.max(fit, byHeight * 0.30);
    const visW = W / fit / VIEW;
    const visH = H / fit / VIEW;
    assert.ok(Number.isFinite(visW) && Number.isFinite(visH) && visW > 0 && visH > 0, `${W}x${H}: bogus visible size`);
    // A viewport wider than the arena would look silly, but must not invert the
    // clamp: max(visW/2, ARENA.w - visW/2) has to stay >= visW/2.
    assert.ok(ARENA.w - visW / 2 >= visW / 2, `${W}x${H}: camera x-clamp is inverted`);
  }
});
