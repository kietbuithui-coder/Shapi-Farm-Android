// Controller input. The gamepad path is easy to break silently: nothing throws,
// the buttons just stop working. These tests press real button indices through
// the real Input class and assert the effect reaches the Run.
import test from 'node:test';
import assert from 'node:assert/strict';

/** Install a fake gamepad for the duration of a test. */
function fakePad() {
  const pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: 0, vibrate: () => {}, getGamepads: () => [pad] },
    configurable: true,
    writable: true,
  });
  return {
    pad,
    press(i) { pad.buttons[i].pressed = true; },
    release(i) { pad.buttons[i].pressed = false; },
    releaseAll() { pad.buttons.forEach((b) => { b.pressed = false; }); },
    stick(x, y) { pad.axes[0] = x; pad.axes[1] = y; },
  };
}

/**
 * Boot into an active fight with a stable loadout.
 * Note: bootGame() defines its own `navigator`, so the fake pad has to be
 * installed afterwards — that ordering is the whole reason this helper exists.
 */
async function inFight() {
  const { bootGame } = await import('./dom.mjs');
  const { game, step } = await bootGame();
  const pad = fakePad();
  step(3);
  game.go('run', {
    catId: 'tabby',
    skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'],
    difficulty: 'normal',
  });
  for (let i = 0; i < 200 && game.scene !== 'run'; i++) step(1);
  for (let i = 0; i < 120; i++) step(1);        // clear the intro
  assert.equal(game.run.state, 'fight', 'run is fighting');
  return { game, step, run: game.run, pad };
}

const idle = async (step, frames = 150) => { for (let i = 0; i < frames; i++) step(1); };

test('dash fires from the pad even with a centred stick', async () => {
  const { step, run, pad: p } = await inFight();
  // Regression: the whole pad used to be skipped when the stick was centred,
  // which disabled dash and every skill unless you were already moving.
  p.stick(0, 0);
  const e0 = run.energy;
  p.press(0);                                    // A
  step(1);
  assert.ok(run.player.invuln > 0.1, 'dash granted i-frames');
  assert.ok(run.energy < e0, 'dash spent energy');
  p.release(0);
});

test('holding the dash button does not repeat-dash', async () => {
  const { step, run, pad: p } = await inFight();
  // Count dash events, not energy: energy regenerates every tick, so a constant
  // reading would be a false signal in either direction.
  let dashes = 0;
  run.on('player:dash', () => { dashes++; });
  p.press(0);
  for (let i = 0; i < 30; i++) step(1);          // held for half a second
  p.release(0);
  assert.equal(dashes, 1, `a held button fires once (got ${dashes})`);
  // release and press again only after the cooldown
  for (let i = 0; i < 60; i++) step(1);
  p.press(0);
  step(1);
  p.release(0);
  assert.equal(dashes, 2, 'a fresh press after the cooldown dashes again');
});

test('every skill slot can be cast from the pad', async () => {
  const { step, run, pad: p } = await inFight();
  const bindings = [[2, 'slot 1'], [1, 'slot 2'], [3, 'slot 3'], [5, 'slot 4']];
  for (const [btn, label] of bindings) {
    p.releaseAll();
    await idle(step, 200);                       // let cooldowns clear
    const before = run.statsTotals.casts;
    p.press(btn);
    step(1);
    assert.ok(run.statsTotals.casts > before, `${label} casts from button ${btn}`);
    p.release(btn);
  }
});

test('the stick moves the cat', async () => {
  const { step, run, pad: p } = await inFight();
  p.releaseAll();
  const x0 = run.player.x;
  p.stick(0.9, 0);
  for (let i = 0; i < 10; i++) step(1);
  assert.ok(run.player.x > x0 + 1, 'right on the stick moves right');
  p.stick(0, 0);
});

test('a dead zone keeps drift from moving the cat', async () => {
  const { step, run, pad: p } = await inFight();
  p.releaseAll();
  const x0 = run.player.x;
  const y0 = run.player.y;
  p.stick(0.05, -0.04);                          // stick drift
  for (let i = 0; i < 20; i++) step(1);
  assert.ok(Math.abs(run.player.x - x0) < 0.5, 'no horizontal drift');
  assert.ok(Math.abs(run.player.y - y0) < 0.5, 'no vertical drift');
  p.stick(0, 0);
});

test('keyboard one-shots still work and do not stick', async () => {
  const { game, step, run, pad: p } = await inFight();
  p.releaseAll();
  let dashes = 0;
  run.on('player:dash', () => { dashes++; });
  game.input.pressed.dodge = true;
  step(1);
  assert.equal(dashes, 1, 'keyboard dash still fires');
  for (let i = 0; i < 10; i++) step(1);
  assert.equal(dashes, 1, 'the one-shot was consumed, not held');
});
