import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash','pounce','nine_lives','fireball'], seed: 7 });
const bot = new BotBrain(run);
run.start();
for (let i = 0; i < 60 * 180; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (run.time > 88 && run.time < 101 && i % 30 === 0) {
    const b = run.boss;
    console.log(`t=${run.time.toFixed(1)} boss=${b? b.hp.toFixed(0):'-'} phase=${b?.phase} state=${run.state} enemies=${run.enemies.filter(e=>!e.dead).map(e=>e.id).join(',')}`);
  }
  if (run.state === 'dead') break;
}
