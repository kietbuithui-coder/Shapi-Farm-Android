import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(cat,skills=['claw_slash']){const r=new Run({catId:cat,skills,seed:17});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=0;r.stats.crit=0;r.stats.def=0;r.stats.dodge=0;r.stats.regen=0;return r;}
function dummy(r,dx=50){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;return e;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);}

test('Black Cat full-health direct hit crits once, and does not buff ticks or secondary damage',()=>{
  const r=setup('black'),a=dummy(r),b=dummy(r,100),c=dummy(r,-100);let hit;
  r.on('fx:hit',e=>{if(e.enemy===a)hit=e;});
  r.hitEnemy(a,100,{source:'skill'});near(a.hpMax-a.hp,100*r.stats.critDmg);assert.equal(hit.crit,true);
  const hp=a.hp;r.hitEnemy(a,100,{source:'skill'});near(hp-a.hp,100);
  r.hitEnemy(b,100,{source:'skill',crit:true});near(b.hpMax-b.hp,100);
  r.hitEnemy(c,100,{source:'minion'});near(c.hpMax-c.hp,100);
  c.hp=c.hpMax;r.hitEnemy(c,100,{source:'skill',tick:true});near(c.hpMax-c.hp,100);
});

test('Siamese direct skill hits build capped attack speed and accelerate later skill cooldowns',()=>{
  const r=setup('siamese'),e=dummy(r);for(let i=0;i<15;i++)r.hitEnemy(e,1,{source:'skill'});
  near(r.player.comboFlow,.4);const s=r.slots[0];r.castSlot(0);const faster=s.rechargeDuration;
  r.updatePlayer(3.01,{});near(r.player.comboFlow,0);s.charges=1;s.cd=0;s.recharge=0;r.player.skillAction=null;
  // Keep this cast from hitting so it doesn't immediately restart the stack.
  e.x+=600;r.castSlot(0);const baseline=s.rechargeDuration;assert.ok(faster<baseline);
  r.hitEnemy(e,1,{source:'blast'});near(r.player.comboFlow,0);
});

test('Maine Coon gets stationary mitigation only near a living enemy',()=>{
  for(const [moving,nearby,expected] of [[false,true,17.6],[true,true,20],[false,false,20]]){
    const r=setup('mainecoon');const e=dummy(r,nearby?100:400);r.player.moving=moving;
    const hp=r.hp;r.damagePlayer(20,e);near(hp-r.hp,expected);
  }
});

test('British direct hits build capped timed armor, but secondary hits do not',()=>{
  const r=setup('british'),e=dummy(r);r.hitEnemy(e,1,{source:'minion'});assert.ok(!r.player.ironHideStacks);
  for(let i=0;i<15;i++)r.hitEnemy(e,1,{source:'skill'});assert.equal(r.player.ironHideStacks,10);
  let hp=r.hp;r.damagePlayer(20,e);near(hp-r.hp,16);
  r.player.invuln=0;r.updatePlayer(4.01,{});assert.equal(r.player.ironHideStacks,0);
  hp=r.hp;r.damagePlayer(20,e);near(hp-r.hp,20);
});

test('Bengal damage grows on the same target and resets on a new target or timeout',()=>{
  const r=setup('bengal'),a=dummy(r),b=dummy(r,100);
  let hp=a.hp;r.hitEnemy(a,100,{source:'skill'});near(hp-a.hp,100);
  hp=a.hp;r.hitEnemy(a,100,{source:'skill'});near(hp-a.hp,108);
  for(let i=0;i<8;i++)r.hitEnemy(a,1,{source:'skill'});
  hp=a.hp;r.hitEnemy(a,100,{source:'skill'});near(hp-a.hp,148);
  hp=b.hp;r.hitEnemy(b,100,{source:'skill'});near(hp-b.hp,100);
  r.updatePlayer(3.01,{});hp=b.hp;r.hitEnemy(b,100,{source:'skill'});near(hp-b.hp,100);
  r.hitEnemy(a,1,{source:'blast'});assert.equal(r.player.lastTarget,b.uid);
});

test('Ragdoll support casts mend only nearby living non-orb companions, with health capped',()=>{
  const r=setup('ragdoll',['healing_purr']);
  const ally=(dx,hp=50,extra={})=>({kind:'kitten',x:r.player.x+dx,y:r.player.y,life:10,hp,maxHp:100,...extra});
  const close=ally(50),almost=ally(80,99),far=ally(250),dead=ally(20,0),expired=ally(20,50,{life:0}),orb=ally(20,50,{kind:'orb'});
  r.minions.push(close,almost,far,dead,expired,orb);r.castSlot(0);
  near(close.hp,58);near(almost.hp,100);near(far.hp,50);near(dead.hp,0);near(expired.hp,50);near(orb.hp,50);
});

test('Black Cat critical passive is visible on an actual skill hit, without double critical multiplication',()=>{
  for(const crit of [0,1]) {
    const r=setup('black'),e=dummy(r);r.stats.crit=crit;let hit;
    r.rng.float=()=>.5;r.on('fx:hit',event=>{if(event.enemy===e)hit=event;});r.castSlot(0);
    assert.ok(hit?.crit);near(e.hpMax-e.hp,r.skillDamage(r.slots[0].def,1)*r.stats.critDmg);
  }
});

test('Ragdoll support echoes heal per execution, but cancelled wind-up does not heal',()=>{
  const r=setup('ragdoll',['healing_purr']);const friend={kind:'kitten',x:r.player.x,y:r.player.y,life:10,hp:50,maxHp:100};
  r.minions.push(friend);r.mods.echo=1;r.castSlot(0);near(friend.hp,66);
  const b=setup('ragdoll',['nine_lives']);const other={kind:'kitten',x:b.player.x,y:b.player.y,life:10,hp:50,maxHp:100};
  b.minions.push(other);b.castSlot(0);assert.ok(b.slotsTimeouts.length);b.setState(RUN_STATE.REWARD);b.setState(RUN_STATE.FIGHT);
  b.time+=1;b.updatePassiveEffects(0);near(other.hp,50);
});
