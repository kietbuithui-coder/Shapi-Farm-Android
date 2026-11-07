import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom.mjs';
import { addTrainingDummy } from './harness.mjs';
import { createStorage } from '../src/core/save.js';

async function phone(width = 840, height = 380) {
  const b = await bootGame({ width, height });
  Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5, getGamepads: () => [], vibrate() {} }, configurable: true });
  b.game.resize();
  return b;
}
function touch(b, kind, x, y, id = 1) {
  b.dispatch(kind, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y });
}
function fight(b) {
  b.game.startRun({ catId: 'tabby', skills: ['claw_slash', 'healing_purr', 'pounce', 'arcane_paw'], seed: 118 });
  b.game.scene = 'run'; const r = b.game.run; r.state = 'fight'; r.waveEnemiesLeft = 999;
  r.player.x = 700; r.player.y = 380; r.player.invuln = 999; r.enemies.length = 0;
  const e = addTrainingDummy(r, 50); e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999;
  b.game.overlay = null; b.game.paused = false; b.game.draw(); return r;
}

test('phone draws only four touch skill buttons, never the additional desktop HUD skills', async () => {
  for (const [w, h] of [[840,380], [390,844], [1200,800]]) {
    const b = await phone(w,h); fight(b); let desktopSlots = 0, touchButtons = 0;
    const drawSlot = b.game.hud.drawSlot.bind(b.game.hud), drawTouch = b.game.touch.draw.bind(b.game.touch);
    b.game.hud.drawSlot = (...args) => { desktopSlots++; return drawSlot(...args); };
    b.game.touch.draw = (...args) => { touchButtons = b.game.touch.buttons.length; return drawTouch(...args); };
    b.game.draw(); assert.equal(desktopSlots,0,`${w}x${h}`); assert.equal(touchButtons,4);
    assert.ok(b.game.mobile); assert.equal(b.game.hitRects.filter(x => x.id?.startsWith('skill')).length,0);
    b.game.togglePause(true);b.game.draw();assert.equal(desktopSlots,0,'pause must not reveal a second skill row');
  }
});

test('touch on the home menu is not swallowed by invisible run controls', async () => {
  const b = await phone(); b.draw();
  const play = b.rects().find(x => x.id === 'play'); assert.ok(play);
  touch(b,'pointerdown',play.x+play.w/2,play.y+play.h/2); touch(b,'pointerup',play.x+play.w/2,play.y+play.h/2);
  assert.equal(b.game.input.touch.active,false); assert.equal(b.game.pending?.next,'run');
});

test('all four phone buttons trigger the intended skills, including while another finger steers', async () => {
  const b = await phone(); const r = fight(b);const casts=[];r.on('skill:cast',({slot})=>casts.push(slot));
  const s=b.game.touch.stick;touch(b,'pointerdown',s.cx,s.cy,1);touch(b,'pointermove',s.cx+30,s.cy,1);
  assert.ok(b.game.input.touch.active); assert.ok(b.game.input.touch.nx>0);
  for(let i=0;i<4;i++) {
    r.energy=r.stats.energyMax; r.player.invuln=999;
    const button=b.game.touch.buttons[i],x=button.x+button.w/2,y=button.y+button.h/2;
    touch(b,'pointerdown',x,y,i+2);touch(b,'pointerup',x,y,i+2);b.step(35);
    assert.ok(casts.includes(i),`slot ${i} did not cast`);assert.equal(b.game.input.touch.id,1);
  }
  touch(b,'pointerup',s.cx+30,s.cy,1);assert.equal(b.game.input.touch.active,false);
});

test('left-handed movement works on the right, skill presses do not hijack it', async () => {
  const b=await phone();fight(b);b.game.touch.configure({leftHanded:true});b.game.touch.layout(b.game.w,b.game.h,b.game.safe,b.game.run);
  const s=b.game.touch.stick;touch(b,'pointerdown',s.cx,s.cy,20);touch(b,'pointermove',s.cx-35,s.cy,20);
  assert.equal(b.game.input.touch.id,20);assert.ok(b.game.input.touch.nx<0);
  const k=b.game.touch.buttons[0],x=k.x+k.w/2,y=k.y+k.h/2;touch(b,'pointerdown',x,y,21);
  assert.equal(b.game.input.touch.id,20);touch(b,'pointerup',x,y,21);touch(b,'pointercancel',s.cx,s.cy,20);
  assert.equal(b.game.input.touch.active,false);
});

test('pause and reward overlays receive taps rather than the hidden skill pad', async () => {
  const b=await phone(390,844);const r=fight(b);b.game.togglePause(true);b.game.draw();
  const resume=b.game.hitRects.find(x=>x.id==='resume');assert.ok(resume);
  touch(b,'pointerdown',resume.x+resume.w/2,resume.y+resume.h/2);touch(b,'pointerup',resume.x+resume.w/2,resume.y+resume.h/2);
  assert.equal(b.game.paused,false);r.state='levelup';r.offers=[{type:'heal'}];b.game.offers=r.offers;b.game.overlay='levelup';b.game.draw();
  const offer=b.game.hitRects.find(x=>x.id==='offer:0');assert.ok(offer);let picked=-1;b.game.pickOffer=i=>{picked=i;};
  touch(b,'pointerdown',offer.x+offer.w/2,offer.y+offer.h/2);assert.equal(picked,0);
  assert.equal(b.game.input.touch.active,false);
});

test('pause, cancellation and rotation clear a held movement pointer', async () => {
  const b=await phone();fight(b);const s=b.game.touch.stick;
  touch(b,'pointerdown',s.cx,s.cy);touch(b,'pointermove',s.cx+40,s.cy);assert.ok(b.game.input.touch.mag>0);
  b.game.togglePause(true);assert.equal(b.game.input.touch.active,false);b.game.togglePause(false);
  touch(b,'pointerdown',s.cx,s.cy);assert.equal(b.game.input.touch.active,true);
  globalThis.innerWidth=390;globalThis.innerHeight=844;b.game.resize();assert.equal(b.game.input.touch.active,false);
  assert.equal(b.game.w,390);assert.equal(b.game.h,844);assert.equal(b.game.run.state,'fight');
});

test('real world transform keeps the cat visible away from skill buttons at screen edges and high DPI', async () => {
  for(const [w,h,dpr] of [[840,380,1],[840,380,2],[390,844,1],[390,844,2]]) {
    const b=await phone(w,h);globalThis.devicePixelRatio=dpr;b.game.resize();const r=fight(b);r.stats.regen=0;
    for(const [x,y] of [[96,250],[1474,250],[96,506],[1474,506],[785,380]]) {
      r.player.x=x;r.player.y=y;r.player.invuln=999;b.game.camera.snapNext=true;b.step(1);
      const point=b.game.renderer.worldToScreen(x,y),size=b.game.touch.size;
      assert.ok(point.x>=0&&point.x<=w&&point.y>=0&&point.y<=h,`${w}x${h}@${dpr} ${x},${y} -> ${JSON.stringify(point)}`);
      for(const button of b.game.touch.buttons){const dx=point.x-(button.x+size/2),dy=point.y-(button.y+size/2);
        assert.ok(Math.hypot(dx,dy)>size/2+8,`${w}x${h}@${dpr} player behind skill control`);}
    }
  }
});

test('safe-area probe reaches the mobile layout and storage failure retains in-session changes', async () => {
  const b=await phone(390,844);const old=globalThis.getComputedStyle;
  globalThis.document.getElementById=id=>id==='safe-area'?{}:null;
  globalThis.getComputedStyle=()=>({paddingTop:'30px',paddingRight:'12px',paddingBottom:'20px',paddingLeft:'14px'});
  b.game.resize();assert.deepEqual(b.game.safe,{top:30,right:12,bottom:20,left:14});
  assert.ok(b.game.touch.buttons.every(x=>x.y+x.h<=824));globalThis.getComputedStyle=old;
  const previous=globalThis.localStorage;const items=new Map();let blocked=false;
  globalThis.localStorage={setItem(k,v){if(blocked)throw Error('blocked');items.set(k,v);},getItem(k){if(blocked)throw Error('blocked');return items.get(k)??null;},removeItem(k){items.delete(k);}};
  try {const store=createStorage();assert.equal(store.persistent,true);blocked=true;assert.equal(store.write('x','value'),false);assert.equal(store.persistent,false);assert.equal(store.read('x'),'value');}
  finally {globalThis.localStorage=previous;}
});

test('separate dodge button works while steering and respects cooldown and energy', async () => {
  const b=await phone(),r=fight(b),s=b.game.touch.stick,d=b.game.touch.dodgeRect;let dodges=0;r.on('player:dash',()=>dodges++);
  touch(b,'pointerdown',s.cx,s.cy,1);touch(b,'pointermove',s.cx+30,s.cy,1);
  const x=d.x+d.w/2,y=d.y+d.h/2;touch(b,'pointerdown',x,y,2);touch(b,'pointerup',x,y,2);b.step(2);
  assert.equal(dodges,1);assert.ok(r.player.invuln>0);assert.equal(b.game.input.touch.id,1);
  touch(b,'pointerdown',x,y,2);touch(b,'pointerup',x,y,2);b.step(1);assert.equal(dodges,1,'cooldown prevents a second dodge');
  r.player.dashCd=0;r.energy=0;touch(b,'pointerdown',x,y,2);touch(b,'pointerup',x,y,2);b.step(1);assert.equal(dodges,1,'no energy prevents dodge');
  touch(b,'pointerup',s.cx,s.cy,1);
});

test('dodge target stays in the viewport and clear of the four skill targets', async () => {
  for(const [w,h] of [[320,568],[390,844],[780,360],[915,412],[1024,768]])for(const left of [false,true]){
    const b=await phone(w,h);fight(b);b.game.touch.configure({leftHanded:left});b.game.touch.layout(w,h,b.game.safe,b.game.run);
    const d=b.game.touch.dodgeRect;assert.ok(d.x>=0&&d.y>=0&&d.x+d.w<=w&&d.y+d.h<=h);
    for(const s of b.game.touch.buttons){const dist=Math.hypot(d.x+d.w/2-s.x-s.w/2,d.y+d.h/2-s.y-s.h/2);
      assert.ok(dist>(d.w+s.w)/2,`${w}x${h} overlapping dodge and skill`);}
    assert.equal(b.game.touch.hitTest(d.x+d.w/2,d.y+d.h/2).kind,'dodge');
  }
});

test('portrait home menu offers readable, separately clickable secondary tiles', async () => {
  for(const [w,h] of [[320,568],[390,844],[412,915]]){
    const b=await phone(w,h);b.draw();const tiles=b.rects().filter(r=>['cats','skills','upgrades','collection','codex','settings'].includes(r.id));
    assert.equal(tiles.length,6);for(const t of tiles){assert.ok(t.w>=72,`${w} ${t.id} width ${t.w}`);
      assert.ok(t.x>=0&&t.x+t.w<=w&&t.y>=0&&t.y+t.h<=h,`${t.id} outside viewport`);}
  }
});

test('one-shot dodge waits for a fixed simulation step at 120 Hz', async () => {
  const b=await phone(),r=fight(b);let count=0;r.on('player:dash',()=>count++);
  b.game.acc=0;b.game.input.pressed.dodge=true;b.game.tick(1/120);
  assert.equal(count,0);assert.equal(b.game.pendingDodge,true);
  b.game.tick(1/120);assert.equal(count,1);assert.equal(b.game.pendingDodge,false);
});

test('portrait cat selection and level-up choices stay separate and within the viewport', async () => {
  for(const [w,h] of [[320,568],[390,844]]){
    const b=await phone(w,h);b.game.scene='cats';b.game.draw();
    const cats=b.rects().filter(r=>r.id.startsWith('cat:'));assert.equal(cats.length,10);
    for(const r of [...cats,...b.rects().filter(r=>['equip','start','back'].includes(r.id))]){
      assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=w&&r.y+r.h<=h,`${r.id} outside viewport`);
    }
    const run=fight(b);run.state='levelup';run.offers=['claw_slash','fireball','pounce'].map(skillId=>({type:'skillup',skillId,rank:2}));
    b.game.offers=run.offers;b.game.overlay='levelup';b.game.draw();const cards=b.rects().filter(r=>r.id.startsWith('offer:'));
    assert.equal(cards.length,3);for(let i=0;i<cards.length;i++){
      const r=cards[i];assert.ok(r.w>=w-60&&r.y>=0&&r.y+r.h<=h);if(i)assert.ok(cards[i-1].y+cards[i-1].h<=r.y);
    }
  }
});

test('when storage is unavailable home still renders its session-only warning', async () => {
  const b=await phone();const original=b.game.store.storage;
  b.game.store.storage={persistent:false,read:()=>null,write:()=>false,remove(){}};
  assert.doesNotThrow(()=>b.game.draw());b.game.store.storage=original;
});

test('AUTO no longer covers the movement stick or left-handed skills', async () => {
  for(const [w,h] of [[320,568],[390,844],[840,380]])for(const left of [false,true]){
    const b=await phone(w,h);fight(b);b.game.touch.configure({leftHanded:left});b.game.draw();
    const auto=b.game.hitRects.find(x=>x.id==='bot'),s=b.game.touch.stick;assert.ok(auto);
    assert.ok(auto.y+auto.h < s.cy-s.r,`${w}x${h} auto overlaps stick`);
    for(const button of b.game.touch.buttons)assert.ok(auto.y+auto.h<button.y,`${w}x${h} auto overlaps skills`);
    touch(b,'pointerdown',s.cx,s.cy);assert.ok(b.game.input.touch.active);assert.equal(b.game.botMode,false);
  }
});

test('portrait reward choices are large, separate and reachable',async()=>{
  for(const [w,h] of [[320,568],[390,844]]){
    const b=await phone(w,h),r=fight(b);r.state='reward';b.game.overlay='reward';
    b.game.rewards=[1,2,3].map(i=>({label:{vi:`Thưởng ${i}`,en:`Reward ${i}`},icon:'star'}));b.game.draw();
    const choices=b.game.hitRects.filter(v=>v.id.startsWith('reward:'));assert.equal(choices.length,3);
    for(let i=0;i<choices.length;i++){const c=choices[i];assert.ok(c.w>=w-60&&c.y>=0&&c.y+c.h<=h);if(i)assert.ok(choices[i-1].y+choices[i-1].h<c.y);}
    let chosen=-1;r.chooseReward=i=>{chosen=i;};const a=choices[1];touch(b,'pointerdown',a.x+a.w/2,a.y+a.h/2);assert.equal(chosen,1);
  }
});

test('camera framing remains usable across view-distance settings and rotation', async () => {
  const b=await phone(840,380),r=fight(b);r.player.invuln=999;
  for(const [w,h] of [[840,380],[390,844],[840,380]]){
    globalThis.innerWidth=w;globalThis.innerHeight=h;b.game.resize();
    for(const distance of [1,1.5,2]){
      b.game.camera.viewDistance=distance;
      for(const [x,y] of [[96,250],[1474,506]]){
        r.player.x=x;r.player.y=y;b.game.camera.snapNext=true;b.step(2);
        const p=b.game.renderer.worldToScreen(x,y);assert.ok(p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h,`${w}x${h} view ${distance}: ${JSON.stringify(p)}`);
        for(const k of b.game.touch.buttons)assert.ok(Math.hypot(p.x-k.x-k.w/2,p.y-k.y-k.h/2)>k.w/2+8,'cat hidden by skill button');
      }
    }
  }
});
