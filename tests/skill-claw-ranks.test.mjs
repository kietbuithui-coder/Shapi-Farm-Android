import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILL_ACTIONS, actionDuration } from '../src/systems/skill-animation.js';
import { addTrainingDummy } from './harness.mjs';

function setup(rank=1){const r=new Run({catId:'tabby',skills:['claw_slash'],seed:63});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.stats.regen=0;r.stats.energyRegen=0;r.slots[0].rank=rank;return r;}
function foe(r,dx,dy=0){const e=addTrainingDummy(r,dx);e.x=r.player.x+dx;e.y=r.player.y+dy;e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}

test('all claw ranks deliver one instant stroke with advertised damage scaling and rank-five bleed',()=>{
  const hits=[];
  for(const rank of [1,2,3,4,5]){
    const r=setup(rank),e=foe(r,60);let hitCount=0,strokes=0,hit;r.on('fx:hit',h=>{hitCount++;hit=h;});r.on('fx:slash',s=>strokes+=s.strokes);
    r.castSlot(0);assert.equal(hitCount,1);assert.equal(strokes,1);hits.push(hit.amount);
    assert.equal(e.bleedTime>0,rank===5);if(rank===5)near(e.bleed,r.skillDamage(r.slots[0].def,1.15*1.2)*.55);
  }
  near(hits[1]/hits[0],1.15);near(hits[2],hits[1]);near(hits[3]/hits[2],1.2);near(hits[4],hits[3]);
});

test('claw only hits targets in its facing cone and procs on-hit once per victim',()=>{
  for(const side of [-1,1]){
    const r=setup(),a=foe(r,side*40),b=foe(r,side*70,20),behind=foe(r,-side*60),wide=foe(r,side*40,65);
    r.mods.slowOnHit=.2;const hits=[];r.on('fx:hit',h=>hits.push(h.enemy));r.castSlot(0);
    assert.equal(r.player.facing,side);assert.deepEqual(new Set(hits),new Set([a,b]));assert.equal(r.attackCounter,2);
    assert.ok(a.slow>0&&b.slow>0);assert.equal(behind.slow,0);assert.equal(wide.slow,0);
  }
});

test('rank-three reach and skill-area perk apply once and match the slash effect radius',()=>{
  for(const [rank,area,x,hit] of [[2,0,110,false],[3,0,110,true],[1,.6,145,true],[1,.6,180,false]]){
    const r=setup(rank),e=foe(r,x);r.mods.skillArea=area;let slash;r.on('fx:slash',s=>slash=s);r.castSlot(0);
    assert.equal(e.hp<e.hpMax,hit);near(slash.radius,(rank>=3?100:86)*.85*(1+area));
  }
});

test('claw faces a reachable upgraded-range target even beyond generic aim-assist range',()=>{
  for(const side of [-1,1]){
    const r=setup(),e=foe(r,side*145);r.mods.skillArea=.6;r.player.facing=-side;r.castSlot(0);
    assert.equal(r.player.facing,side);assert.ok(e.hp<e.hpMax);
  }
});

test('rank-five bleed scales with attack and damage coefficient and cannot appear at zero power',()=>{
  let base;
  for(const scale of [0,1,2]){
    const r=setup(5),e=foe(r,60);r.profile={settings:{skillScaleDamage:scale}};r.castSlot(0);
    if(scale===0){near(e.bleed||0,0);near(e.bleedTime,0);near(e.hp,e.hpMax);}
    if(scale===1)base=e.bleed;if(scale===2)near(e.bleed,base*2);
  }
  const r=setup(5),e=foe(r,60);r.stats.atk*=2;r.castSlot(0);near(e.bleed,base*2);
});

test('claw bleed stops exactly when its three seconds end and does not crit or proc on-hit',()=>{
  const r=setup(5),e=foe(r,60);r.castSlot(0);const dps=e.bleed;r.forceCrit=true;r.attackCounter=2;r.mods.everyThird=5;
  e.bleedTime=.03;const hp=e.hp;r.updateEnemies(.08);near(hp-e.hp,dps*.03);near(e.bleedTime,0);
  assert.equal(r.attackCounter,2);assert.equal(r.forceCrit,true);const after=e.hp;r.updateEnemies(.08);near(e.hp,after);
});

test('echo and recasts repeat direct claw hits, but refresh rather than stack its bleed',()=>{
  const r=setup(5),e=foe(r,60);r.mods.echo=1;const hits=[];r.on('fx:hit',h=>hits.push(h));r.castSlot(0);
  assert.equal(hits.length,2);const bleed=e.bleed;r.updateEnemies(1);near(e.bleedTime,2);
  r.slots[0].cd=0;r.slots[0].charges=1;r.player.skillAction=null;r.castSlot(0);near(e.bleed,bleed);near(e.bleedTime,3);assert.equal(hits.length,4);
});

test('claw applies damage and bleeding on a real boss without consuming the next forced crit on ticks',()=>{
  const r=setup(5);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+50;b.y=r.player.y;const hp=b.hp;r.castSlot(0);
  assert.ok(b.hp<hp&&b.bleed>0);r.forceCrit=true;const after=b.hp;r.updateEnemies(.5);near(after-b.hp,b.bleed*.5);assert.equal(r.forceCrit,true);
});

test('claw maintains instant impact, unrestricted movement, buffering and resource refunds',()=>{
  const r=new Run({catId:'tabby',skills:['claw_slash','pounce'],seed:63});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.energyRegen=0;const e=foe(r,50);const hp=e.hp;
  r.castSlot(0);assert.ok(e.hp<hp);near(actionDuration(SKILL_ACTIONS.claw_slash),.1);
  const energy=r.energy;assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});assert.ok(r.player.x>x);
  r.setState(RUN_STATE.REWARD);near(r.energy,energy);assert.equal(r.slots[1].charges,1);assert.equal(r.skillQueue.length,0);
});

test('short claw pose does not throttle repeated taps at minimum cooldown',()=>{
  const r=setup(),e=foe(r,50);r.stats.atkSpeed=4;r.stats.cdr=.6;let count=0;r.on('skill:cast',()=>count++);
  for(let i=0;i<72;i++){r.castSlot(0);r.step(1/60,{});}
  assert.ok(count>=10,`only ${count} attacks in 1.2s`);assert.ok(e.hp<e.hpMax);near(r.slots[0].rechargeDuration,.1);
});
