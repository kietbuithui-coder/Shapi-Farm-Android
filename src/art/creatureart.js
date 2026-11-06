// Creature art: every enemy shape in the same ink-and-wash language as the cats
// (2px ink outline, three flat tones, moon rim light) but with its own anatomy.
//
// Each `shape` is drawn facing right around the origin at the feet, like the cats.

import { TAU, clamp, lerp, smooth, shade, rgbCss } from '../core/math.js';
import { hex } from './catart.js';

const INK = '#0a0812';
const RIM = (a) => `rgba(255,240,203,${a})`;

function ell(ctx, x, y, rx, ry, rot = 0) {
  // Guard every input. A NaN radius reaches Skia as an invalid ellipse and
  // ABORTS the process — not an exception that a try/catch can absorb, a native
  // panic that kills the tab. `Math.max(0.5, NaN)` is still NaN, which is
  // exactly how a missing pose field took the whole renderer down.
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const frx = Number.isFinite(rx) ? Math.max(0.5, rx) : 0.5;
  const fry = Number.isFinite(ry) ? Math.max(0.5, ry) : 0.5;
  const frot = Number.isFinite(rot) ? rot : 0;
  ctx.beginPath();
  ctx.ellipse(fx, fy, frx, fry, frot, 0, TAU);
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


/* ── second wave: five new anatomies ──────────────────────────────────────
   Each one is built from a different primary silhouette so it reads at a glance
   in a crowd — low-and-long, tall-and-narrow, airborne, blobby, spiky. */

// Shadow Stalker: a low four-legged prowler that thins out to a smear while
// fading. The tell is that it stops being translucent and its eyes brighten.
function shadowStalker(ctx, c, p, s) {
  const base = hex(c.color);
  const fade = clamp(p.fade == null ? 1 : p.fade, 0, 1);
  const a = 0.28 + fade * 0.72;
  ctx.save();
  ctx.globalAlpha = a;
  // tail: long, low, whipping
  ctx.beginPath();
  ctx.moveTo(-10 * s, -7 * s);
  ctx.quadraticCurveTo(-22 * s, -4 * s + Math.sin(p.t * 5) * 4 * s, -28 * s, -11 * s + Math.sin(p.t * 5) * 5 * s);
  ctx.strokeStyle = rgbCss(shade(base, -0.35));
  ctx.lineWidth = 2.4 * s;
  ctx.lineCap = 'round';
  ctx.stroke();
  // four legs, splayed
  ctx.strokeStyle = rgbCss(shade(base, -0.45));
  ctx.lineWidth = 2 * s;
  for (const [lx, ph] of [[-6, 0], [-2, 1.6], [5, 3.1], [8, 4.4]]) {
    const swing = Math.sin(p.t * 7 + ph) * 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(lx * s, -7 * s);
    ctx.lineTo(lx * s + swing, -1 * s);
    ctx.stroke();
  }
  // body: long and low
  body(ctx, -2 * s, -9 * s, 11 * s, 6.2 * s, base, -0.06);
  // head: wedge, thrust forward
  ctx.beginPath();
  ctx.moveTo(6 * s, -13.5 * s);
  ctx.quadraticCurveTo(17 * s, -12 * s, 19 * s, -8 * s);
  ctx.quadraticCurveTo(16 * s, -4.4 * s, 6 * s, -6 * s);
  ctx.closePath();
  ctx.fillStyle = rgbCss(base);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  // ears: swept back, the silhouette marker
  for (const k of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(7 * s + k * 4 * s, -13 * s);
    ctx.lineTo(3 * s + k * 4 * s, -19 * s);
    ctx.lineTo(11 * s + k * 3 * s, -14.5 * s);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(base, -0.2));
    ctx.fill();
    ctx.stroke();
  }
  // eyes: brighten as it commits
  ctx.globalAlpha = 0.4 + fade * 0.6;
  eye(ctx, 12 * s, -10 * s, 2.3 * s, c.eye, 'slit', 0.6);
  eye(ctx, 16.4 * s, -9.6 * s, 1.9 * s, c.eye, 'slit', 0.6);
  ctx.restore();
}

// Crystal Crawler: a wide, segmented armoured dome with crystal spikes along
// the spine — reads as "do not walk through this".
function crystalCrawler(ctx, c, p, s) {
  const base = hex(c.color);
  const dark = hex(c.color2);
  // legs: six stubby crab legs
  ctx.strokeStyle = rgbCss(shade(dark, 0.1));
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const lx = (-8 + i * 8) * s;
      const step = Math.sin(p.t * 6 + i * 1.4 + (side > 0 ? 1.6 : 0)) * 1.8 * s;
      ctx.beginPath();
      ctx.moveTo(lx, -5 * s);
      ctx.lineTo(lx + side * 5 * s + step, 0);
      ctx.stroke();
    }
  }
  // shell: wide dome
  body(ctx, 0, -11 * s, 15 * s, 9.4 * s, base, 0);
  // plating
  ctx.strokeStyle = rgbCss(shade(dark, 0.15), 0.75);
  ctx.lineWidth = 1.4 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(0, -11 * s, (9 + i * 0.5) * s, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
  // crystal spines
  const spikes = [[-9, 16], [-3, 20], [4, 18], [10, 14]];
  for (const [sx, sh] of spikes) {
    const glow = 0.55 + 0.45 * Math.sin(p.t * 2.4 + sx);
    ctx.beginPath();
    ctx.moveTo((sx - 3) * s, -17 * s);
    ctx.lineTo(sx * s, (-17 - sh * 0.42) * s);
    ctx.lineTo((sx + 3) * s, -17 * s);
    ctx.closePath();
    ctx.fillStyle = `rgba(200,255,255,${0.5 + glow * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = rgbCss(shade(dark, 0.3));
    ctx.lineWidth = 1.3 * s;
    ctx.stroke();
  }
  // eyes: a row of four, unsettling
  for (let i = 0; i < 4; i++) {
    ell(ctx, (-6 + i * 4.6) * s, -9 * s, 1.5 * s, 1.5 * s);
    ctx.fillStyle = c.eye;
    ctx.fill();
  }
}

// Arcane Bat: airborne, so it is drawn above the ground line with no shadow
// contact. Flapping wings are the read.
function arcaneBat(ctx, c, p, s) {
  const base = hex(c.color);
  const flap = Math.sin(p.t * 16);
  // wings: two swept membranes
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -14 * s);
    ctx.quadraticCurveTo(side * 12 * s, (-22 + flap * 6) * s, side * 22 * s, (-13 + flap * 4) * s);
    ctx.quadraticCurveTo(side * 15 * s, (-9 + flap * 2) * s, side * 8 * s, -11 * s);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(base, side > 0 ? -0.1 : -0.24), 0.92);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    // finger struts
    ctx.strokeStyle = rgbCss(shade(base, -0.45), 0.8);
    ctx.lineWidth = 1 * s;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(0, -14 * s);
      ctx.lineTo(side * (6 + k * 6) * s, (-18 + flap * 5 + k * 2) * s);
      ctx.stroke();
    }
  }
  // body
  body(ctx, 0, -12 * s, 5.4 * s, 7 * s, base, 0);
  // ears
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2 * s, -18 * s);
    ctx.lineTo(side * 5 * s, -25 * s);
    ctx.lineTo(side * 6.4 * s, -17 * s);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(base, -0.16));
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }
  eye(ctx, 2 * s, -14 * s, 1.9 * s, c.eye, 'round', 0.5);
  eye(ctx, -2.2 * s, -14 * s, 1.9 * s, c.eye, 'round', -0.5);
}

// Explosive Slime: a wobbling blob with a visible core that brightens before it
// bursts. The swell is the telegraph.
function slime(ctx, c, p, s) {
  const base = hex(c.color);
  const swell = p.swell == null ? 0 : p.swell;
  const wob = Math.sin(p.t * 9) * 0.05;
  const k = 1 + swell * 0.38;
  // puddle
  ell(ctx, 0, -1 * s, 15 * s, 4 * s);
  ctx.fillStyle = rgbCss(shade(base, -0.5), 0.5);
  ctx.fill();
  // body: squashed dome, squashing as it creeps
  const rx = 14 * s * k * (1 + wob);
  const ry = 11 * s * k * (1 - wob);
  ell(ctx, 0, -ry * 0.9, rx, ry);
  ctx.fillStyle = rgbCss(base, 0.92);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2 * s;
  ctx.stroke();
  // gloss
  ell(ctx, -rx * 0.32, -ry * 1.4, rx * 0.3, ry * 0.28, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  // core: the fuse
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(p.t * (3 + swell * 9)));
  ell(ctx, 0, -ry * 0.95, 4.6 * s * (0.8 + swell * 0.8), 4.6 * s * (0.8 + swell * 0.8));
  ctx.fillStyle = `rgba(255,${Math.round(220 - swell * 120)},120,${0.55 + pulse * 0.45})`;
  ctx.fill();
  eye(ctx, 4 * s, -ry * 1.25, 1.8 * s, c.eye, 'round', 0.4);
  eye(ctx, -3.4 * s, -ry * 1.25, 1.8 * s, c.eye, 'round', -0.4);
}

// Thorn Beast: a heavy quadruped with a bristling mane. It stays at range and
// plants thorn fields, so its silhouette is "spiky and rooted".
function thornBeast(ctx, c, p, s) {
  const base = hex(c.color);
  const dark = hex(c.color2);
  // legs
  ctx.strokeStyle = rgbCss(shade(dark, 0.2));
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (const [lx, ph] of [[-7, 0], [-3, 1.8], [6, 3.3], [10, 5]]) {
    const swing = Math.sin(p.t * 4 + ph) * 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(lx * s, -8 * s);
    ctx.lineTo(lx * s + swing, -0.5 * s);
    ctx.stroke();
  }
  // barrel body
  body(ctx, 0, -12 * s, 14 * s, 8.6 * s, base, -0.04);
  // thorn mane along the back
  const thorns = 7;
  for (let i = 0; i < thorns; i++) {
    const tx = (-11 + i * 3.6) * s;
    const len = (7 + Math.sin(i * 1.7) * 3) * s;
    ctx.beginPath();
    ctx.moveTo(tx - 1.8 * s, -17 * s);
    ctx.lineTo(tx + Math.sin(i) * 1.2 * s, -17 * s - len);
    ctx.lineTo(tx + 1.8 * s, -17 * s);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(dark, 0.28));
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
  }
  // heavy low head
  body(ctx, 12 * s, -11 * s, 7.4 * s, 6.4 * s, shade(base, -0.08), 0.12);
  // tusks
  ctx.strokeStyle = 'rgba(240,236,214,0.9)';
  ctx.lineWidth = 2 * s;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(15 * s, (-8 + k * 1.6) * s);
    ctx.quadraticCurveTo(20 * s, (-8 + k * 3) * s, 19 * s, (-4 + k * 2) * s);
    ctx.stroke();
  }
  eye(ctx, 13.5 * s, -13 * s, 2.1 * s, c.eye, 'slit', 0.4);
  // ground roots: hints that it is rooted to the floor
  ctx.strokeStyle = rgbCss(shade(dark, 0.1), 0.5);
  ctx.lineWidth = 1.2 * s;
  for (const rx of [-10, -2, 7]) {
    ctx.beginPath();
    ctx.moveTo(rx * s, -1 * s);
    ctx.quadraticCurveTo((rx + 4) * s, 1 * s, (rx + 9) * s, 0);
    ctx.stroke();
  }
}


/* ── bosses: the Void Predator and the Crystal Queen ─────────────────────
   Boss silhouettes have to be legible at a glance and unmistakably bigger than
   the mob around them, so both are built around one strong shape: the Predator
   is a low, forward-hunched hunter with a torn void mantle; the Queen is a tall
   upright figure with a crystal crown and a skirt of shards. */

// Void Predator: hunched quadruped with a drifting void mantle and four eyes.
function voidPredator(ctx, c, p, s) {
  const base = hex(c.color);
  const dark = hex(c.color2);
  const phase = p.phase || 0;
  const breathe = Math.sin(p.t * 1.8) * 2 * s;
  // void mantle: a ragged shadow behind the body, drifting
  ctx.save();
  ctx.globalAlpha = 0.5 + phase * 0.16;
  ctx.beginPath();
  ctx.moveTo(-10 * s, -34 * s + breathe);
  ctx.quadraticCurveTo(-46 * s, -30 * s + Math.sin(p.t * 0.9) * 6 * s, -56 * s, 2 * s);
  ctx.quadraticCurveTo(-30 * s, -6 * s, -14 * s, -4 * s);
  ctx.closePath();
  ctx.fillStyle = rgbCss(shade(dark, 0.05), 0.9);
  ctx.fill();
  ctx.restore();
  // haunches
  body(ctx, -12 * s, -18 * s, 17 * s, 13 * s, shade(base, -0.12), -0.1);
  // chest, forward-leaning
  body(ctx, 8 * s, -22 * s, 14 * s, 15 * s, base, 0.14);
  // four legs, digitigrade and long
  ctx.strokeStyle = rgbCss(shade(dark, 0.18));
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  for (const [lx, ly, ph] of [[-20, -10, 0], [-8, -8, 1.9], [10, -8, 3.4], [20, -10, 5.1]]) {
    const sw = Math.sin(p.t * 3.4 + ph) * 3 * s;
    ctx.beginPath();
    ctx.moveTo(lx * s, ly * s);
    ctx.lineTo((lx + sw * 0.5) * s, 0);
    ctx.stroke();
  }
  // arms: long, wickedly clawed
  for (const side of [0, 1]) {
    const ax = (14 + side * 5) * s;
    const sw = Math.sin(p.t * 2.2 + side * 2) * 3 * s;
    ctx.strokeStyle = rgbCss(shade(dark, 0.24));
    ctx.lineWidth = 4.2 * s;
    ctx.beginPath();
    ctx.moveTo(ax, -26 * s);
    ctx.quadraticCurveTo(ax + 12 * s, (-14 + side * 2) * s + sw, ax + 8 * s, -2 * s);
    ctx.stroke();
    // three claws
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo((ax / s + 8) * s, -3 * s);
      ctx.lineTo((ax / s + 10 + k * 3) * s, 2 * s);
      ctx.strokeStyle = 'rgba(236,226,255,0.85)';
      ctx.lineWidth = 1.8 * s;
      ctx.stroke();
    }
  }
  // head: wedge with a lower jaw and four eyes (two pairs, the tell)
  ctx.beginPath();
  ctx.moveTo(10 * s, -38 * s);
  ctx.quadraticCurveTo(34 * s, -34 * s, 40 * s, -25 * s);
  ctx.quadraticCurveTo(32 * s, -16 * s, 12 * s, -18 * s);
  ctx.closePath();
  ctx.fillStyle = rgbCss(shade(base, 0.06));
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();
  // jaw
  ctx.beginPath();
  ctx.moveTo(18 * s, -20 * s);
  ctx.lineTo(34 * s, -17 * s);
  ctx.strokeStyle = 'rgba(240,232,255,0.7)';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  // horns: swept back
  for (const k of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(14 * s + k * 7 * s, -37 * s);
    ctx.quadraticCurveTo(2 * s + k * 6 * s, -50 * s, -14 * s + k * 5 * s, -46 * s);
    ctx.strokeStyle = rgbCss(shade(dark, 0.3));
    ctx.lineWidth = 3 * s;
    ctx.stroke();
  }
  // four eyes, brightening with phase
  const eyeGlow = 0.55 + phase * 0.45;
  ctx.save();
  ctx.globalAlpha = eyeGlow;
  eye(ctx, 24 * s, -30 * s, 2.6 * s, c.eye, 'slit', 0.6);
  eye(ctx, 31 * s, -27 * s, 2.1 * s, c.eye, 'slit', 0.6);
  eye(ctx, 20 * s, -26 * s, 1.8 * s, c.eye, 'slit', 0.4);
  eye(ctx, 27 * s, -23.5 * s, 1.5 * s, c.eye, 'slit', 0.4);
  ctx.restore();
}

// Crystal Queen: tall upright figure, crystal crown, skirt of shards.
function crystalQueen(ctx, c, p, s) {
  const base = hex(c.color);
  const dark = hex(c.color2);
  const phase = p.phase || 0;
  const float = Math.sin(p.t * 1.1) * 3 * s;
  const pulse = 0.5 + 0.5 * Math.sin(p.t * (1.6 + phase));

  // Phase 2 has to READ as a change, not just behave like one. A boss that
  // suddenly shatters its own walls while looking identical to a second ago
  // reads as a bug. From phase 1 on she gains a cold aura and keeps a ring of
  // loose shards orbiting her, so "something changed" is visible before the
  // first shatter lands.
  if (phase >= 1) {
    const aura = ctx.createRadialGradient(0, -46 * s + float, 6 * s, 0, -46 * s + float, 62 * s);
    aura.addColorStop(0, `rgba(127,232,224,${0.20 + pulse * 0.10})`);
    aura.addColorStop(1, 'rgba(127,232,224,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -46 * s + float, 62 * s, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = p.t * 0.9 + (i / 6) * Math.PI * 2;
      const rx = Math.cos(a) * (34 + pulse * 3) * s;
      const ry = -46 * s + float + Math.sin(a) * 16 * s;
      ctx.beginPath();
      ctx.moveTo(rx, ry - 4 * s);
      ctx.lineTo(rx + 2.2 * s, ry);
      ctx.lineTo(rx, ry + 4 * s);
      ctx.lineTo(rx - 2.2 * s, ry);
      ctx.closePath();
      ctx.fillStyle = `rgba(200,255,255,${0.30 + pulse * 0.35})`;
      ctx.fill();
    }
  }

  // Skirt of shards. It must END at the floor (y = 0 is the creature's feet):
  // the first version hung from -20 with a 25px drop, so the longest shards
  // rendered below the ground line and read as a separate object floating in
  // the floor.
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = -3; i <= 3; i++) {
    // narrow, near-vertical shards hugging the robe: a skirt, not a canopy
    const sx = i * 3.6 * s;
    const top = -34 * s + float + Math.abs(i) * 1.2 * s;
    const len = (26 + (3 - Math.abs(i)) * 4) * s;
    const tip = Math.min(-1 * s, top + len);
    ctx.beginPath();
    ctx.moveTo(sx - 2.4 * s, top);
    ctx.lineTo(sx + Math.sin(p.t * 0.8 + i) * 1.6 * s, tip);
    ctx.lineTo(sx + 2.4 * s, top);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(base, -0.18 - Math.abs(i) * 0.03), 0.62);
    ctx.fill();
    ctx.strokeStyle = rgbCss(shade(dark, 0.22), 0.6);
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
  }
  ctx.restore();

  // robe / body: tall, narrow, tapering
  ctx.beginPath();
  ctx.moveTo(-13 * s, -22 * s + float);
  ctx.quadraticCurveTo(-16 * s, -58 * s + float, 0, -64 * s + float);
  ctx.quadraticCurveTo(16 * s, -58 * s + float, 13 * s, -22 * s + float);
  ctx.closePath();
  ctx.fillStyle = rgbCss(base, 0.9);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();
  // inner sheen
  ctx.beginPath();
  ctx.moveTo(-6 * s, -26 * s + float);
  ctx.quadraticCurveTo(-8 * s, -50 * s + float, 0, -58 * s + float);
  ctx.strokeStyle = `rgba(220,255,255,${0.25 + pulse * 0.3})`;
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();

  // arms: thin, out to the sides, fingers splayed
  for (const side of [-1, 1]) {
    ctx.strokeStyle = rgbCss(shade(base, -0.1));
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 11 * s, -52 * s + float);
    ctx.quadraticCurveTo(side * 24 * s, (-44 + pulse * 2) * s + float, side * 28 * s, -32 * s + float);
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(side * 28 * s, -32 * s + float);
      ctx.lineTo(side * (32 + k) * s, (-27 + k * 3) * s + float);
      ctx.strokeStyle = `rgba(200,255,255,${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 1.4 * s;
      ctx.stroke();
    }
  }

  // head: smooth crystal mask, no face but two carved eyes
  ell(ctx, 0, -70 * s + float, 8.4 * s, 9.2 * s);
  ctx.fillStyle = rgbCss(shade(base, 0.14));
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2 * s;
  ctx.stroke();
  // crown: five shards, tallest in the middle
  for (let i = -2; i <= 2; i++) {
    const h = (16 - Math.abs(i) * 4) * s;
    const bx = i * 5.4 * s;
    const tipY = -78 * s + float - h;
    ctx.beginPath();
    ctx.moveTo(bx - 2.6 * s, -76 * s + float);
    ctx.lineTo(bx, tipY);
    ctx.lineTo(bx + 2.6 * s, -76 * s + float);
    ctx.closePath();
    ctx.fillStyle = `rgba(215,255,255,${0.65 + pulse * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = rgbCss(shade(dark, 0.35));
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
  }
  // eyes: carved, glowing
  ctx.save();
  ctx.globalAlpha = 0.7 + phase * 0.3;
  ell(ctx, -3 * s, -71 * s + float, 1.9 * s, 2.4 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ell(ctx, 3 * s, -71 * s + float, 1.9 * s, 2.4 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  // floating shards orbiting her
  for (let i = 0; i < 4; i++) {
    const a = p.t * 1.4 + (i / 4) * TAU;
    const ox = Math.cos(a) * 30 * s;
    const oy = Math.sin(a) * 12 * s - 46 * s + float;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 4 * s);
    ctx.lineTo(ox + 3 * s, oy);
    ctx.lineTo(ox, oy + 4 * s);
    ctx.lineTo(ox - 3 * s, oy);
    ctx.closePath();
    ctx.fillStyle = `rgba(190,255,255,${0.4 + pulse * 0.4})`;
    ctx.fill();
  }
}

const SHAPES = {
  grub, rat, golem, spitter, wisp, frog, mushroom, turtle, banshee, cat_shade: catShade,
  devourer, lanternking: lanternKing, hollow, broodmother, wardenbig, siren,
  shadowstalker: shadowStalker, crystalcrawler: crystalCrawler, arcanebat: arcaneBat,
  slime, thornbeast: thornBeast,
  voidpredator: voidPredator, crystalqueen: crystalQueen,
};

/**
 * Draw any creature.
 * @param {object} def enemy/boss definition ({ shape, color, color2, eye, ... })
 * @param {object} p pose { t, crouchOut, excite, phase, hurt, dead, flip }
 */
export function drawCreature(ctx, def, p = {}, opts = {}) {
  const s = (opts.scale ?? 1) * (def.scale || 1);
  const facing = (opts.facing ?? -1) >= 0 ? 1 : -1;
  // Fill in the pose fields every shape reads. Callers legitimately pass only
  // the field they care about (renderer passes {dead}, {hurt}, ...), and an
  // undefined `t` turns every sin() below into NaN.
  const pose = {
    t: Number.isFinite(p.t) ? p.t : 0,
    fade: p.fade,
    swell: p.swell,
    hurt: p.hurt,
    dead: p.dead,
    crouchOut: p.crouchOut,
    excite: p.excite,
    phase: p.phase,
  };
  ctx.save();
  ctx.translate(opts.x ?? 0, opts.y ?? 0);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.scale(s, s);
  if (pose.hurt) ctx.rotate(Math.sin(pose.hurt * 40) * 0.05 * pose.hurt);
  const fn = SHAPES[def.shape] || grub;
  fn(ctx, def, pose, 1);
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
