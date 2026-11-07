import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:43});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.stats.regen=0;ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function foe(r,dx=60){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function release(r,t=.12){r.time+=t;r.updatePassiveEffects(0);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('lucky paw rank one and three grant the declared temporary crit chance with a cap',()=>{
  for(const [rank,bonus] of [[1,.12],[2,.12],[3,.2],[4,.2],[5,.2]]){
    const r=setup(['lucky_paw'],[rank]);r.stats.crit=.05;r.castSlot(0);assert.equal(r.effectiveCrit(),.05);release(r);
    near(r.effectiveCrit(),.05+bonus*r.skillPotency(r.slots[0].def));near(r.stats.crit,.05);
    r.stats.crit=.84;assert.equal(r.effectiveCrit(),.85);r.stats.crit=.05;r.updateBuffs(8.01);near(r.effectiveCrit(),.05);
  }
});

test('lucky paw changes real critical rolls for melee, projectile, chain, teleport and drain',()=>{
  for(const id of ['claw_slash','arcane_paw','thunder_purr','shadow_strike','life_drain']){
    const r=setup(['lucky_paw',id],[3,1]);const e=foe(r,70);r.castSlot(0);release(r);r.player.skillAction=null;
    r.rng._next=()=>.1;let hit;r.on('fx:hit',x=>{if(x.enemy===e)hit=x;});r.castSlot(1);release(r,.3);
    if(id==='arcane_paw')for(let i=0;i<30&&!hit;i++)r.updateProjectiles(1/60);
    assert.ok(hit,`${id} hit`);assert.equal(hit.crit,true,`${id} crits from the buff`);
    assert.ok(hit.amount>0);assert.equal(r.stats.crit,0);
  }
});

test('luck rank two increases actual gold, health and ember drop chances while active',()=>{
  for(const rank of [1,2,4]){
    const r=setup(['lucky_paw'],[rank]);r.castSlot(0);release(r);const e=foe(r);e.gold=.8;const probs=[];
    r.rng.chance=p=>{probs.push(p);return true;};r.killEnemy(e);
    const multiplier=1+(rank>=2?.12*r.skillPotency(r.slots[0].def):0);
    near(probs[0],.8*multiplier);near(probs[1],.035*multiplier);near(probs[2],.18*multiplier);
    const gold=r.pickups.find(p=>p.kind==='gold');assert.equal(gold.value,rank>=4?3:2);
    assert.ok(r.pickups.some(p=>p.kind==='hp'));assert.ok(r.pickups.some(p=>p.kind==='ember'));
  }
});

test('luck drop boost ends with the buff, respects chance cap and does not change fixed boss embers',()=>{
  const r=setup(['lucky_paw'],[5]);r.castSlot(0);release(r);const probabilities=[];
  r.rng.chance=p=>{probabilities.push(p);return true;};const e=foe(r);e.gold=1;e.boss=true;r.killEnemy(e);
  assert.equal(probabilities[0],1);assert.equal(r.embersFound,20);
  r.updateBuffs(8.01);probabilities.length=0;const e2=foe(r);e2.gold=.8;r.killEnemy(e2);
  near(probabilities[0],.8);near(probabilities[1],.035);near(probabilities[2],.18);
});

test('lucky rank five lets a living kitten crit, with boss summon resistance still applied',()=>{
  for(const rank of [4,5]){
    const r=setup(['lucky_paw'],[rank]);r.castSlot(0);release(r);r.rng._next=()=>.1;
    const e=foe(r,60);e.boss=true;const kitten={kind:'kitten',x:e.x-20,y:e.y,life:2,hp:40,maxHp:40,damage:10,attackCd:0,t:0};
    r.minions.push(kitten);let hit;r.on('fx:hit',x=>hit=x);r.player.attackAnim=0;r.updateMinions(.01);
    assert.equal(hit.source,'minion');assert.equal(hit.crit,rank===5);near(hit.amount,10*.55*(rank===5?r.stats.critDmg:1));
    assert.equal(r.player.attackAnim,0);
  }
});

test('lucky ally critical bonus does not cause orbs, periodic damage or reflected damage to crit',()=>{
  const r=setup(['lucky_paw'],[5]);r.castSlot(0);release(r);r.rng._next=()=>.1;const e=foe(r);
  for(const opts of [{source:'orbit'},{source:'minion',tick:true},{source:'reflect'}]){
    const hp=e.hp;r.hitEnemy(e,10,opts);near(hp-e.hp,10);
  }
});

test('mana snack ranks restore energy, optionally heal, and apply bounded temporary cooldown reduction',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['mana_snack'],[rank]);r.energy=0;r.hp=40;r.stats.cdr=.05;r.castSlot(0);assert.equal(r.energy,0);release(r);
    near(r.energy,(rank>=2?55:40)*r.skillPotency(r.slots[0].def));
    near(r.hp,rank>=4?40+r.stats.hpMax*.1:40);near(r.stats.cdr,.05);
    near(r.buffValue('cdr'),rank>=3?.12:0);
    near(r.slots[0].rechargeDuration,(rank>=5?12:16)*.95/Math.sqrt(r.stats.atkSpeed));
    r.updateBuffs(8.01);near(r.buffValue('cdr'),0);near(r.stats.cdr,.05);
  }
});

test('mana cooldown bonus only applies to casts made during the buff, cannot stack via echo, and caps',()=>{
  const r=setup(['mana_snack','claw_slash','pounce'],[3,1,1]);r.mods.echo=1;foe(r);r.castSlot(0);release(r);
  assert.equal(r.player.buffs.filter(b=>b.cdr).length,2);near(r.buffValue('cdr'),.12);
  r.player.skillAction=null;r.castSlot(1);near(r.slots[1].rechargeDuration,.34*.88/Math.sqrt(r.stats.atkSpeed));
  r.updateBuffs(8.01);r.castSlot(2);near(r.slots[2].rechargeDuration,4.5/Math.sqrt(r.stats.atkSpeed));
  const capped=setup(['mana_snack','claw_slash'],[3,1]);capped.stats.cdr=.58;foe(capped);capped.castSlot(0);release(capped);
  capped.player.skillAction=null;capped.castSlot(1);near(capped.slots[1].rechargeDuration,.34*.4/Math.sqrt(capped.stats.atkSpeed));
});

test('healing purr gains regeneration at rank three, not at rank one',()=>{
  for(const rank of [1,3]){
    const r=setup(['healing_purr'],[rank]);r.hp=20;r.castSlot(0);const immediate=r.hp;
    r.updateBuffs(5);if(rank===1)near(r.hp,immediate);else near(r.hp-immediate,r.stats.hpMax*.28);
  }
});

test('support poses wind up without blocking movement and buffer the next skill',()=>{
  for(const id of ['mana_snack','lucky_paw']){
    const r=setup([id,'claw_slash']);foe(r);if(id==='mana_snack')r.energy=20;
    const casts=[];r.on('skill:cast',({id})=>casts.push(id));r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    const x=r.player.x;tick(r,.05,{moveX:1});assert.ok(r.player.x>x);assert.equal(r.player.buffs.length,0);
    tick(r,.6);assert.deepEqual(casts,[id,'claw_slash']);assert.equal(r.skillQueue.length,0);
  }
});
