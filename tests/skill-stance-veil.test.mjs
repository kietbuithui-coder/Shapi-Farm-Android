import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { ENEMY_BY_ID } from '../src/data/enemies.js';
import { drawPlayerActor } from '../src/art/actors.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:17});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=0;r.stats.crit=0;r.stats.dodge=0;r.stats.regen=0;r.stats.def=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function tick(r,s,input={}){for(let t=0;t+1e-9<s;t+=1/60)r.step(1/60,input);}
function dummy(r,dx=60){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function real(r,id,dx){const e=r.makeEnemy(ENEMY_BY_ID[id],{},{});e.x=r.player.x+dx;e.y=r.player.y;e.spawnT=2;e.attackCd=0;e.hp=e.hpMax=100000;r.enemies.push(e);return e;}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('stone stance rank two truly improves its armour over rank one',()=>{
  for(const [rank,armor] of [[1,.2],[2,.4],[3,.4],[4,.4],[5,.4]]){
    const r=setup(['stone_stance'],[rank]);r.castSlot(0);release(r);near(r.buffValue('armor'),armor*r.skillPotency(r.slots[0].def));
    const hp=r.hp;r.damagePlayer(20,null);near(hp-r.hp,20*(1-armor*r.skillPotency(r.slots[0].def)));
  }
});

test('stone stance rank three damages close enemies over time but does not trigger on-hit effects',()=>{
  for(const rank of [2,3]){
    const r=setup(['stone_stance'],[rank]),a=dummy(r,60),far=dummy(r,200);r.castSlot(0);release(r);r.attackCounter=0;
    const hp=a.hp;r.updateBuffs(.5);assert.equal(a.hp<hp,rank>=3);assert.equal(far.hp,far.hpMax);assert.equal(r.attackCounter,0);
    if(rank>=3)near(hp-a.hp,r.skillDamage(r.slots[0].def,.4)*.5);
  }
});

test('stone stance rank five heals only when stationary and not during movement or displacement',()=>{
  const r=setup(['stone_stance'],[5]);r.hp=40;r.castSlot(0);release(r);const amount=2*r.skillPotency(r.slots[0].def);
  r.updateBuffs(.5);near(r.hp,40+amount*.5);const hp=r.hp;
  r.player.moving=true;r.player.x+=10;r.updateBuffs(.5);near(r.hp,hp);
  r.player.moving=false;r.player.x+=10;r.updateBuffs(.5);near(r.hp,hp);
  r.updateBuffs(.5);near(r.hp,hp+amount*.5);
});

test('stone stance duration is rank dependent and echoed aura/heal does not stack',()=>{
  for(const dt of [1/60,.08]){
    const r=setup(['stone_stance'],[5]);r.mods.echo=1;r.hp=40;const e=dummy(r,50);r.castSlot(0);release(r);
    assert.equal(r.player.buffs.length,2);const start=e.hp, expected=r.skillDamage(r.slots[0].def,.4)*6;
    for(let t=0;t<7;t+=dt)r.updateBuffs(dt);
    near(start-e.hp,expected,1e-5);near(r.hp-40,2*r.skillPotency(r.slots[0].def)*6,1e-5);
    assert.equal(r.player.buffs.length,0);
  }
  const low=setup(['stone_stance'],[3]);low.castSlot(0);release(low);near(low.player.buffs[0].time,4);
});

test('veil hides from ordinary chasing and ranged enemies, then they resume after expiry',()=>{
  for(const id of ['grub','spitter','shadow_stalker']){
    const r=setup(['night_veil']);const e=real(r,id,100);r.castSlot(0);release(r);const x=e.x,y=e.y;
    r.updateEnemies(.5);near(e.x,x);near(e.y,y);assert.equal(r.projectiles.length,0);assert.equal(e.windupT||0,0);
    r.updateBuffs(2.1);assert.equal(r.isVeiled(),false);r.updateEnemies(.5);
    assert.ok(e.x!==x || e.y!==y || r.projectiles.length>0 || e.windupT>0,id);
  }
});

test('veiled player does not prevent lion taunt, and real bosses can still attack',()=>{
  const r=setup(['night_veil']);const e=real(r,'grub',80);const lion={kind:'lion',x:e.x-20,y:e.y,life:5,hp:100,maxHp:100,taunt:true};
  r.minions.push(lion);r.castSlot(0);release(r);r.updateEnemies(.2);r.updateEnemies(.2);assert.ok(lion.hp<100);assert.ok(r.isVeiled());
  const b=setup(['night_veil']);b.castSlot(0);release(b);b.spawnBoss('moon_devourer');b.boss.x=b.player.x+200;b.boss.y=b.player.y;b.boss.attackTimer=.01;
  let attacks=0;b.on('boss:attack',()=>attacks++);for(let i=0;i<20;i++)b.updateBosses(.1);
  assert.ok(attacks>0);assert.ok(b.isVeiled());
});

test('existing enemy hazards can still hit the veiled player',()=>{
  const r=setup(['night_veil']);r.castSlot(0);release(r);r.player.invuln=0;const hp=r.hp;
  r.hazards.push({kind:'nova',x:r.player.x,y:r.player.y,radius:90,delay:.01,t:0,damage:10,source:'enemy'});
  r.updateHazards(.1);assert.ok(r.hp<hp);assert.ok(r.isVeiled());
  r.player.invuln=0;const hp2=r.hp;
  r.spawnProjectile({x:r.player.x,y:r.player.y-20,angle:0,speed:1,damage:10,owner:'enemy'});
  r.updateProjectiles(.01);assert.ok(r.hp<hp2);assert.ok(r.isVeiled());
});

test('veil rank two guarantees the next eligible critical hit and rank five explodes once on reveal',()=>{
  for(const rank of [1,2,5]){
    const r=setup(['night_veil','claw_slash'],[rank,1]);const target=dummy(r,50),behind=dummy(r,-60),far=dummy(r,220);
    let hit,blasts=0;r.on('fx:hit',x=>{if(x.enemy===target&&x.source==='skill')hit=x;});r.on('fx:blast',()=>blasts++);
    r.castSlot(0);release(r);assert.ok(r.isVeiled());r.player.skillAction=null;r.rng._next=()=>.9;r.castSlot(1);
    assert.ok(hit);assert.equal(hit.crit,rank>=2);assert.equal(r.isVeiled(),false);
    assert.equal(blasts,rank===5?1:0);assert.equal(behind.hp<behind.hpMax,rank===5);assert.equal(far.hp,far.hpMax);
    r.updateBuffs(4);assert.equal(blasts,rank===5?1:0);
  }
});

test('rank five veil explodes on natural expiry only once, including echo and a surviving forced crit',()=>{
  const r=setup(['night_veil'],[5]);r.mods.echo=1;const e=dummy(r,50);let blasts=0;r.on('fx:blast',()=>blasts++);
  r.castSlot(0);release(r);assert.equal(r.player.buffs.filter(b=>b.stealth).length,1);
  r.updateBuffs(3.1);assert.equal(blasts,1);assert.ok(e.hp<e.hpMax);assert.equal(r.isVeiled(),false);assert.equal(r.forceCrit,true);
  r.updateBuffs(1);assert.equal(blasts,1);
});

test('veil is rendered visibly translucent on the real player actor',()=>{
  const r=setup(['night_veil']);r.player.x=100;r.player.y=130;
  function frame(){const c=createCanvas(200,180),ctx=c.getContext('2d');drawPlayerActor(ctx,r,1);return ctx.getImageData(0,0,200,180).data;}
  const before=frame();r.castSlot(0);release(r);const after=frame();let diff=0,alphaBefore=0,alphaAfter=0;
  for(let i=0;i<before.length;i+=4){if(before[i+3]!==after[i+3])diff++;alphaBefore+=before[i+3];alphaAfter+=after[i+3];}
  assert.ok(diff>300);assert.ok(alphaAfter<alphaBefore*.8);
});

test('stance and veil poses wind up while moving and buffer a follow-up',()=>{
  for(const id of ['stone_stance','night_veil']){
    const r=setup([id,'claw_slash']);dummy(r,60);const events=[];r.on('skill:cast',({id})=>events.push(id));
    r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});
    assert.ok(r.player.x>x);assert.equal(r.player.buffs.length,0);tick(r,.6);assert.deepEqual(events,[id,'claw_slash']);
  }
});

test('night veil rank three lasts three seconds and rank four improves actual move speed',()=>{
  for(const rank of [1,3,4]){
    const r=setup(['night_veil'],[rank]);r.castSlot(0);release(r);near(r.player.buffs[0].time,rank>=3?3:2);
    near(r.buffValue('move'),rank>=4?.2*r.skillPotency(r.slots[0].def):0);
  }
  function moved(rank){const r=setup(['night_veil'],[rank]);r.castSlot(0);release(r);const x=r.player.x;r.updatePlayer(.3,{moveX:1});return r.player.x-x;}
  assert.ok(moved(4)>moved(3));
});

test('knockback immunity applies to the boss-contact displacement path only while active',()=>{
  for(const [skill,rank,immune] of [['stone_stance',1,true],['wind_sprint',1,false],['wind_sprint',2,true]]){
    const r=setup([skill],[rank]);r.castSlot(0);release(r);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x-10;b.y=r.player.y;
    const x=r.player.x;r.enemyTouch(b);assert.equal(r.player.x===x,immune,skill+rank);
    r.player.invuln=0;r.updateBuffs(10);const x2=r.player.x;r.enemyTouch(b);assert.notEqual(r.player.x,x2);
  }
});

test('stone aura and veil explosion damage a real boss without disabling its brain',()=>{
  for(const id of ['stone_stance','night_veil']){
    const r=setup([id],[5]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+50;b.y=r.player.y;b.attackTimer=.01;
    r.castSlot(0);release(r);const hp=b.hp;r.updateBuffs(id==='night_veil'?3.1:.5);assert.ok(b.hp<hp,id);
    let attacks=0;r.on('boss:attack',()=>attacks++);for(let i=0;i<20;i++)r.updateBosses(.1);assert.ok(attacks>0,id);
  }
});
