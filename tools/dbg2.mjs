import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash','pounce','nine_lives','fireball'], seed: 7 });
const bot = new BotBrain(run);
run.start();
run.events.on('boss:attack', ({attack, enemy}) => { if (attack==='fanShot') console.log(`  boss fanShot phase=${enemy.phase} dmg=${enemy.dmg.toFixed(1)}`); });
for (let i = 0; i < 60 * 200; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (Math.abs(run.time - 128) < 0.01 || Math.abs(run.time-132)<0.01 || Math.abs(run.time-136)<0.01 || Math.abs(run.time-140)<0.01 || Math.abs(run.time-144)<0.01) {
    console.log(`t=${run.time.toFixed(0)} hp=${run.hp.toFixed(0)} boss=${run.boss?run.boss.hp.toFixed(0):'-'} state=${run.state} enemies=${run.enemies.filter(e=>!e.dead).map(e=>e.id).join(',')}`);
  }
  if (run.state === 'dead') break;
}
console.log('END hp', run.hp.toFixed(1), 'state', run.state, 'boss', run.boss?.hp.toFixed(0), run.boss?.hpMax.toFixed(0));
