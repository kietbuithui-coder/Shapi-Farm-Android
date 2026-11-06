import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { drawCat } from '../src/art/catart.js';
import { CATS } from '../src/data/cats.js';
const cv=createCanvas(1200,500), ctx=cv.getContext('2d');
ctx.fillStyle='#111730'; ctx.fillRect(0,0,1200,500);
const persian=CATS.find(c=>c.id==='persian');
const tabby=CATS.find(c=>c.id==='tabby');
drawCat(ctx,tabby,{t:.4},{x:180,y:430,scale:3.4});
drawCat(ctx,persian,{t:.4},{x:560,y:430,scale:3.4});
ctx.strokeStyle='#ff0066'; ctx.lineWidth=1;
for(let x=0;x<1200;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,500);ctx.stroke();}
for(let y=0;y<500;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
writeFileSync('public/art-check/zoom.png',cv.toBuffer('image/png'));
