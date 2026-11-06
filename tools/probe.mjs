import { Run } from '../src/systems/run.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash'], seed: 1 });
run.start();
run.stateTimer = 0; run.state = 'fight';
for (let i = 0; i < 60; i++) { run.step(1/60, { moveX: 1, moveY: 0 }); if (i % 20 === 0) console.log('x', run.player.x.toFixed(1), 'vx', run.player.vx.toFixed(1), 'state', run.state); }
