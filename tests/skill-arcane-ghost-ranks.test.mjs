import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { drawMinion } from '../src/art/actors.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:69});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.stats.regen=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function enemy(r,dx=60,dy=0){const e=addTrainingDummy(r,dx);e.x=r.player.x+dx;e.y=r.player.y+dy;
  e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function align(r,m,e,dt=.01){m.angle=-2.4*dt;e.x=r.player.x+m.radius;e.y=r.player.y-12;}

test('arcane paw ranks change projectile damage, pierce, count and splash',()=>{
  let base;
  for(const rank of [1,2,3,4,5]){
    const r=setup(['arcane_paw'],[rank]);enemy(r,120);r.castSlot(0);
    assert.equal(r.projectiles.length,rank>=4?2:1);const p=r.projectiles[0];
    if(rank===1)base=p.damage;near(p.damage,base*(rank>=2?1.15:1));
    assert.equal(p.pierce,rank>=3?1:0);assert.equal(p.onHitBlast>0,rank>=5);near(p.homing,.06);
  }
});

test('arcane shots aim at diagonal hitboxes and face the target in both directions',()=>{
  for(const side of [-1,1])for(const dy of [-100,100]){
    const r=setup(['arcane_paw'],[1]),e=enemy(r,side*280,dy);r.player.facing=-side;r.castSlot(0);
    assert.equal(r.player.facing,side);for(let i=0;i<100&&r.projectiles.length;i++)r.updateProjectiles(1/60);
    assert.ok(e.hp<e.hpMax,`${side}, ${dy}`);
  }
});

test('piercing arcane projectile reacquires an unhit target instead of circling its first victim',()=>{
  for(const rank of [2,3]){
    const r=setup(['arcane_paw'],[rank]);const first=enemy(r,120),second=enemy(r,245,35);
    const hits=[];r.on('fx:hit',h=>{if(h.source==='skill')hits.push(h.enemy);});r.castSlot(0);
    for(let i=0;i<120&&r.projectiles.length;i++)r.updateProjectiles(1/60);
    assert.ok(first.hp<first.hpMax);assert.equal(second.hp<second.hpMax,rank===3);
    if(rank===3){assert.deepEqual(hits,[first,second]);assert.equal(new Set(hits).size,2);}
  }
});

test('arcane homing can redirect toward a moving living target without revisiting dead or hit targets',()=>{
  const r=setup(['arcane_paw'],[3]),a=enemy(r,120),b=enemy(r,250,20);r.castSlot(0);const pr=r.projectiles[0];
  for(let i=0;i<30&&!pr.hits.has(a.uid);i++)r.updateProjectiles(1/60);
  assert.ok(pr.hits.has(a.uid));a.dead=true;b.y+=20;
  for(let i=0;i<90&&r.projectiles.includes(pr);i++)r.updateProjectiles(1/60);
  assert.ok(b.hp<b.hpMax);assert.ok(pr.hits.has(b.uid));
});

test('arcane splash excludes the direct victim, keeps pierce, and does not trigger on-hit or crit',()=>{
  const r=setup(['arcane_paw'],[5]),a=enemy(r,100),other=enemy(r,100,35),far=enemy(r,100,160);
  r.castSlot(0);r.projectiles=[r.projectiles[0]];const pr=r.projectiles[0];r.forceCrit=true;const hits=[];
  r.on('fx:hit',x=>hits.push(x));for(let i=0;i<20&&!pr.hits.has(a.uid);i++)r.updateProjectiles(1/60);
  const direct=hits.filter(h=>h.enemy===a),splash=hits.filter(h=>h.enemy===other&&h.source==='blast');
  assert.equal(direct.length,1);assert.equal(direct[0].crit,true);assert.equal(splash.length,1);
  near(splash[0].amount,pr.damage*.5);assert.equal(far.hp,far.hpMax);assert.ok(r.projectiles.includes(pr));
  assert.equal(r.attackCounter,1);assert.equal(r.forceCrit,false);
});

test('arcane projectiles hit a real boss and continue to another target with pierce',()=>{
  const r=setup(['arcane_paw'],[3]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+90;b.y=r.player.y;
  const e=enemy(r,230,10),hp=b.hp;r.castSlot(0);for(let i=0;i<120&&r.projectiles.length;i++)r.updateProjectiles(1/60);
  assert.ok(b.hp<hp);assert.ok(e.hp<e.hpMax);
});

test('ghost paw ranks change orbit count, damage, radius, and bleed',()=>{
  let baseDamage,baseRadius;
  for(const rank of [1,2,3,4,5]){
    const r=setup(['ghost_paw'],[rank]);r.castSlot(0);assert.equal(r.minions.length,0);release(r);
    assert.equal(r.minions.length,rank>=2?3:2);const orb=r.minions[0];near(orb.time,5.5);
    if(rank===1){baseDamage=orb.damage;baseRadius=orb.radius;}
    near(orb.damage,baseDamage*(rank>=3?1.25:1));near(orb.radius,baseRadius*(rank>=4?1.25:1));
    assert.equal(orb.bleed,rank>=5);assert.ok(r.minions.every(x=>x.def.id==='ghost_paw'));
  }
});

test('each ghost paw applies orbit damage and rank-five bleed without player on-hit or forced crit',()=>{
  for(const rank of [4,5]){
    const r=setup(['ghost_paw'],[rank]),e=enemy(r);r.castSlot(0);release(r);const orb=r.minions[0];r.minions=[orb];
    align(r,orb,e);r.forceCrit=true;r.attackCounter=2;r.mods.everyThird=9;r.updateMinions(.01);
    near(e.hpMax-e.hp,orb.damage);assert.equal(e.bleedTime>0,rank===5);
    if(rank===5)near(e.bleed,orb.damage*.18);assert.equal(r.attackCounter,2);assert.equal(r.forceCrit,true);
  }
});

test('orbit per-target hit cooldown honours a hit at time zero and permits a later hit',()=>{
  const r=setup(['ghost_paw'],[1]),e=enemy(r);r.castSlot(0);release(r);const m=r.minions[0];r.minions=[m];r.time=0;
  align(r,m,e);r.updateMinions(.01);const hp=e.hp;align(r,m,e);r.updateMinions(.01);near(e.hp,hp);
  r.time=.54;align(r,m,e);r.updateMinions(.01);near(e.hp,hp);
  r.time=.56;align(r,m,e);r.updateMinions(.01);near(hp-e.hp,m.damage);
});

test('an expired orbit cannot hit, while a crossing timestep advances only its remaining life',()=>{
  const r=setup(['ghost_paw'],[1]),e=enemy(r);r.castSlot(0);release(r);const m=r.minions[0];r.minions=[m];
  m.time=0;align(r,m,e);const hp=e.hp;r.updateMinions(.08);near(e.hp,hp);assert.equal(r.minions.length,0);
  const x=setup(['ghost_paw'],[1]),target=enemy(x);x.castSlot(0);release(x);const orb=x.minions[0];x.minions=[orb];orb.time=.02;
  orb.angle=0;const angle=orb.angle;x.updateMinions(.08);near(orb.angle-angle,2.4*.02);assert.equal(x.minions.length,0);
});

test('ghost paw damage and bleed honour real boss orbit resistance',()=>{
  const r=setup(['ghost_paw'],[5]);r.spawnBoss('moon_devourer');const b=r.boss;r.castSlot(0);release(r);
  const m=r.minions[0];r.minions=[m];align(r,m,b);const hp=b.hp;r.updateMinions(.01);
  near(hp-b.hp,m.damage*.7);near(b.bleed,m.damage*.18*.7);const after=b.hp;r.updateEnemies(.5);near(after-b.hp,b.bleed*.5);
});

test('ghost paw visual is a paw rather than the generic orbit orb',()=>{
  function frame(id){const c=createCanvas(100,100);const ctx=c.getContext('2d');
    drawMinion(ctx,{kind:'orb',def:{id},x:50,y:50,tint:'#8fb0ff',radius:50},1);return ctx.getImageData(0,0,100,100).data;}
  const a=frame('ghost_paw'),b=frame('spirit_orbs');let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;
  assert.ok(diff>100);
});

test('arcane paw is immediate, ghost paw winds up, and both permit movement and queue follow-ups',()=>{
  for(const id of ['arcane_paw','ghost_paw']){
    const r=setup([id,'claw_slash']);enemy(r,80);const casts=[];r.on('skill:cast',({id})=>casts.push(id));r.castSlot(0);
    assert.equal(r.projectiles.length,id==='arcane_paw'?1:0);assert.equal(r.minions.length,0);
    assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});assert.ok(r.player.x>x);
    if(id==='ghost_paw')assert.equal(r.minions.length,0);tick(r,.55);assert.deepEqual(casts,[id,'claw_slash']);
  }
});

test('echoed ghost paws create independent orbits that each apply their own hit cooldown',()=>{
  const r=setup(['ghost_paw'],[5]),e=enemy(r);r.mods.echo=1;r.castSlot(0);release(r);assert.equal(r.minions.length,6);
  const [a,b]=[r.minions[0],r.minions[3]];r.minions=[a,b];align(r,a,e);align(r,b,e);r.updateMinions(.01);
  near(e.hpMax-e.hp,a.damage+b.damage);const hp=e.hp;align(r,a,e);align(r,b,e);r.updateMinions(.01);near(e.hp,hp);
});

test('echoed arcane paw produces independent rank-four projectiles without spending extra energy',()=>{
  const r=setup(['arcane_paw'],[4]);enemy(r,80);r.mods.echo=1;const energy=r.energy;r.castSlot(0);
  assert.equal(r.projectiles.length,4);near(r.energy,energy);assert.ok(r.projectiles.every(p=>p.pierce===1));
});
