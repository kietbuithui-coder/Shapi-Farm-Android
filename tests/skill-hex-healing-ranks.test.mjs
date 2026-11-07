import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:91});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.stats.regen=0;r.stats.energyRegen=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function enemy(r,dx,dy=0){const e=addTrainingDummy(r,dx);e.x=r.player.x+dx;e.y=r.player.y+dy;e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function minion(r,kind,dx,hp=10,life=10){return {kind,x:r.player.x+dx,y:r.player.y,hp,maxHp:40,life};}

test('hex ranks apply the specified amp, spread and periodic damage',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['hex_brand'],[rank]),a=enemy(r,60),b=enemy(r,135),far=enemy(r,220);let marks=0;r.on('fx:mark',()=>marks++);
    r.castSlot(0);const amp=(rank===1?.18:rank<5?.24:.36)*r.skillPotency(r.slots[0].def);
    near(a.mark,amp);near(a.markTime,7);near(b.mark,rank>=3?amp:0);near(far.mark,0);
    assert.equal(marks,rank>=3?2:1);assert.equal(a.markDps>0,rank>=4);if(rank>=4)near(a.markDps,r.skillDamage(r.slots[0].def,.25));
    assert.equal(b.markDps>0,rank>=4);
  }
});

test('hex chooses nearest living enemy within actual range and faces it, not a target in aim-assist range',()=>{
  for(const side of [-1,1]){
    const r=setup(['hex_brand'],[1]);const outside=enemy(r,side*361);r.player.facing=-side;let cast;
    r.on('fx:skill',x=>cast=x);r.castSlot(0);near(outside.mark,0);assert.equal(cast.target,null);
    const s=setup(['hex_brand'],[1]),a=enemy(s,side*340),b=enemy(s,side*300);b.dead=true;s.player.facing=-side;
    s.castSlot(0);assert.ok(a.mark>0);assert.equal(s.player.facing,side);
  }
});

test('skill area upgrades extend both hex targeting range and spread radius',()=>{
  const r=setup(['hex_brand'],[3]);r.mods.skillArea=.2;const a=enemy(r,370),b=enemy(r,370,125),far=enemy(r,370,135);
  r.castSlot(0);assert.ok(a.mark>0);assert.ok(b.mark>0);assert.equal(far.mark,0);
});

test('hex vulnerability amplifies skill, orbit and blast damage once, and expires without on-hit effects',()=>{
  for(const source of ['skill','orbit','blast']){
    const r=setup(['hex_brand'],[5]),e=enemy(r,60);r.castSlot(0);const amp=e.mark;
    r.forceCrit=true;r.attackCounter=0;const hp=e.hp;r.hitEnemy(e,10,{source});near(hp-e.hp,10*(1+amp));
    assert.equal(r.attackCounter,source==='skill'?1:0);assert.equal(r.forceCrit,true);
    e.markDps=0;e.markTime=.03;r.updateEnemies(.08);near(e.mark,0);const before=e.hp;r.hitEnemy(e,10,{source});near(before-e.hp,10);
  }
});

test('hex DoT resolves only its remaining duration without generating crit or on-hit',()=>{
  const r=setup(['hex_brand'],[4]),e=enemy(r,60);r.castSlot(0);r.forceCrit=true;r.attackCounter=2;r.mods.everyThird=10;
  const dps=e.markDps,amp=e.mark,hp=e.hp;e.markTime=.04;r.updateEnemies(.1);
  near(hp-e.hp,dps*.04*(1+amp));near(e.mark,0);near(e.markDps,0);assert.equal(r.forceCrit,true);assert.equal(r.attackCounter,2);
});

test('hex works on a real boss, and echo refreshes rather than stacking its amp or DoT',()=>{
  for(const echo of [0,1]){
    const r=setup(['hex_brand'],[5]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+70;b.y=r.player.y;r.mods.echo=echo;
    r.castSlot(0);near(b.mark,.36*r.skillPotency(r.slots[0].def));near(b.markTime,7);
    const dps=b.markDps,hp=b.hp;r.updateEnemies(.5);near(hp-b.hp,dps*.5*(1+b.mark));
  }
});

test('healing purr immediately restores rank-defined player health and five-second HoT',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['healing_purr'],[rank]);r.hp=10;r.castSlot(0);const amount=r.stats.hpMax*(rank===1?.22:.28);
    near(r.hp,10+amount);assert.equal(r.player.buffs.filter(b=>b.id==='healing_purr_hot').length,rank>=3?1:0);
    const before=r.hp;r.updateBuffs(5);near(r.hp-before,rank>=3?amount:0);assert.equal(r.player.buffs.length,0);
  }
});

test('healing over time respects expiration even when the timestep overshoots',()=>{
  const r=setup(['healing_purr'],[3]);r.hp=10;r.castSlot(0);const amount=r.stats.hpMax*.28;const hp=r.hp;
  r.updateBuffs(2);near(r.hp-hp,amount*.4);const next=r.hp;r.updateBuffs(8);near(r.hp-next,amount*.6);
  assert.equal(r.player.buffs.length,0);const end=r.hp;r.updateBuffs(5);near(r.hp,end);
});

test('healing purr heals eligible summons only from rank four, capped at max HP',()=>{
  for(const rank of [3,4]){
    const r=setup(['healing_purr'],[rank]),a=minion(r,'lion',179,35),edge=minion(r,'spirit',180),far=minion(r,'kitten',181);
    const dead=minion(r,'lion',0,0),expired=minion(r,'lion',0,10,0),orb=minion(r,'orb',0);
    r.minions.push(a,edge,far,dead,expired,orb);r.castSlot(0);
    near(a.hp,rank===4?40:35);near(edge.hp,rank===4?21.2:10);near(far.hp,10);near(dead.hp,0);near(expired.hp,10);near(orb.hp,10);
  }
});

test('healing purr rank five removes slow, not roots, and cannot resurrect a downed player',()=>{
  for(const rank of [4,5]){
    const r=setup(['healing_purr'],[rank]);r.hp=10;r.playerSlow={amount:.5,time:4};r.playerRoot=3;r.castSlot(0);
    assert.equal(r.playerSlow===null,rank===5);near(r.playerRoot,3);
    const dead=setup(['healing_purr'],[rank]);dead.hp=0;dead.castSlot(0);dead.updateBuffs(5);near(dead.hp,0);
  }
});

test('healing coefficient affects immediate heal, HoT and summoned allies consistently',()=>{
  const r=setup(['healing_purr'],[4]);r.profile={settings:{skillScaleHealth:2}};r.hp=1;const a=minion(r,'lion',40,1);
  r.minions.push(a);r.castSlot(0);const amount=r.stats.hpMax*.28*2;near(r.hp,1+amount);near(a.hp,1+40*.28*2);
  const before=r.hp;r.updateBuffs(5);near(r.hp,Math.min(r.stats.hpMax,before+amount));
});

test('echo repeats immediate healing, but refreshes a single five-second HoT',()=>{
  const r=setup(['healing_purr'],[4]);r.mods.echo=1;r.hp=1;const ally=minion(r,'lion',40,1);r.minions.push(ally);
  r.castSlot(0);const amount=r.stats.hpMax*.28;near(r.hp,1+amount*2);near(ally.hp,1+40*.28*2);
  assert.equal(r.player.buffs.filter(b=>b.id==='healing_purr_hot').length,1);const hp=r.hp;r.updateBuffs(5);near(r.hp-hp,amount);
});

test('a later healing purr refreshes its HoT rather than stacking overlapping buffs',()=>{
  const r=setup(['healing_purr'],[3]);r.hp=1;r.castSlot(0);r.updateBuffs(2);const b=r.player.buffs[0];
  r.slots[0].charges=1;r.slots[0].cd=0;r.player.skillAction=null;r.castSlot(0);
  assert.equal(r.player.buffs.length,1);near(b.time,5);const hp=r.hp;r.updateBuffs(2);near(r.hp-hp,r.stats.hpMax*.28*2/5);
});

test('healing and hex act instantly, allow movement, queue skills, and refund queued energy on state change',()=>{
  for(const id of ['healing_purr','hex_brand']){
    const r=setup([id,'pounce']);r.hp=10;const e=enemy(r,60);const hp=r.hp;r.castSlot(0);
    if(id==='healing_purr')assert.ok(r.hp>hp);else assert.ok(e.mark>0);
    const after=r.energy;assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});assert.ok(r.player.x>x);
    r.setState(RUN_STATE.REWARD);near(r.energy,after);assert.equal(r.skillQueue.length,0);assert.equal(r.slots[1].charges,1);
  }
});

test('queued skill executes after the healing or mark follow-through',()=>{
  for(const id of ['healing_purr','hex_brand']){
    const r=setup([id,'claw_slash']);r.hp=10;const e=enemy(r,50);const casts=[];r.on('skill:cast',({id})=>casts.push(id));
    r.castSlot(0);r.castSlot(1);const hp=e.hp;tick(r,.4);assert.deepEqual(casts,[id,'claw_slash']);assert.ok(e.hp<hp);
  }
});
