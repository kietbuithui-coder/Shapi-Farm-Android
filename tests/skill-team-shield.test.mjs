import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { ENEMY_BY_ID } from '../src/data/enemies.js';
import { drawMinion } from '../src/art/actors.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:87});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=0;r.stats.crit=0;r.stats.regen=0;r.stats.energyRegen=0;r.stats.dodge=0;r.stats.def=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function ally(r,kind='lion',dx=40){return {kind,x:r.player.x+dx,y:r.player.y,life:10,hp:40,maxHp:40,shield:0,attackCd:999,t:0,damage:0,taunt:true,facing:1};}
function dummy(r,dx){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}

test('purr shield ranks scale player pool and cooldown while rank four protects only nearby living allies',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['purr_shield'],[rank]);const living=['lion','kitten','spirit'].map(k=>ally(r,k));
    const far=ally(r,'lion',181),dead=ally(r,'lion',30),expired=ally(r,'kitten',30),orb={kind:'orb',x:r.player.x,y:r.player.y};
    dead.hp=0;expired.life=0;r.minions.push(...living,far,dead,expired,orb);r.castSlot(0);assert.equal(r.player.shield,0);release(r);
    const fraction=.3*(rank>=2?1.25:1)*r.skillPotency(r.slots[0].def);
    near(r.player.shield,r.stats.hpMax*fraction);near(r.player.shieldTime,7);
    near(r.slots[0].rechargeDuration,(rank>=5?8:10)/Math.sqrt(r.stats.atkSpeed));
    for(const m of living){near(m.shield,rank>=4?m.maxHp*fraction:0);if(rank>=4)near(m.shieldTime,7);}
    assert.equal(far.shield,0);assert.equal(dead.shield,0);assert.equal(expired.shield,0);assert.equal(orb.shield,undefined);
  }
});

test('ally shield absorbs real taunting-enemy contact before health and can break into overflow',()=>{
  const r=setup(['guardian_lion','purr_shield'],[3,4]);r.castSlot(0);tick(r,.35);
  const lion=r.minions.find(m=>m.kind==='lion');assert.ok(lion?.taunt);lion.x=r.player.x+80;lion.y=r.player.y;lion.attackCd=999;
  r.castSlot(1);tick(r,.35);const initialShield=lion.shield, hp=lion.hp;assert.ok(initialShield>0);
  const e=r.makeEnemy(ENEMY_BY_ID.grub,{},{});e.x=lion.x+25;e.y=lion.y;e.spawnT=2;e.attackCd=0;e.hp=e.hpMax=100000;r.enemies.push(e);
  r.updateEnemies(.01);r.updateEnemies(.15);assert.ok(lion.shield<initialShield);near(lion.hp,hp);
  let bursts=0;r.on('fx:blast',()=>bursts++);const before=lion.shield;r.damageMinion(lion,before+5);
  near(lion.hp,hp-5);assert.equal(lion.shield,0);assert.equal(lion.shieldTime,0);assert.equal(bursts,1);
  r.damageMinion(lion,1);assert.equal(bursts,1);
});

test('ally shield break uses the existing burst without triggering on-hit or forced crit',()=>{
  const r=setup(['purr_shield'],[4]),lion=ally(r);r.minions.push(lion);const nearEnemy=dummy(r,70),far=dummy(r,250);
  r.castSlot(0);release(r);r.forceCrit=true;r.attackCounter=2;r.mods.everyThird=4;const hp=nearEnemy.hp;
  let bursts=0;r.on('fx:blast',()=>bursts++);r.damageMinion(lion,lion.shield);
  assert.equal(bursts,1);assert.ok(nearEnemy.hp<hp);assert.equal(far.hp,far.hpMax);
  assert.equal(r.forceCrit,true);assert.equal(r.attackCounter,2);
});

test('ally shields expire without exploding and cannot prevent subsequent contact',()=>{
  const r=setup(['purr_shield'],[4]),lion=ally(r);r.minions.push(lion);r.castSlot(0);release(r);
  let bursts=0;r.on('fx:blast',()=>bursts++);r.updateMinionShields(7.01);
  assert.equal(lion.shield,0);assert.equal(lion.shieldBlast,null);const hp=lion.hp;r.damageMinion(lion,5);
  near(lion.hp,hp-5);assert.equal(bursts,0);
});

test('weaker ally shields do not steal break effects, echo does not stack shields',()=>{
  const r=setup(['purr_shield'],[4]),lion=ally(r);r.minions.push(lion);r.mods.echo=1;r.castSlot(0);release(r);
  const amount=lion.shield,effect=lion.shieldBlast;near(amount,lion.maxHp*.3*1.25*r.skillPotency(r.slots[0].def));
  r.applyMinionShield(lion,amount/2,2,null);near(lion.shield,amount);assert.equal(lion.shieldBlast,effect);near(lion.shieldTime,2);
  r.applyMinionShield(lion,amount+1,2,null);assert.equal(lion.shieldBlast,null);
  let bursts=0;r.on('fx:blast',()=>bursts++);r.damageMinion(lion,amount+1);assert.equal(bursts,0);
});

test('ally shield expires before an enemy attack in the same game tick',()=>{
  const r=setup(['purr_shield'],[4]),lion=ally(r);r.minions.push(lion);r.castSlot(0);release(r);
  lion.shieldTime=.01;const e=r.makeEnemy(ENEMY_BY_ID.grub,{},{});e.x=lion.x+20;e.y=lion.y;e.spawnT=2;
  e.windupT=.01;e.leash=1;e.attackCd=1;e.hp=e.hpMax=100000;r.enemies.push(e);
  const hp=lion.hp;r.step(.05,{});assert.equal(lion.shield,0);assert.ok(lion.hp<hp);
});

test('catnip ranks change effective cooldown, movement, energy regeneration and damage taken only while active',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['catnip_frenzy','claw_slash'],[rank,1]);dummy(r,60);r.energy=50;r.castSlot(0);release(r);
    const potency=r.skillPotency(r.slots[0].def),speed=(rank>=2?.45:.35)*potency;
    near(r.buffValue('atkSpeed'),speed);near(r.buffValue('move'),rank>=3?.3*potency:0);
    near(r.buffValue('drawback'),rank>=5?0:.15);
    const energy=r.energy;r.updatePlayer(1,{});near(r.energy-energy,rank>=4?6:0);
    r.player.skillAction=null;r.castSlot(1);near(r.slots[1].rechargeDuration,.34/Math.sqrt(r.stats.atkSpeed*(1+speed)));
    const hp=r.hp;r.player.invuln=0;r.damagePlayer(10,null);near(hp-r.hp,10*(rank>=5?1:1.15));
    r.updateBuffs(6.01);near(r.buffValue('atkSpeed'),0);near(r.buffValue('move'),0);near(r.buffValue('drawback'),0);
  }
});

test('catnip echo does not multiply buffs and movement increase is applied to actual movement',()=>{
  const r=setup(['catnip_frenzy'],[5]);r.mods.echo=1;r.castSlot(0);release(r);
  assert.equal(r.player.buffs.length,2);near(r.buffValue('atkSpeed'),.45*r.skillPotency(r.slots[0].def));
  const energy=r.energy;r.updatePlayer(1,{});near(r.energy-energy,6);
  function travel(rank){const x=setup(['catnip_frenzy'],[rank]);x.castSlot(0);release(x);const start=x.player.x;x.updatePlayer(.2,{moveX:1});return x.player.x-start;}
  assert.ok(travel(3)>travel(2));
});

test('the actual minion renderer visibly draws the shield bubble',()=>{
  const r=setup(['purr_shield'],[4]),lion=ally(r);lion.x=100;lion.y=110;
  function frame(){const c=createCanvas(200,160);drawMinion(c.getContext('2d'),lion,1);return c.getContext('2d').getImageData(0,0,200,160).data;}
  const before=frame();lion.shield=10;lion.shieldTime=4;const after=frame();let diff=0;
  for(let i=3;i<before.length;i+=4)if(before[i]!==after[i])diff++;assert.ok(diff>200);
});

test('shield and frenzy poses wind up while moving and buffer the next action',()=>{
  for(const id of ['purr_shield','catnip_frenzy']){
    const r=setup([id,'claw_slash']);dummy(r,60);const casts=[];r.on('skill:cast',({id})=>casts.push(id));r.castSlot(0);
    assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});assert.ok(r.player.x>x);
    assert.equal(r.player.shield,0);assert.equal(r.player.buffs.length,0);tick(r,.55);assert.deepEqual(casts,[id,'claw_slash']);
  }
});
