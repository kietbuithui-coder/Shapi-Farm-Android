import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash','pounce','nine_lives','fireball'], seed: 7 });
const bot = new BotBrain(run);
run.start();
let lastLog = 0;
for (let i = 0; i < 60 * 200; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (run.time - lastLog > 4) {
    lastLog = run.time;
    const mb = run.miniBoss;
    console.log(`t=${run.time.toFixed(1)} n${run.night} w${run.wave} ${run.state} hp=${run.hp.toFixed(0)}/${run.stats.hpMax.toFixed(0)} mini=${mb?mb.hp.toFixed(0):'-'} enemies=${run.enemies.filter(e=>!e.dead).length} left=${run.waveEnemiesLeft} pend=${run.pendingSpawns.length}`);
  }
  if (run.state === 'dead') { console.log('DEAD', run.time); break; }
}
