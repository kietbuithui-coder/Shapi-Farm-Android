import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash','pounce','nine_lives','fireball'], seed: 7 });
const bot = new BotBrain(run);
run.start();
for (let i = 0; i < 60 * 400; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (i % 600 === 0) {
    const mb = run.miniBoss;
    console.log(`${(i/60).toFixed(0)}s n${run.night} w${run.wave} ${run.state} hp=${run.hp.toFixed(0)} mini=${mb? mb.hp.toFixed(0)+'/'+mb.hpMax.toFixed(0)+' d='+Math.hypot(mb.x-run.player.x,mb.y-run.player.y).toFixed(0):'-'} enemies=${run.enemies.length} left=${run.waveEnemiesLeft} pending=${run.pendingSpawns.length}`);
  }
  if (run.state === 'dead' || run.state === 'victory') break;
}
console.log('end', run.state);
