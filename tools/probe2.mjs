import { Run } from '../src/systems/run.js';
const run = new Run({ catId: 'tabby', skills: ['claw_slash'], seed: 1 });
run.start(); run.state = 'fight'; run.stateTimer = 0;
console.log('stats.move', run.stats.move, 'buffVal', run.buffValue('move'), 'moveSpeedMul', run.player.moveSpeedMul);
run.updatePlayer(1/60, { moveX: 1, moveY: 0 });
console.log('after updatePlayer x', run.player.x, 'vx', run.player.vx, 'state', run.state);
