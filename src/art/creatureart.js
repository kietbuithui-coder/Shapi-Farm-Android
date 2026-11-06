// Creature art: every enemy shape in the same ink-and-wash language as the cats
// (2px ink outline, three flat tones, moon rim light) but with its own anatomy.
//
// Each `shape` is drawn facing right around the origin at the feet, like the cats.

import { TAU, clamp, lerp, smooth, shade, rgbCss } from '../core/math.js';
import { hex } from './catart.js';

const INK = '#0a0812';
const RIM = (a) => `rgba(255,240,203,${a})`;

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU);
}
function ink(ctx, fill, lw = 2.1) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); }
}
function eye(ctx, x, y, r, color, pupil = 'slit', look = 0) {
  ell(ctx, x, y, r, r * 0.92);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(6,4,10,0.9)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  if (pupil === 'slit') {
    ell(ctx, x + look * r * 0.2, y, r * 0.3, r * 0.72);
  } else {
    ell(ctx, x + look * r * 0.24, y, r * 0.46, r * 0.5);
  }
  ctx.fillStyle = '#07040c';
  ctx.fill();
  ell(ctx, x - r * 0.3, y - r * 0.34, r * 0.24, r * 0.24);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
}

function body(ctx, x, y, rx, ry, base, rot = 0) {
  ell(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = rgbCss(base);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.save();
  ell(ctx, x, y, rx, ry, rot);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.5, y + ry * 0.36, rx * 0.9, ry * 0.85, rot - 0.3, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, -0.24), 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.45, y - ry * 0.5, rx * 0.66, ry * 0.44, -0.5, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, 0.22), 0.4);
  ctx.fill();
  ctx.restore();
}

/* ── individual creatures ─────────────────────────────────────────────────── */

function grub(ctx, c, p, s) {
  const base = hex(c.color), dark = hex(c.color2);
  const seg = 4;
  for (let i = seg - 1; i >= 0; i--) {
    const t = i / seg;
    const x = -14 * s * (t * 1.5) + Math.sin(p.t * 4 + i * 0.9) * 1.6 * s;
    const y = -9 * s - (1 - t) * 3 * s - Math.abs(Math.sin(p.t * 5 + i)) * 0.8 * s;
    body(ctx, x, y, (8.5 - t * 2.4) * s, (7.4 - t * 1.9) * s, shade(base, t * 0.12), 0);
  }
  // head
  body(ctx, 8 * s, -11 * s, 8.4 * s, 8 * s, base, 0.1);
  // mandibles
  ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(13 * s, -10 * s + k * 2.2 * s);
    ctx.quadraticCurveTo(19 * s, -9 * s + k * 3.4 * s, 18 * s, -6 * s + k * 2.4 * s);
    ctx.stroke();
  }
  eye(ctx, 11.4 * s, -13.4 * s, 2.5 * s, c.eye, 'round', 0.5);
  // segment ridges
  ctx.strokeStyle = rgbCss(shade(dark, 0.1), 0.7);
  ctx.lineWidth = 1.3;
  for (let i = 1; i < seg; i++) {
    const x = -14 * s * ((i / seg) * 1.5);
    ctx.beginPath();
    ctx.moveTo(x, -14 * s);
    ctx.quadraticCurveTo(x + 2 * s, -9 * s, x - 1 * s, -3 * s);
    ctx.stroke();
  }
}

function rat(ctx, c, p, s) {
  const base = hex(c.color);
  // tail
  ctx.beginPath();
  ctx.moveTo(-9 * s, -7 * s);
  ctx.quadraticCurveTo(-24 * s, -9 * s + Math.sin(p.t * 7) * 3 * s, -30 * s, -16 * s + Math.sin(p.t * 7) * 3 * s);
  ctx.strokeStyle = rgbCss(shade(base, -0.4));
  ctx.lineWidth = 2.2 * s;
  ctx.lineCap = 'round';
  ctx.stroke();
  body(ctx, -2 * s, -8 * s, 10.5 * s, 7 * s, base, 0.12);
  // head wedge
  ctx.beginPath();
  ctx.moveTo(4 * s, -13 * s);
  ctx.quadraticCurveTo(15 * s, -13 * s, 17 * s, -8 * s);
  ctx.quadraticCurveTo(15 * s, -3 * s, 5 * s, -4 * s);
  ctx.closePath();
  ink(ctx, rgbCss(shade(base, 0.06)), 2);
  // ears
  for (const k of [0, 1]) {
    ell(ctx, (5 + k * 4) * s, -14.5 * s, 3.4 * s, 3.2 * s);
    ink(ctx, rgbCss(shade(base, -0.18)), 1.7);
  }
  eye(ctx, 13 * s, -9.6 * s, 2.1 * s, c.eye, 'round', 0.7);
  // snout + teeth
  ell(ctx, 17.5 * s, -7.4 * s, 2.4 * s, 1.9 * s);
  ctx.fillStyle = 'rgba(20,10,14,0.9)';
  ctx.fill();
  ctx.fillStyle = '#fff6e6';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(17 * s, -6.4 * s);
    ctx.lineTo(18.4 * s, -6.4 * s);
    ctx.lineTo(17.6 * s, -4.4 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function golem(ctx, c, p, s) {
  const base = hex(c.color);
  const bob = Math.sin(p.t * 1.6) * 1.4 * s;
  body(ctx, 0, -16 * s + bob, 15 * s, 14 * s, base, 0);
  // shoulders / fists
  for (const k of [-1, 1]) {
    const swing = Math.sin(p.t * 2 + (k > 0 ? 0 : 1.6)) * 2.4 * s;
    body(ctx, (k * 15) * s, (-10 + swing * 0.3 / s) * s, 6.6 * s, 6.2 * s, shade(base, -0.14), 0);
    ell(ctx, k * 16 * s, (-2 + swing * 0.2 / s) * s, 5.4 * s, 4.6 * s);
    ink(ctx, rgbCss(shade(base, -0.24)), 1.9);
  }
  // rocky facets
  ctx.strokeStyle = rgbCss(shade(base, -0.44), 0.8);
  ctx.lineWidth = 1.6 * s;
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 4 * s, -24 * s + Math.sin(a) * 3 * s);
    ctx.lineTo(Math.cos(a) * 12 * s, -10 * s + Math.sin(a) * 8 * s);
    ctx.stroke();
  }
  // head plate
  body(ctx, 1 * s, -30 * s + bob, 8.6 * s, 6.6 * s, shade(base, 0.1), 0);
  for (const k of [-1, 1]) eye(ctx, (1 + k * 3.4) * s, -30.5 * s + bob, 1.9 * s, c.eye, 'round', 0);
  // moss
  ctx.fillStyle = 'rgba(120,200,140,0.5)';
  for (let i = 0; i < 5; i++) {
    ell(ctx, (-10 + i * 5) * s, -27 * s + Math.sin(i * 2.1) * 2 * s + bob, 2.6 * s, 1.5 * s, i * 0.4);
    ctx.fill();
  }
}

function spitter(ctx, c, p, s) {
  const base = hex(c.color);
  const breathe = Math.sin(p.t * 2.4) * 1.2 * s;
  // legs
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.lineTo(k * 12 * s, -1.4 * s);
    ctx.stroke();
  }
  body(ctx, 0, -17 * s + breathe, 13 * s, 9.6 * s, base, 0);
  // back spikes
  ctx.fillStyle = rgbCss(shade(base, 0.24));
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((-9 + i * 5) * s, -25 * s + breathe);
    ctx.lineTo((-7 + i * 5) * s, -31 * s - i * 1.2 * s + breathe);
    ctx.lineTo((-4.5 + i * 5) * s, -24 * s + breathe);
    ctx.closePath();
    ink(ctx, rgbCss(shade(base, 0.3)), 1.4);
  }
  // head tower
  body(ctx, 6 * s, -25 * s + breathe, 7.6 * s, 6.4 * s, shade(base, 0.06), -0.15);
  // throat sac
  ell(ctx, 9 * s, -20.5 * s + breathe, 4.6 * s + breathe * 0.4, 4 * s);
  ink(ctx, rgbCss(shade(c.color2, 0.24), 0.9), 1.7);
  eye(ctx, 9.5 * s, -27 * s + breathe, 2.4 * s, c.eye, 'slit', 0.4);
  // drool
  ctx.strokeStyle = 'rgba(200,255,160,0.6)';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(11 * s, -18 * s + breathe);
  ctx.lineTo(11.6 * s, -14 * s + breathe + Math.sin(p.t * 3) * 1.2 * s);
  ctx.stroke();
}

function wisp(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 2.2) * 2.4 * s;
  // trailing wisps
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (let i = 3; i >= 1; i--) {
    ell(ctx, -i * 4.6 * s + Math.sin(p.t * 3 + i) * 1.6 * s, -12 * s + float + i * 1.6 * s, (6 - i) * s + 2 * s, (5 - i) * s + 2 * s);
    ctx.fillStyle = rgbCss(shade(base, -0.1 * i), 0.55);
    ctx.fill();
  }
  ctx.restore();
  ell(ctx, 0, -14 * s + float, 8.4 * s, 8.4 * s);
  const g = ctx.createRadialGradient(-2 * s, -17 * s + float, 1, 0, -14 * s + float, 9 * s);
  g.addColorStop(0, rgbCss(shade(base, 0.4)));
  g.addColorStop(1, rgbCss(shade(base, -0.2)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.9;
  ctx.stroke();
  for (const k of [-1, 1]) eye(ctx, k * 3.1 * s, -15 * s + float, 1.8 * s, c.eye, 'round', 0);
  // little mask markings
  ctx.strokeStyle = rgbCss(shade(base, -0.5), 0.6);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-5 * s, -10.5 * s + float);
  ctx.quadraticCurveTo(0, -8 * s + float, 5 * s, -10.5 * s + float);
  ctx.stroke();
}

function frog(ctx, c, p, s) {
  const base = hex(c.color);
  const crouch = p.crouchOut || 0;
  // back legs
  for (const k of [-1, 1]) {
    ctx.save();
    ctx.translate(k * 8 * s, -7 * s);
    ctx.rotate(k * (0.5 + crouch * 0.6));
    ell(ctx, 0, 2 * s, 7 * s, 3.4 * s);
    ink(ctx, rgbCss(shade(base, -0.16)), 1.9);
    ctx.restore();
  }
  body(ctx, 0, -9 * s + crouch * 2.4 * s, 11.5 * s, 7.4 * s - crouch * 1.6 * s, base, 0);
  // eyes on top
  for (const k of [-1, 1]) {
    ell(ctx, k * 4.6 * s, -16.6 * s + crouch * 2 * s, 3.8 * s, 3.6 * s);
    ink(ctx, rgbCss(shade(base, 0.12)), 1.8);
    eye(ctx, k * 4.6 * s, -17 * s + crouch * 2 * s, 2.4 * s, c.eye, 'slit', 0);
  }
  // mouth line
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-7 * s, -7.6 * s);
  ctx.quadraticCurveTo(0, -4.6 * s, 7 * s, -7.6 * s);
  ctx.stroke();
  // spots
  ctx.fillStyle = rgbCss(shade(c.color2, -0.05), 0.7);
  for (let i = 0; i < 4; i++) {
    ell(ctx, (-6 + i * 4) * s, (-13 + (i % 2) * 3) * s, 1.7 * s, 1.3 * s, i);
    ctx.fill();
  }
}

function mushroom(ctx, c, p, s) {
  const base = hex(c.color);
  const pulse = 1 + Math.sin(p.t * (3 + (p.excite || 0) * 12)) * 0.06;
  // stem
  ctx.beginPath();
  ctx.moveTo(-4.4 * s, 0);
  ctx.quadraticCurveTo(-3.2 * s, -10 * s, -2.4 * s, -13 * s);
  ctx.lineTo(2.4 * s, -13 * s);
  ctx.quadraticCurveTo(3.4 * s, -10 * s, 4.4 * s, 0);
  ctx.closePath();
  ink(ctx, rgbCss(shade(c.color3 || '#f4e6c8', -0.1)), 2);
  // cap
  ctx.beginPath();
  ctx.ellipse(0, -15 * s, 13 * s * pulse, 9.4 * s * pulse, 0, Math.PI, TAU);
  ctx.quadraticCurveTo(8 * s, -11 * s, 0, -10.6 * s);
  ctx.quadraticCurveTo(-8 * s, -11 * s, -13 * s * pulse, -15 * s);
  ctx.closePath();
  const g = ctx.createRadialGradient(-3 * s, -21 * s, 1, 0, -15 * s, 14 * s);
  g.addColorStop(0, rgbCss(shade(base, 0.34)));
  g.addColorStop(1, rgbCss(shade(base, -0.28)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.1;
  ctx.stroke();
  // spots
  ctx.fillStyle = 'rgba(255,246,230,0.88)';
  for (let i = 0; i < 4; i++) {
    ell(ctx, (-7 + i * 4.8) * s, (-19 - (i % 2) * 3) * s, 2.2 * s * pulse, 1.8 * s * pulse, i * 0.6);
    ctx.fill();
  }
  // eyes + fuse glow
  for (const k of [-1, 1]) eye(ctx, k * 2.6 * s, -12.4 * s, 1.7 * s, c.eye, 'round', 0);
  const glow = 0.4 + 0.6 * Math.abs(Math.sin(p.t * 6));
  const rg = ctx.createRadialGradient(0, -26 * s, 1, 0, -26 * s, 8 * s);
  rg.addColorStop(0, `rgba(255,180,90,${glow})`);
  rg.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(0, -26 * s, 8 * s, 0, TAU);
  ctx.fill();
}

function turtle(ctx, c, p, s) {
  const base = hex(c.color);
  // legs
  for (const k of [-1, 1]) {
    ell(ctx, k * 9 * s, -3 * s, 3.6 * s, 4.4 * s);
    ink(ctx, rgbCss(shade(base, -0.28)), 1.8);
  }
  // shell dome
  ctx.beginPath();
  ctx.ellipse(0, -9 * s, 14 * s, 11.6 * s, 0, Math.PI, TAU);
  ctx.quadraticCurveTo(12 * s, -6 * s, 0, -5.6 * s);
  ctx.quadraticCurveTo(-12 * s, -6 * s, -14 * s, -9 * s);
  ctx.closePath();
  const g = ctx.createRadialGradient(-4 * s, -17 * s, 2, 0, -8 * s, 16 * s);
  g.addColorStop(0, rgbCss(shade(base, 0.3)));
  g.addColorStop(1, rgbCss(shade(base, -0.3)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.stroke();
  // shell plates
  ctx.strokeStyle = rgbCss(shade(base, -0.45), 0.75);
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 * s, -20.4 * s + Math.abs(i) * 1.6 * s);
    ctx.lineTo(i * 6.2 * s, -6.6 * s);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-13 * s, -12 * s);
  ctx.quadraticCurveTo(0, -16.4 * s, 13 * s, -12 * s);
  ctx.stroke();
  // head
  body(ctx, 15.5 * s, -8 * s, 5.6 * s, 5 * s, shade(base, 0.1), 0.1);
  eye(ctx, 17.4 * s, -9.4 * s, 1.9 * s, c.eye, 'round', 0.4);
  // rune glow
  ctx.fillStyle = `rgba(168,255,224,${0.2 + 0.14 * Math.sin(p.t * 3)})`;
  ell(ctx, 0, -14 * s, 5.4 * s, 3.4 * s);
  ctx.fill();
}

function banshee(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 1.7) * 2.6 * s;
  // tattered robe
  ctx.beginPath();
  ctx.moveTo(-9 * s, -22 * s + float);
  ctx.quadraticCurveTo(-14 * s, -10 * s + float, -12 * s, -1 * s + float);
  for (let i = 0; i < 4; i++) {
    ctx.quadraticCurveTo((-9 + i * 6) * s, -5 * s + float + (i % 2) * 3 * s, (-6 + i * 6) * s, -1.6 * s + float);
  }
  ctx.quadraticCurveTo(12 * s, -10 * s + float, 9 * s, -22 * s + float);
  ctx.closePath();
  ctx.fillStyle = rgbCss(shade(base, -0.08), 0.94);
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.stroke();
  // hood
  ctx.beginPath();
  ctx.moveTo(-8 * s, -21 * s + float);
  ctx.quadraticCurveTo(-9 * s, -35 * s + float, 0, -35 * s + float);
  ctx.quadraticCurveTo(9 * s, -35 * s + float, 8 * s, -21 * s + float);
  ctx.quadraticCurveTo(0, -18 * s + float, -8 * s, -21 * s + float);
  ctx.closePath();
  ink(ctx, rgbCss(shade(base, 0.1)), 2);
  // void face
  ell(ctx, 0, -27 * s + float, 5.6 * s, 6.2 * s);
  ctx.fillStyle = 'rgba(12,8,20,0.92)';
  ctx.fill();
  for (const k of [-1, 1]) {
    ell(ctx, k * 2.2 * s, -28 * s + float, 1.4 * s, 2.1 * s);
    ctx.fillStyle = c.eye;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, -23.4 * s + float, 1.5 * s, 1.8 * s + Math.sin(p.t * 4) * 0.4 * s, 0, 0, TAU);
  ctx.fillStyle = 'rgba(240,190,210,0.5)';
  ctx.fill();
}

function catShade(ctx, c, p, s) {
  const base = hex(c.color);
  const crouch = p.crouchOut || 0;
  ell(ctx, 0, -8 * s, 13 * s, 6.6 * s, 0.06);
  ctx.fillStyle = 'rgba(6,4,12,0.55)';
  ctx.fill();
  body(ctx, 0, -4 * s, 12 * s, 3.4 * s, rgbCss === null ? base : shade(base, -0.3));
  // crouching feline silhouette
  body(ctx, 0, (-10 - crouch) * s, 12.4 * s, (7.6 - crouch * 2) * s, base, -0.06);
  body(ctx, 11 * s, (-16 - crouch * 1.4) * s, 6.4 * s, 5.6 * s, shade(base, 0.08), 0);
  // ears
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo((10 + k * 4.4) * s, (-19 - crouch * 1.4) * s);
    ctx.lineTo((10 + k * 5.6) * s, (-26 - crouch * 1.4) * s);
    ctx.lineTo((10 + k * 1.6) * s, (-20.6 - crouch * 1.4) * s);
    ctx.closePath();
    ink(ctx, rgbCss(shade(base, -0.1)), 1.7);
  }
  // glowing eyes + grin
  for (const k of [-1, 1]) {
    ell(ctx, (11 + k * 2.4) * s, (-17.4 - crouch * 1.4) * s, 1.5 * s, 1.1 * s);
    ctx.fillStyle = c.eye;
    ctx.fill();
    const gl = ctx.createRadialGradient((11 + k * 2.4) * s, (-17.4 - crouch * 1.4) * s, 0.4, (11 + k * 2.4) * s, (-17.4 - crouch * 1.4) * s, 6 * s);
    gl.addColorStop(0, 'rgba(255,79,94,0.5)');
    gl.addColorStop(1, 'rgba(255,79,94,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc((11 + k * 2.4) * s, (-17.4 - crouch * 1.4) * s, 6 * s, 0, TAU);
    ctx.fill();
  }
  // tail
  ctx.beginPath();
  ctx.moveTo(-10 * s, -12 * s);
  ctx.quadraticCurveTo(-22 * s, -18 * s + Math.sin(p.t * 4) * 4 * s, -25 * s, -6 * s + Math.sin(p.t * 4) * 3 * s);
  ctx.strokeStyle = rgbCss(shade(base, -0.2));
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/* ── bosses ───────────────────────────────────────────────────────────────── */
function devourer(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 1.3) * 3 * s;
  const angry = p.phase || 0;
  // cloak
  ctx.beginPath();
  ctx.moveTo(-24 * s, -6 * s + float);
  ctx.quadraticCurveTo(-30 * s, -46 * s + float, 0, -50 * s + float);
  ctx.quadraticCurveTo(30 * s, -46 * s + float, 24 * s, -6 * s + float);
  for (let i = 0; i < 6; i++) ctx.quadraticCurveTo((18 - i * 7) * s, (-2 + (i % 2) * 6) * s + float, (12 - i * 5) * s, -3 * s + float);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -50 * s + float, 0, 0);
  g.addColorStop(0, rgbCss(shade(base, 0.24)));
  g.addColorStop(1, rgbCss(shade(base, -0.4)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.stroke();
  // ears / horns
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * 9 * s, -46 * s + float);
    ctx.quadraticCurveTo(k * 20 * s, -62 * s + float, k * 15 * s, -70 * s + float);
    ctx.quadraticCurveTo(k * 12 * s, -58 * s + float, k * 4 * s, -50 * s + float);
    ctx.closePath();
    ink(ctx, rgbCss(shade(base, -0.1)), 2.2);
  }
  // three eyes
  const ey = -30 * s + float;
  eye(ctx, -7 * s, ey, 3.4 * s, c.eye, 'slit', 0);
  eye(ctx, 7 * s, ey, 3.4 * s, c.eye, 'slit', 0);
  ell(ctx, 0, (ey - 8 * s), 2.8 * s + angry * 1.2 * s, 4.4 * s);
  ctx.fillStyle = c.glow;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.stroke();
  // maw
  ctx.beginPath();
  ctx.moveTo(-9 * s, -18 * s + float);
  ctx.quadraticCurveTo(0, -12 * s + float, 9 * s, -18 * s + float);
  ctx.quadraticCurveTo(0, -24 * s + float, -9 * s, -18 * s + float);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,6,16,0.92)';
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = '#fff4e2';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3.4 * s - 1.2 * s, -20.4 * s + float);
    ctx.lineTo(i * 3.4 * s + 1.2 * s, -20.4 * s + float);
    ctx.lineTo(i * 3.4 * s, -17.2 * s + float);
    ctx.closePath();
    ctx.fill();
  }
  // moon sigil
  ctx.beginPath();
  ctx.arc(0, -42 * s + float, 5 * s, 0.4, Math.PI * 1.6);
  ctx.strokeStyle = `rgba(255,232,168,${0.5 + 0.2 * Math.sin(p.t * 2)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function lanternKing(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 1.6) * 2.4 * s;
  // hanging lanterns
  for (const k of [-1, 1]) {
    const ly = (-56 + Math.sin(p.t * 1.4 + k) * 3) * s + float;
    ctx.beginPath();
    ctx.moveTo(k * 19 * s, -48 * s + float);
    ctx.lineTo(k * 19 * s, ly + 6 * s);
    ctx.strokeStyle = 'rgba(255,201,102,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ell(ctx, k * 19 * s, ly + 10 * s, 5.4 * s, 6.4 * s);
    const lg = ctx.createRadialGradient(k * 19 * s, ly + 10 * s, 1, k * 19 * s, ly + 10 * s, 12 * s);
    lg.addColorStop(0, 'rgba(255,230,168,0.9)');
    lg.addColorStop(1, 'rgba(255,140,70,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(k * 19 * s, ly + 10 * s, 12 * s, 0, TAU); ctx.fill();
    ell(ctx, k * 19 * s, ly + 10 * s, 5.4 * s, 6.4 * s);
    ink(ctx, 'rgba(255,180,90,0.92)', 1.8);
  }
  // robe
  ctx.beginPath();
  ctx.moveTo(-22 * s, -4 * s + float);
  ctx.quadraticCurveTo(-26 * s, -44 * s + float, 0, -48 * s + float);
  ctx.quadraticCurveTo(26 * s, -44 * s + float, 22 * s, -4 * s + float);
  ctx.quadraticCurveTo(0, 2 * s + float, -22 * s, -4 * s + float);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -48 * s, 0, 0);
  g.addColorStop(0, rgbCss(shade(base, 0.2)));
  g.addColorStop(0.6, rgbCss(base));
  g.addColorStop(1, rgbCss(shade(base, -0.42)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.stroke();
  // crown of flames
  for (let i = -2; i <= 2; i++) {
    const h = (14 + Math.sin(p.t * 5 + i) * 3) * s;
    ctx.beginPath();
    ctx.moveTo(i * 6 * s - 3 * s, -46 * s + float);
    ctx.quadraticCurveTo(i * 6 * s, -46 * s - h + float, i * 6 * s + 3.4 * s, -46 * s + float);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7a3c';
    ctx.fill();
  }
  // mask-face
  ctx.beginPath();
  ctx.ellipse(0, -28 * s + float, 11 * s, 11.6 * s, 0, 0, TAU);
  ink(ctx, 'rgba(255,238,206,0.94)', 2.2);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * 1.6 * s, -32 * s + float);
    ctx.quadraticCurveTo(k * 7 * s, -34 * s + float, k * 7.4 * s, -27 * s + float);
    ctx.quadraticCurveTo(k * 3 * s, -29 * s + float, k * 1.6 * s, -32 * s + float);
    ctx.closePath();
    ctx.fillStyle = '#1a0f14';
    ctx.fill();
  }
  ctx.strokeStyle = '#b3202f'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3 * s, -20 * s + float);
  ctx.quadraticCurveTo(0, -18 * s + float, 3 * s, -20 * s + float);
  ctx.stroke();
}

function hollow(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 1.1) * 2.2 * s;
  const tails = 9;
  for (let i = 0; i < tails; i++) {
    const a = (i / tails) * TAU + p.t * 0.5;
    const len = (34 + Math.sin(p.t * 2 + i) * 8) * s;
    ctx.beginPath();
    ctx.moveTo(0, -30 * s + float);
    ctx.quadraticCurveTo(Math.cos(a) * len * 0.6, -30 * s + float + Math.sin(a) * len * 0.4, Math.cos(a) * len, -32 * s + float + Math.sin(a) * len * 0.7);
    ctx.strokeStyle = `rgba(63,214,168,${0.16 + 0.1 * Math.sin(p.t * 3 + i)})`;
    ctx.lineWidth = (2 + (i % 3)) * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // body mass
  body(ctx, 0, -32 * s + float, 16 * s, 18 * s, base, 0);
  // hollow chest
  ell(ctx, 0, -30 * s + float, 7 * s, 9 * s);
  const g = ctx.createRadialGradient(0, -30 * s + float, 1, 0, -30 * s + float, 13 * s);
  g.addColorStop(0, 'rgba(63,214,168,0.95)');
  g.addColorStop(1, 'rgba(63,214,168,0)');
  ctx.fillStyle = g;
  ctx.fill();
  // head
  body(ctx, 0, -52 * s + float, 12 * s, 10.4 * s, shade(base, 0.08), 0);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * 6 * s, -59 * s + float);
    ctx.lineTo(k * 10 * s, -70 * s + float);
    ctx.lineTo(k * 2.4 * s, -60 * s + float);
    ctx.closePath();
    ink(ctx, rgbCss(shade(base, -0.06)), 1.9);
  }
  for (const k of [-1, 1]) eye(ctx, k * 5 * s, -52 * s + float, 2.8 * s, c.eye, 'slit', 0);
  // cracks
  ctx.strokeStyle = 'rgba(63,214,168,0.55)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-10 * s + i * 6 * s, -44 * s + float);
    ctx.lineTo(-6 * s + i * 6 * s, -36 * s + float);
    ctx.lineTo(-9 * s + i * 6 * s, -26 * s + float);
    ctx.stroke();
  }
}

/* ── mini-bosses reuse primitives with size and extra flair ────────────────── */
function broodmother(ctx, c, p, s) {
  const base = hex(c.color);
  const pulse = 1 + Math.sin(p.t * 2) * 0.05;
  for (let i = 3; i >= 0; i--) {
    const a = (i / 4) * TAU + p.t * 0.35;
    const len = 46 * s;
    ctx.beginPath();
    ctx.moveTo(0, -22 * s);
    ctx.quadraticCurveTo(Math.cos(a) * len * 0.7, -22 * s + Math.sin(a) * 12 * s, Math.cos(a) * len, Math.sin(a) * 26 * s - 6 * s);
    ctx.strokeStyle = rgbCss(shade(base, -0.34));
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  body(ctx, 0, -20 * s, 26 * s * pulse, 19 * s * pulse, base, 0);
  for (let i = 0; i < 5; i++) {
    ell(ctx, (-14 + i * 7) * s, (-30 + (i % 2) * 4) * s, 3.4 * s, 2.6 * s, -0.4);
    ctx.fillStyle = rgbCss(shade(c.color2, 0.3), 0.8);
    ctx.fill();
  }
  body(ctx, 16 * s, -26 * s, 11 * s, 9.6 * s, shade(base, 0.1), 0.12);
  for (const k of [-1, 1]) eye(ctx, (19 + k * 3.4) * s, -29 * s, 2.8 * s, c.eye, 'round', 0.4);
  // egg cluster glow
  for (let i = 0; i < 3; i++) {
    ell(ctx, (-8 + i * 7) * s, -8 * s, 3.4 * s, 4 * s);
    ctx.fillStyle = `rgba(255,200,120,${0.35 + 0.2 * Math.sin(p.t * 3 + i)})`;
    ctx.fill();
  }
}

function wardenbig(ctx, c, p, s) {
  const base = hex(c.color);
  body(ctx, 0, -26 * s, 24 * s, 24 * s, base, 0);
  for (const k of [-1, 1]) {
    body(ctx, k * 24 * s, -16 * s, 9 * s, 9 * s, shade(base, -0.14), 0);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(k * (26 + i * 3) * s, (-12 - i * 5) * s);
      ctx.lineTo(k * (34 + i * 4) * s, (-16 - i * 6) * s);
      ctx.lineTo(k * (25 + i * 3) * s, (-16 - i * 5) * s);
      ctx.closePath();
      ink(ctx, rgbCss(shade(base, 0.24)), 1.5);
    }
  }
  body(ctx, 0, -50 * s, 13 * s, 10 * s, shade(base, 0.08), 0);
  for (const k of [-1, 1]) eye(ctx, k * 4.6 * s, -50 * s, 2.6 * s, c.eye, 'round', 0);
  ctx.strokeStyle = `rgba(159,224,200,${0.35 + 0.2 * Math.sin(p.t * 2)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -26 * s, 14 * s, 0, TAU);
  ctx.stroke();
}

function siren(ctx, c, p, s) {
  const base = hex(c.color);
  const float = Math.sin(p.t * 1.5) * 3 * s;
  for (let i = 0; i < 5; i++) {
    const sw = Math.sin(p.t * 2 + i * 0.9) * 6 * s;
    ctx.beginPath();
    ctx.moveTo((-10 + i * 5) * s, -30 * s + float);
    ctx.quadraticCurveTo((-14 + i * 7) * s + sw, -14 * s + float, (-8 + i * 4) * s + sw * 1.4, -1 * s);
    ctx.strokeStyle = `rgba(176,190,224,${0.34 - i * 0.04})`;
    ctx.lineWidth = 3.4 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  body(ctx, 0, -34 * s + float, 12 * s, 16 * s, base, 0);
  body(ctx, 0, -54 * s + float, 9.6 * s, 9 * s, shade(base, 0.1), 0);
  // veil
  ctx.beginPath();
  ctx.moveTo(-11 * s, -56 * s + float);
  ctx.quadraticCurveTo(0, -70 * s + float, 11 * s, -56 * s + float);
  ctx.quadraticCurveTo(0, -60 * s + float, -11 * s, -56 * s + float);
  ctx.fillStyle = 'rgba(230,238,255,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,8,18,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (const k of [-1, 1]) {
    ell(ctx, k * 3.4 * s, -54 * s + float, 1.9 * s, 2.6 * s);
    ctx.fillStyle = c.eye;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, -48 * s + float, 2 * s, 2.6 * s + Math.sin(p.t * 4) * 0.6 * s, 0, 0, TAU);
  ctx.fillStyle = 'rgba(40,10,24,0.9)';
  ctx.fill();
}

const SHAPES = { grub, rat, golem, spitter, wisp, frog, mushroom, turtle, banshee, cat_shade: catShade, devourer, lanternking: lanternKing, hollow, broodmother, wardenbig, siren };

/**
 * Draw any creature.
 * @param {object} def enemy/boss definition ({ shape, color, color2, eye, ... })
 * @param {object} p pose { t, crouchOut, excite, phase, hurt, dead, flip }
 */
export function drawCreature(ctx, def, p = {}, opts = {}) {
  const s = (opts.scale ?? 1) * (def.scale || 1);
  const facing = (opts.facing ?? -1) >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(opts.x ?? 0, opts.y ?? 0);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.scale(s, s);
  if (p.hurt) ctx.rotate(Math.sin(p.hurt * 40) * 0.05 * p.hurt);
  const fn = SHAPES[def.shape] || grub;
  fn(ctx, def, p, 1);
  ctx.restore();
}

/** Shadow ellipse helper used by the renderer. */
export function drawCreatureShadow(ctx, def, x, y, scale, alpha = 0.34) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#04050a';
  ell(ctx, x, y, (def.radius || 14) * scale * 0.95, (def.radius || 14) * scale * 0.34);
  ctx.fill();
  ctx.restore();
}
