import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { ENEMY_BY_ID } from '../src/data/enemies.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:91});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=0;r.stats.crit=0;r.stats.regen=0;r.stats.dodge=0;r.stats.def=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function dummy(r,dx=60){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function enemy(r,id,dx=50){const e=r.makeEnemy(ENEMY_BY_ID[id],{},{});e.x=r.player.x+dx;e.y=r.player.y;
  e.hp=e.hpMax=100000;e.dmg=20;e.spawnT=2;r.enemies.push(e);return e;}

test('reflective claws ranks apply reflected damage, duration, armor and splash correctly',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['reflective_claws'],[rank]),attacker=dummy(r,60),other=dummy(r,-60);r.castSlot(0);release(r);
    const potency=r.skillPotency(r.slots[0].def),reflect=(rank>=2?.55:.4)*potency,armor=(rank>=4?.2:0)*potency;
    near(r.buffValue('reflect'),reflect);near(r.buffValue('armor'),armor);near(r.player.buffs[0].time,rank>=3?6:4);
    const hp=r.hp;r.forceCrit=true;r.attackCounter=2;r.mods.everyThird=4;r.damagePlayer(20,attacker);
    const incoming=20*(1-armor);near(hp-r.hp,incoming);near(attacker.hpMax-attacker.hp,incoming*reflect);
    near(other.hpMax-other.hp,rank>=5?incoming*reflect*.5:0);assert.equal(r.attackCounter,2);assert.equal(r.forceCrit,true);
    r.player.invuln=0;r.updateBuffs(7);const ahp=attacker.hp;r.damagePlayer(20,attacker);near(attacker.hp,ahp);
  }
});

test('iron fur ranks reduce damage, reflect from rank three, extend duration and heal on nonlethal hits',()=>{
  for(const rank of [1,2,3,4,5]){
    const r=setup(['iron_fur'],[rank]),e=dummy(r);r.hp=40;r.castSlot(0);release(r);
    const potency=r.skillPotency(r.slots[0].def),armor=(rank>=2?.45:.35)*potency,reflect=rank>=3?.2*potency:0;
    near(r.buffValue('armor'),armor);near(r.buffValue('reflect'),reflect);near(r.player.buffs[0].time,rank>=4?8:5);
    r.player.shield=100;r.player.invuln=0;const shield=r.player.shield;r.damagePlayer(20,e);
    near(shield-r.player.shield,20*(1-armor));near(e.hpMax-e.hp,20*(1-armor)*reflect);
    near(r.hp,40+(rank>=5?potency:0));
    r.updateBuffs(9);near(r.buffValue('armor'),0);near(r.buffValue('reflect'),0);
  }
});

test('shield absorbs all or part of a hit without suppressing skill reflection or rank five splash',()=>{
  for(const shield of [0,3,100]){
    const r=setup(['reflective_claws'],[5]),attacker=dummy(r,60),other=dummy(r,-60);r.castSlot(0);release(r);
    r.player.shield=shield;const incoming=20*(1-r.buffValue('armor'));const hp=r.hp;r.damagePlayer(20,attacker);
    near(hp-r.hp,Math.max(0,incoming-shield));near(attacker.hpMax-attacker.hp,incoming*r.buffValue('reflect'));
    near(other.hpMax-other.hp,incoming*r.buffValue('reflect')*.5);
  }
});

test('real enemy projectiles return damage to their shooter without changing dodge rules',()=>{
  const r=setup(['reflective_claws'],[2]),shooter=enemy(r,'spitter',100);r.castSlot(0);release(r);
  r.stats.dodge=1;r.player.shield=100;r.enemyShoot(shooter);const pr=r.projectiles[0];assert.equal(pr.attacker,shooter);
  pr.x=r.player.x;pr.y=r.player.y-20;const hp=r.hp;r.updateProjectiles(.01);
  near(r.hp,hp);near(r.player.shield,80);near(shooter.hpMax-shooter.hp,20*r.buffValue('reflect'));
});

test('enemy telegraphs and patches reflect to their living creators and do not become dodgeable',()=>{
  for(const [id,method] of [['brute','enemySlam'],['warden','enemyShockwave'],['shadow_stalker','enemyBackstab'],['explosive_slime','enemyBurst'],['thorn_beast','enemyThorns']]){
    const r=setup(['reflective_claws'],[2]),e=enemy(r,id,30);r.castSlot(0);release(r);r.stats.dodge=1;
    r[method](e);assert.equal(r.hazards[0].attacker,e,id);const hp=r.hp,ehp=e.hp;r.updateHazards(1.5);
    assert.ok(r.hp<hp,id);near(ehp-e.hp,(hp-r.hp)*r.buffValue('reflect'));
  }
  const r=setup(['reflective_claws'],[2]),e=enemy(r,'crystal_crawler');r.castSlot(0);release(r);
  r.spawnHazardPatch(r.player.x,r.player.y,50,10,1,'#ffffff',e);const hp=r.hp,ehp=e.hp;r.updateZones(.1);
  near(ehp-e.hp,(hp-r.hp)*r.buffValue('reflect'));
});

test('real boss projectile, nova, beam and wall burst attribute the reflected damage to the boss',()=>{
  for(const attack of ['fanShot','telepounce','moonBeam','shatterWall','energyBeam']){
    const r=setup(['reflective_claws'],[2]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x-100;b.y=r.player.y;
    r.castSlot(0);release(r);r.player.invuln=0;
    if(attack==='shatterWall')r.zones.push({kind:'wall',x:r.player.x,y:r.player.y,radius:34,time:7,t:0,hp:20});
    r.runBossAttack(b,attack);const hp=r.hp,ehp=b.hp;
    if(attack==='fanShot'){
      const pr=r.projectiles[0];assert.equal(pr.attacker,b);r.projectiles=[pr];pr.x=r.player.x;pr.y=r.player.y-20;r.updateProjectiles(.01);
    }else{
      const hz=r.hazards[0];assert.equal(hz.attacker,b);r.hazards=[hz];
      if(hz.kind==='beam'){hz.x=r.player.x-60;hz.y=r.player.y-20;hz.angle=0;}
      r.updateHazards(2);
    }
    assert.ok(r.hp<hp,attack);near(ehp-b.hp,(hp-r.hp)*r.buffValue('reflect'));
  }
});

test('a dead or unknown attacker is never reflected onto an unrelated target',()=>{
  for(const dead of [true,false]){
    const r=setup(['reflective_claws'],[2]),e=enemy(r,'spitter'),other=dummy(r,-60);r.castSlot(0);release(r);
    r.enemyShoot(e);const p=r.projectiles[0];p.x=r.player.x;p.y=r.player.y-20;
    if(dead)e.dead=true;else p.attacker=null;
    const hp=r.hp;r.updateProjectiles(.01);assert.ok(r.hp<hp);near(e.hp,e.hpMax);near(other.hp,other.hpMax);
  }
});

test('reflection is prevented by invulnerability or a dodged contact, and echo cannot stack it',()=>{
  const r=setup(['reflective_claws'],[5]),e=dummy(r),other=dummy(r,-60);r.mods.echo=1;r.castSlot(0);release(r);
  assert.equal(r.player.buffs.length,2);near(r.buffValue('reflect'),.55*r.skillPotency(r.slots[0].def));
  r.player.invuln=1;const hp=r.hp;r.damagePlayer(20,e);near(r.hp,hp);near(e.hp,e.hpMax);near(other.hp,other.hpMax);
  r.player.invuln=0;r.stats.dodge=1;r.damagePlayer(20,e);near(r.hp,hp);near(e.hp,e.hpMax);near(other.hp,other.hpMax);
});

test('existing passive thorns keep health-loss semantics while skill reflection applies through shields',()=>{
  const r=setup(['iron_fur'],[3]),e=dummy(r);r.stats.thorns=.3;r.castSlot(0);release(r);r.player.shield=100;
  const incoming=20*(1-r.buffValue('armor'));r.damagePlayer(20,e);near(e.hpMax-e.hp,incoming*r.buffValue('reflect'));
  r.player.invuln=0;r.player.shield=0;const before=e.hp;r.damagePlayer(20,e);
  near(before-e.hp,incoming*(r.buffValue('reflect')+.3));
});

test('both new poses wind up while moving and buffer the next skill',()=>{
  for(const id of ['iron_fur','reflective_claws']){
    const r=setup([id,'claw_slash']);dummy(r);const casts=[];r.on('skill:cast',({id})=>casts.push(id));r.castSlot(0);
    assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});
    assert.ok(r.player.x>x);assert.equal(r.player.buffs.length,0);tick(r,.55);assert.deepEqual(casts,[id,'claw_slash']);
  }
});

test('rank five splash can retaliate to an unowned hazard without inventing a direct attacker',()=>{
  const r=setup(['reflective_claws'],[5]),a=dummy(r,40),b=dummy(r,-40);r.castSlot(0);release(r);
  const hp=r.hp;r.damagePlayer(20,null);const incoming=hp-r.hp;
  near(a.hpMax-a.hp,incoming*r.buffValue('reflect')*.5);near(b.hpMax-b.hp,incoming*r.buffValue('reflect')*.5);
});

test('mirror projectile redirection and defensive reflection compose without consuming a forced crit',()=>{
  const r=setup(['reflective_claws','mirror_paw'],[2,5]);const e=enemy(r,'spitter',80);r.castSlot(0);release(r);
  r.player.skillAction=null;r.castSlot(1);r.time+=.3;r.updatePassiveEffects(0);assert.ok(r.player.shield>20);
  r.forceCrit=true;r.attackCounter=0;r.enemyShoot(e);const pr=r.projectiles[0];pr.x=r.player.x;pr.y=r.player.y-20;
  r.updateProjectiles(.01);assert.equal(pr.owner,'player');assert.equal(pr.source,'reflect');
  near(e.hpMax-e.hp,20*r.buffValue('reflect'));assert.equal(r.forceCrit,true);assert.equal(r.attackCounter,0);
  for(let i=0;i<100&&r.projectiles.includes(pr);i++)r.updateProjectiles(1/60);
  assert.ok(e.hpMax-e.hp>20*r.buffValue('reflect'));assert.equal(r.forceCrit,true);assert.equal(r.attackCounter,0);
});

test('zero armor-scaling settings suppress defensive reflection without invalid values',()=>{
  const r=new Run({catId:'tabby',skills:['iron_fur'],profile:{settings:{skillScaleArmor:0}},seed:91});
  r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;r.stats.def=0;r.stats.dodge=0;const e=dummy(r);
  r.slots[0].rank=5;r.castSlot(0);release(r);assert.equal(r.buffValue('reflect'),0);assert.equal(r.buffValue('armor'),0);
  const hp=r.hp;r.damagePlayer(10,e);near(hp-r.hp,10);near(e.hp,e.hpMax);assert.ok(Number.isFinite(r.hp));
});
