import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { drawCat, drawCatFace } from '../src/art/catart.js';
import { CATS } from '../src/data/cats.js';
mkdirSync('public/art-check', { recursive: true });
const W=1740,H=1180, cv=createCanvas(W,H), ctx=cv.getContext('2d');
ctx.fillStyle='#0d1226'; ctx.fillRect(0,0,W,H);
const g=ctx.createRadialGradient(180,0,30,180,0,1000); g.addColorStop(0,'rgba(255,232,168,0.16)'); g.addColorStop(1,'rgba(13,18,38,0)');
ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
ctx.fillStyle='#1a2240'; ctx.fillRect(0,H-90,W,90);
const poses=[
 {label:'idle',pose:{}},
 {label:'walk',pose:{gait:.6,lean:.12}},
 {label:'run',pose:{gait:1,lean:.5,dash:.2}},
 {label:'attack',pose:{attack:1,lean:.3,mouth:.7}},
 {label:'cast',pose:{cast:1,headTilt:-.06,mouth:.5}},
 {label:'hurt',pose:{hurt:1,squash:.92,mouth:.9}},
];
CATS.forEach((cat,i)=>{
 const col=i%2,row=Math.floor(i/2);
 const cx=30+col*860, cy=40+row*228;
 drawCatFace(ctx,cat,cx+40,cy+52,54,{t:.5});
 ctx.fillStyle='#f4ecd8'; ctx.font='600 16px sans-serif'; ctx.fillText(cat.name.en,cx+80,cy+30);
 ctx.fillStyle='#7f8db4'; ctx.font='12px sans-serif';
 ctx.fillText(`${cat.look.fur} / ${cat.look.ear} / ${cat.look.tail} / body ${cat.look.body}`,cx+80,cy+48);
 poses.forEach((p,pi)=>{
  const px=cx+40+pi*136, py=cy+200;
  drawCat(ctx,cat,{t:.4+pi*.4,...p.pose},{x:px,y:py,scale:1.28,facing:1});
 });
});
writeFileSync('public/art-check/cats.png',cv.toBuffer('image/png'));
console.log('ok');
