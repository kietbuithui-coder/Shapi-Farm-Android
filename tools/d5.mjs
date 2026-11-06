import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
const cat = CATS.find(c=>c.id==='sphynx');
const run = new Run({ catId: 'sphynx', skills: [...cat.skills, 'claw_slash'], seed: 3 });
const bot = new BotBrain(run);
run.events.on('player:hurt', ({amount}) => { if (amount > 8) console.log('  hurt', amount.toFixed(1), 'hp', run.hp.toFixed(0)); });
run.events.on('boss:attack', ({attack}) => console.log('  boss', attack, 't', run.time.toFixed(1)));
run.start();
for (let i = 0; i < 60 * 120; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (run.state === 'dead') { console.log('DEAD at', run.time.toFixed(1), 'night', run.night, 'wave', run.wave); break; }
}
