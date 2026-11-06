// Shared test harness: a deterministic headless Run with no DOM, no audio and
// no timers, so every suite exercises the same engine the game ships.
import { Run, RUN_STATE } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';

export function makeRun({ cat = 'tabby', skills = ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'], perks = {}, seed = 7, difficulty = 'normal' } = {}) {
  const run = new Run({ catId: cat, skills, perks, seed, difficulty });
  return run;
}

/** Advance a run with scripted input for `seconds`, resolving overlays. */
export function advance(run, seconds, input = {}, { autoResolve = true } = {}) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    run.step(dt, input);
    if (autoResolve) {
      let guard = 0;
      while (run.state === RUN_STATE.LEVELUP && guard++ < 10) run.chooseOffer(0);
      guard = 0;
      while (run.state === RUN_STATE.REWARD && guard++ < 10) run.chooseReward(0);
    }
    if (run.state === RUN_STATE.DEAD || run.state === RUN_STATE.VICTORY) break;
  }
  return run;
}

/** Play with the bot until death/victory or the wall-clock budget runs out. */
export function autoplay(run, maxSeconds = 900) {
  const bot = new BotBrain(run, { skill: 1 });
  run.bot = bot;
  const dt = 1 / 60;
  let t = 0;
  while (t < maxSeconds) {
    const input = bot.update(dt);
    run.step(dt, input);
    if (run.state === RUN_STATE.LEVELUP) { bot.chooseOffer(); }
    if (run.state === RUN_STATE.REWARD) run.chooseReward(0);
    if (run.state === RUN_STATE.DEAD || run.state === RUN_STATE.VICTORY) break;
    t += dt;
  }
  return { run, time: t, bot };
}

export const DT = 1 / 60;

/**
 * Put a stationary, harmless enemy in front of the player so skills that require
 * a facing target can be exercised. Real fights always have targets; tests must
 * not accidentally test the "no target" branch.
 */
export function addTrainingDummy(run, dx = 60) {
  const def = {
    id: 'dummy', tier: 0, shape: 'grub', hp: 99999, speed: 0, damage: 0, radius: 18,
    xp: 0, gold: 0, behaviour: 'idle', attack: 'none', windup: 9,
    color: '#888', color2: '#555', eye: '#fff',
  };
  const e = run.makeEnemy(def, null, { scale: { hp: 1, dmg: 1, speed: 1, xp: 1, gold: 1 } });
  e.x = Math.min(1084, run.player.x + dx);
  e.y = run.player.y;
  e.hp = 99999;
  e.hpMax = 99999;
  run.enemies.push(e);
  return e;
}
