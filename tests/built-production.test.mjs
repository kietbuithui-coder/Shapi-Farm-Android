import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom-built.mjs';
import { addTrainingDummy } from './harness.mjs';
import { UPGRADE_BY_ID } from '../src/data/upgrades.js';

test('shipped HTML applies real attack upgrades, thorn DoT and overkill-safe lifesteal',async()=>{
  const {game}=await bootGame();game.startRun({catId:'tabby',skills:['claw_slash'],seed:5});const r=game.run;
  r.state='fight';r.waveEnemiesLeft=999;r.player.x=700;r.player.y=380;
  const foe=addTrainingDummy(r,50);foe.hp=foe.hpMax=10000;foe.attackCd=999;
  const before=r.stats.atk;r.applyUpgrade(UPGRADE_BY_ID.keen_edge);assert.ok(Math.abs(r.stats.atk/before-1.14)<1e-8);
  r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);r.stats.lifesteal=.1;r.hp=1;foe.mark=.5;r.hitEnemy(foe,100,{source:'skill'});
  assert.equal(r.hp,16);assert.equal(foe.thornDps,15);const hp=foe.hp;r.updateEnemies(.08);assert.ok(Math.abs(hp-foe.hp-1.2)<1e-8);
});
