// Procedural cat rig v2 — upright, expressive, ink-and-wash illustration style.
//
// Coordinate space: origin between the hind paws, +x = facing right, +y = down.
// Overall height ≈ 58 units at scale 1 (readable at 44–70 px on screen).
// Poses are plain data so animation lives in systems/animation.js, not here.
//
// Rendering rules that keep every cat in one visual language:
//   • 2.2px ink outline, 3 flat tones (highlight / base / shadow), no blur filters
//   • moon rim light from the upper-left
//   • silhouette differences come from ears, tail, body mass and fur type only

import { TAU, clamp, lerp, smooth, shade, rgbCss, hash01 } from '../core/math.js';

const INK = '#0a0812';
const INK_SOFT = 'rgba(10,8,18,0.55)';
const RIM = (a) => `rgba(255,240,203,${a})`;

export function poseDefaults(p = {}) {
  return {
    t: 0, gait: 0, lean: 0, squash: 1, headTilt: 0, tail: 0, ears: 0, blink: 0,
    mouth: 0, crouch: 0, hurt: 0, dead: 0, attack: 0, cast: 0, dash: 0,
    airborne: 0, range: 0, charge: 0, ...p,
  };
}

const hex = (c) => {
  if (Array.isArray(c)) return c;
  const v = c.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
export { hex };

function fillInk(ctx, fill, lw = 2.2) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), rot, 0, TAU);
}
/** Scalloped fur edge helper: jittered polyline along an arc. */
function furEdge(ctx, x, y, rx, ry, from, to, bumps, amp, phase = 0) {
  ctx.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const t = i / bumps;
    const a = lerp(from, to, t);
    const wob = 1 + Math.sin(t * Math.PI * bumps * 0.5 + phase) * 0.03;
    const px = x + Math.cos(a) * rx * wob;
    const py = y + Math.sin(a) * ry * wob;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const tip = i % 2 === 0 ? amp : amp * 0.35;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px + nx * tip, py + ny * tip);
  }
}

/* ── ears ─────────────────────────────────────────────────────────────────── */
function drawEars(ctx, cat, pose, hx, hy, hr, base, dark, light) {
  const kind = cat.look.ear;
  const flick = clamp(pose.ears, -0.6, 0.6);
  const back = pose.hurt * 0.35;
  if (kind === 'fold') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(hx + side * hr * 0.58, hy - hr * 0.52);
      ctx.rotate(side * (0.62 + flick * 0.18 + back));
      ctx.beginPath();
      ctx.moveTo(-hr * 0.26, 0);
      ctx.quadraticCurveTo(-hr * 0.3, -hr * 0.42, hr * 0.05, -hr * 0.44);
      ctx.quadraticCurveTo(hr * 0.32, -hr * 0.4, hr * 0.26, 0);
      ctx.closePath();
      fillInk(ctx, rgbCss(shade(base, -0.06)), 2.1);
      ell(ctx, 0, -hr * 0.1, hr * 0.16, hr * 0.1);
      fillInk(ctx, rgbCss(shade(dark, 0.06)), 1.1);
      ctx.restore();
    }
    return;
  }
  const tall = kind === 'tall' ? 1.34 : kind === 'huge' ? 1.42 : kind === 'small' ? 0.66 : 1;
  const outer = kind === 'huge' ? 1.34 : kind === 'small' ? 1.1 : 1;
  for (const side of [-1, 1]) {
    const bx = hx + side * hr * 0.62;
    const tipX = bx + side * hr * (0.2 + flick * 0.16) - back * hr * 0.1;
    const tipY = hy - hr * (0.55 + 0.55 * tall);
    const bx0 = bx - hr * 0.28 * outer;
    const bx1 = bx + hr * 0.34 * outer;
    ctx.beginPath();
    ctx.moveTo(bx0, hy - hr * 0.34);
    ctx.quadraticCurveTo(bx - hr * 0.16 * outer, tipY + hr * 0.3, tipX, tipY);
    ctx.quadraticCurveTo(bx + hr * 0.3 * outer, tipY + hr * 0.34, bx1, hy - hr * 0.3);
    ctx.quadraticCurveTo(bx, hy - hr * 0.18, bx0, hy - hr * 0.34);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(base, -0.02));
    ctx.fill();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // inner ear
    ctx.beginPath();
    ctx.moveTo(bx - hr * 0.12 * outer, hy - hr * 0.36);
    ctx.quadraticCurveTo(bx, tipY + hr * 0.42, tipX - side * hr * 0.02, tipY + hr * 0.16);
    ctx.quadraticCurveTo(bx + hr * 0.16 * outer, tipY + hr * 0.46, bx + hr * 0.18 * outer, hy - hr * 0.36);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(light, -0.42), 0.62);
    ctx.fill();
    if (cat.look.earTuft) {
      ctx.strokeStyle = rgbCss(shade(light, 0.1));
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = -2.2 + i * 0.36 + flick * 0.2;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY + 1.5);
        ctx.lineTo(tipX + Math.cos(a) * hr * 0.3 * side * 0.5 + side * 2, tipY + Math.sin(a) * hr * 0.26);
        ctx.stroke();
      }
    }
  }
}

/* ── head ─────────────────────────────────────────────────────────────────── */
function drawHead(ctx, cat, pose, cx, cy, hr) {
  const base = hex(cat.color);
  const light = hex(cat.color3 || cat.color);
  const dark = hex(cat.color2);
  const look = cat.look;
  const tilt = (pose.headTilt || 0) + (pose.lean || 0) * 0.2 - pose.hurt * 0.22;
  const squint = clamp(pose.hurt * 1.1, 0, 0.85);
  const blink = Math.max(smooth(pose.blink), squint);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.scale(1, 1 + pose.squash * 0.06 - 0.06);

  drawEars(ctx, cat, pose, 0, 0, hr, base, dark, light);

  // jaw ruff: scalloped fur hugging the cheeks (stays inside the head bounds)
  if (look.fluff > 0.28 || look.cheek > 0.4) {
    const amt = Math.min(1, look.fluff * 0.7 + look.cheek * 0.5);
    for (const side of [-1, 1]) {
      ctx.save();
      ell(ctx, 0, 0, hr, hr * 0.88);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(side * hr * 0.12, hr * 0.5);
      const n = 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = side * hr * lerp(0.45, 0.94, t + 0.03);
        const py = hr * lerp(0.55, 0.02, t) + Math.sin(t * 5 + pose.t * 1.4) * hr * 0.03 * amt;
        ctx.quadraticCurveTo(px + side * hr * 0.1, py + hr * 0.14 * amt, px, py);
      }
      ctx.quadraticCurveTo(side * hr * 0.5, hr * 0.1, side * hr * 0.1, -hr * 0.02);
      ctx.closePath();
      ctx.fillStyle = rgbCss(shade(base, -0.04));
      ctx.fill();
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
  }

  // skull
  ell(ctx, 0, 0, hr, hr * 0.88);
  ctx.fillStyle = rgbCss(base);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // shading: shadow wedge on lower right + rim on upper left
  ctx.save();
  ell(ctx, 0, 0, hr, hr * 0.88);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(hr * 0.36, hr * 0.34, hr * 0.9, hr * 0.7, -0.35, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, -0.2), 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-hr * 0.42, -hr * 0.5, hr * 0.72, hr * 0.42, -0.5, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, 0.24), 0.5);
  ctx.fill();
  ctx.restore();

  // face markings: mask (siamese/ragdoll), forehead tabby M, blaze
  if (look.mask) {
    ctx.save();
    ell(ctx, 0, 0, hr, hr * 0.88);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, hr * 0.34, hr * 0.8, hr * 0.58, 0, 0, TAU);
    ctx.fillStyle = rgbCss(shade(dark, 0.14), 0.7);
    ctx.fill();
    ctx.restore();
  }
  if (look.stripes > 0) {
    ctx.save();
    ell(ctx, 0, 0, hr, hr * 0.88);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgbCss(shade(dark, -0.05), 0.72);
    ctx.lineWidth = hr * 0.085;
    for (let i = 0; i < Math.min(4, look.stripes + 1); i++) {
      const yy = -hr * 0.74 + i * hr * 0.14;
      ctx.beginPath();
      ctx.moveTo(-hr * 0.62, yy + hr * 0.1);
      ctx.quadraticCurveTo(-hr * 0.18, yy - hr * 0.1, hr * 0.02, yy + hr * 0.1);
      ctx.stroke();
    }
    // silhouette-breaking cheek stripes give tabbies their look
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(side * hr * (0.62 + i * 0.04), hr * (0.02 + i * 0.2));
        ctx.lineTo(side * hr * 0.98, hr * (0.16 + i * 0.24));
        ctx.stroke();
      }
    }
    if (look.spots) {
      ctx.fillStyle = rgbCss(shade(dark, 0.02), 0.72);
      for (let i = 0; i < 8; i++) {
        const a = hash01(i * 977 + cat.id.length * 31) * TAU;
        const rr = hr * (0.3 + hash01(i * 313 + 7) * 0.5);
        ell(ctx, Math.cos(a) * rr, Math.sin(a) * rr * 0.55 - hr * 0.2, hr * 0.07, hr * 0.05, a);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // muzzle
  const noseY = hr * 0.24;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.33, noseY - hr * 0.1);
  ctx.quadraticCurveTo(0, noseY - hr * 0.22, hr * 0.33, noseY - hr * 0.1);
  ctx.quadraticCurveTo(hr * 0.3, noseY + hr * 0.24, hr * 0.1, noseY + hr * 0.29);
  ctx.quadraticCurveTo(0, noseY + hr * 0.31, -hr * 0.1, noseY + hr * 0.29);
  ctx.quadraticCurveTo(-hr * 0.3, noseY + hr * 0.24, -hr * 0.33, noseY - hr * 0.1);
  ctx.closePath();
  ctx.fillStyle = rgbCss(shade(light, -0.04), 0.97);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,8,18,0.34)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // whisker dots
  ctx.fillStyle = 'rgba(10,8,18,0.3)';
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    ell(ctx, side * hr * (0.12 + i * 0.055), noseY + hr * (0.08 + (i % 2) * 0.06), hr * 0.022, hr * 0.022);
    ctx.fill();
  }

  // eyes
  const eyeY = -hr * 0.06;
  const eyeX = hr * 0.42;
  const eyeW = hr * 0.163;
  const open = 1 - blink;
  const anger = clamp((pose.attack || 0) * 0.6 + (pose.hurt || 0) * 0.5, 0, 1);
  for (const side of [-1, 1]) {
    const ex = side * eyeX;
    ctx.save();
    ctx.translate(ex, eyeY);
    ctx.rotate(side * 0.06 - anger * side * 0.16);
    if (open > 0.12) {
      const eh = hr * 0.185 * open;
      ell(ctx, 0, 0, eyeW, eh);
      ctx.fillStyle = '#120d1c';
      ctx.fill();
      ell(ctx, 0, 0, eyeW * 0.84, eh * 0.84);
      ctx.fillStyle = rgbCss(hex(cat.eye));
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeW * 0.33, eh * 0.66, 0, 0, TAU);
      ctx.fillStyle = 'rgba(6,4,12,0.94)';
      ctx.fill();
      ell(ctx, -eyeW * 0.34, -eh * 0.34, eyeW * 0.24, eh * 0.26, -0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ell(ctx, eyeW * 0.26, eh * 0.3, eyeW * 0.12, eh * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-eyeW, 0);
      ctx.quadraticCurveTo(0, hr * 0.09 * (1 - anger * 0.4), eyeW, 0);
      ctx.lineWidth = 2.1;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
  // brows
  if (anger > 0.05) {
    ctx.strokeStyle = rgbCss(shade(dark, -0.25), 0.85);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * hr * 0.24, eyeY - hr * 0.24);
      ctx.lineTo(side * hr * 0.56, eyeY - hr * 0.14 - anger * hr * 0.06);
      ctx.stroke();
    }
  }

  // nose
  ctx.beginPath();
  ctx.moveTo(-hr * 0.085, noseY - hr * 0.04);
  ctx.quadraticCurveTo(0, noseY - hr * 0.09, hr * 0.085, noseY - hr * 0.04);
  ctx.quadraticCurveTo(hr * 0.03, noseY + hr * 0.075, 0, noseY + hr * 0.085);
  ctx.quadraticCurveTo(-hr * 0.03, noseY + hr * 0.075, -hr * 0.085, noseY - hr * 0.04);
  ctx.closePath();
  ctx.fillStyle = rgbCss(shade(dark, -0.1));
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(10,8,18,0.5)';
  ctx.stroke();

  // mouth
  const mo = smooth(pose.mouth);
  ctx.strokeStyle = rgbCss(shade(dark, -0.35));
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  if (mo > 0.08) {
    ctx.beginPath();
    ctx.moveTo(-hr * 0.17, noseY + hr * 0.14);
    ctx.quadraticCurveTo(0, noseY + hr * (0.14 + 0.26 * mo), hr * 0.17, noseY + hr * 0.14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(48,10,22,0.92)';
    ctx.fill();
    // fangs
    ctx.fillStyle = '#fff8ec';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * hr * 0.13, noseY + hr * 0.15);
      ctx.lineTo(side * hr * 0.08, noseY + hr * 0.15);
      ctx.lineTo(side * hr * 0.11, noseY + hr * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, noseY + hr * 0.13);
    ctx.lineTo(0, noseY + hr * 0.19);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, noseY + hr * 0.09);
    ctx.lineTo(0, noseY + hr * 0.155);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, noseY + hr * 0.155);
      ctx.quadraticCurveTo(side * hr * 0.1, noseY + hr * 0.22, side * hr * 0.155, noseY + hr * 0.13);
      ctx.stroke();
    }
  }

  // whiskers
  ctx.save();
  ell(ctx, 0, 0, hr * 1.04, hr * 0.96);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,252,244,0.34)';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = (-0.24 + i * 0.24) * side;
      ctx.beginPath();
      ctx.moveTo(side * hr * 0.3, noseY + hr * 0.08);
      ctx.quadraticCurveTo(side * hr * 0.56, noseY + Math.sin(a) * hr * 0.26, side * hr * 0.78, noseY + Math.sin(a) * hr * 0.42);
      ctx.stroke();
    }
  }
  ctx.restore();

  // rim light on the skull
  ctx.save();
  ell(ctx, 0, 0, hr, hr * 0.88);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, 0, hr * 0.9, hr * 0.8, 0, Math.PI * 1.06, Math.PI * 1.5);
  ctx.strokeStyle = RIM(0.42 - pose.hurt * 0.14);
  ctx.lineWidth = hr * 0.12;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function contextRuff(ctx, x, y, side, hr) {
  // three fur points along the cheek
  ctx.quadraticCurveTo(side * hr * 0.9, y * 0.4, x * 1.06, y * 0.1);
  ctx.quadraticCurveTo(x * 0.92, y * 0.55, x * 1.12, y * 0.72);
  ctx.quadraticCurveTo(x * 0.72, y * 0.86, side * hr * 0.52, hr * 0.54);
}

/* ── limbs ────────────────────────────────────────────────────────────────── */
function limb(ctx, ax, ay, bx, by, w0, w1, bend, fill, lw = 2.1) {
  const mx = (ax + bx) / 2 + bend.x;
  const my = (ay + by) / 2 + bend.y;
  // ribbon along a quadratic
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const it = 1 - t;
    pts.push({
      x: it * it * ax + 2 * it * t * mx + t * t * bx,
      y: it * it * ay + 2 * it * t * my + t * t * by,
      w: lerp(w0, w1, t),
    });
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y - pts[0].w);
  for (const p of pts) ctx.lineTo(p.x, p.y - p.w);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + pts[i].w);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  return pts[pts.length - 1];
}

function paw(ctx, x, y, r, fill, lw = 2) {
  ell(ctx, x, y, r, r * 0.82);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10,8,18,0.34)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * r * 0.44, y - r * 0.3);
    ctx.lineTo(x + i * r * 0.5, y + r * 0.62);
    ctx.stroke();
  }
}

/* ── tail ─────────────────────────────────────────────────────────────────── */
function drawTail(ctx, cat, pose, bx, by, sc) {
  const look = cat.look;
  const base = hex(cat.color);
  const dark = hex(cat.color2);
  const kind = look.tail;
  const swish = Math.sin(pose.t * 1.9 + (pose.tail || 0) * 6.28);
  const lift = 1 + pose.attack * 0.35 + pose.cast * 0.25 - pose.crouch * 0.4 + pose.airborne * 0.5;
  const len = (kind === 'stub' ? 14 : kind === 'plume' ? 27 : 31) * (look.tailLen || 1);
  const thick = (kind === 'plume' ? 6.2 : kind === 'stub' ? 6.0 : kind === 'ring' ? 4.6 : 3.5);

  const p0 = { x: bx, y: by };
  const p1 = { x: bx - len * 0.5, y: by + len * 0.12 * lift };
  const p2 = { x: bx - len * 0.92, y: by - len * 0.34 * lift + swish * 7 };
  const p3 = { x: bx - len * 0.86 + swish * 16, y: by - len * 0.86 * lift + swish * 5 };

  const pts = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const x = it * it * it * p0.x + 3 * it * it * t * p1.x + 3 * it * t * t * p2.x + t * t * t * p3.x;
    const y = it * it * it * p0.y + 3 * it * it * t * p1.y + 3 * it * t * t * p2.y + t * t * t * p3.y;
    const flare = kind === 'plume' ? (0.42 + 0.5 * Math.sin(t * Math.PI * 0.9)) * (1 - t * 0.15) : 1 - t * 0.55;
    pts.push({ x, y, w: thick * flare });
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y - pts[0].w * 0.7);
  for (const p of pts) ctx.lineTo(p.x, p.y - p.w);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + pts[i].w);
  ctx.closePath();
  ctx.fillStyle = rgbCss(base);
  ctx.fill();
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // markings
  ctx.save();
  ctx.clip();
  if (kind === 'ring' || look.stripes > 1) {
    ctx.strokeStyle = rgbCss(shade(dark, -0.02), 0.62);
    ctx.lineWidth = thick * 0.55;
    for (let i = 3; i < pts.length - 1; i += 3) {
      const p = pts[i];
      ctx.beginPath();
      ctx.moveTo(p.x - p.w, p.y - p.w);
      ctx.lineTo(p.x + p.w, p.y + p.w);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y + pts[0].w * 0.9);
  for (const q of pts) ctx.lineTo(q.x, q.y + q.w * 0.92);
  ctx.strokeStyle = rgbCss(shade(dark, -0.16), 0.5);
  ctx.lineWidth = Math.max(1.4, thick * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pts[2].x, pts[2].y - pts[2].w * 0.6);
  for (const p of pts) ctx.lineTo(p.x, p.y - p.w * 0.55);
  ctx.strokeStyle = RIM(0.3);
  ctx.lineWidth = Math.max(1.2, thick * 0.28);
  ctx.stroke();
  ctx.restore();
  if (kind === 'plume') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - pts[0].w);
    for (const q of pts) ctx.lineTo(q.x, q.y - q.w);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + pts[i].w);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = rgbCss(shade(base, 0.26), 0.42);
    ctx.lineWidth = 1.1;
    for (let i = 3; i < pts.length; i += 2) {
      const q = pts[i];
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(q.x - q.w * 0.8, q.y - q.w * 0.1, q.x - q.w * 1.05, q.y + q.w * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ── main ─────────────────────────────────────────────────────────────────── */
export function drawCat(ctx, cat, poseIn = {}, opts = {}) {
  const pose = poseDefaults(poseIn);
  const sc = opts.scale ?? 1;
  const facing = (opts.facing ?? 1) >= 0 ? 1 : -1;
  const look = cat.look;
  const base = hex(cat.color);
  const light = hex(cat.color3 || cat.color);
  const dark = hex(cat.color2);

  ctx.save();
  ctx.translate(opts.x ?? 0, opts.y ?? 0);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.scale(sc, sc);

  const gait = pose.gait;
  const step = Math.sin(pose.t * 12);
  const bob = Math.abs(Math.sin(pose.t * 12)) * 2.2 * gait;
  const crouch = clamp(pose.crouch + pose.airborne * -0.12, 0, 1);
  const squash = pose.squash * (1 - crouch * 0.16);
  const lean = pose.lean * 0.3 + pose.dash * 0.34 + crouch * 0.18;
  const breathe = Math.sin(pose.t * 2.2) * 0.9;

  const hipY = -15 + crouch * 6 - bob * 0.4;
  const torsoH = 18.5 * look.body * squash;
  const shoulderY = hipY - torsoH + breathe * 0.4;
  const headR = 15.4 * look.head;
  const headY = shoulderY - headR * 0.66 - 1.4 + crouch * 2.2;

  // ── shadow
  ctx.save();
  ctx.globalAlpha = 0.4 - crouch * 0.1;
  ctx.fillStyle = '#04050a';
  ell(ctx, 1, 1, 19 * look.body + 4, 5.2 + crouch * 1.6);
  ctx.fill();
  ctx.restore();

  ctx.rotate(pose.hurt * 0.12 - pose.dead * 0.9 + (pose.airborne ? -0.1 : 0));

  // ── tail (behind)
  drawTail(ctx, cat, pose, -4, hipY - 6, 1);

  // ── far limbs
  const farLegSwing = step * 6 * gait;
  limb(ctx, -6, hipY + 2, -11 + farLegSwing * 0.6, -2, 7.0 * look.body, 5.4, { x: -8 + farLegSwing * 0.3, y: 5 }, rgbCss(shade(base, -0.3)));
  paw(ctx, -11 + farLegSwing * 0.6, -1.5, 5.4, rgbCss(shade(base, -0.34)), 1.7);

  const farArmSwing = -step * 5 * gait;
  limb(ctx, 4, shoulderY + 3, 6 + farArmSwing * 0.6 - pose.cast * 6, shoulderY + 14 + farArmSwing, 4.8, 3.8, { x: 4, y: 2 }, rgbCss(shade(base, -0.26)));
  paw(ctx, 6 + farArmSwing * 0.6 - pose.cast * 6, shoulderY + 15.2 + farArmSwing, 4.1, rgbCss(shade(base, -0.3)), 1.6);

  // ── near hind leg with haunch
  ctx.beginPath();
  ctx.ellipse(-1, hipY + 3, 10.6 * look.body, 9.4 * look.body, -0.22, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, -0.06));
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  limb(ctx, 1, hipY + 3, 4 - step * 6 * gait, -2, 8.4 * look.body, 6.2, { x: 6.5 - step * 3 * gait, y: 5.5 }, rgbCss(base));
  paw(ctx, 4 - step * 6 * gait, -1.5, 6.4, rgbCss(shade(base, 0.06)), 1.9);

  // ── torso
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  const tw = 13.4 * look.body;
  ctx.beginPath();
  ctx.moveTo(-tw * 0.82, 0);
  ctx.quadraticCurveTo(-tw * 1.06, -torsoH * 0.52, -tw * 0.66, -torsoH * 0.94);
  ctx.quadraticCurveTo(-tw * 0.2, -torsoH * 1.12, tw * 0.34, -torsoH * 1.0);
  ctx.quadraticCurveTo(tw * 0.98, -torsoH * 0.78, tw * 0.88, -torsoH * 0.34);
  ctx.quadraticCurveTo(tw * 0.8, -torsoH * 0.08, tw * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = rgbCss(base);
  ctx.fill();
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // torso shading + belly
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(tw * 0.72, -torsoH * 0.42, tw * 0.9, torsoH * 0.86, -0.2, 0, TAU);
  ctx.fillStyle = rgbCss(shade(base, -0.2), 0.6);
  ctx.fill();
  // belly/chest light patch
  ctx.beginPath();
  ctx.ellipse(tw * 0.2, -torsoH * 0.26, tw * 0.44, torsoH * 0.4, 0.1, 0, TAU);
  ctx.fillStyle = rgbCss(shade(light, -0.04), 0.34 + look.fluff * 0.26);
  ctx.fill();
  // stripes on the flank
  if (look.stripes > 0) {
    ctx.strokeStyle = rgbCss(shade(dark, -0.04), 0.6);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < look.stripes; i++) {
      const yy = -torsoH * (0.18 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(-tw * 0.9, yy);
      ctx.quadraticCurveTo(0, yy - torsoH * 0.1, tw * 0.42, yy + torsoH * 0.02);
      ctx.stroke();
    }
  }
  // neck fluff
  if (look.fluff > 0.35) {
    ctx.beginPath();
    ctx.moveTo(-tw * 0.7, -torsoH * 0.82);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      ctx.quadraticCurveTo(lerp(-tw * 0.5, tw * 0.6, t + 0.08), -torsoH * (0.9 + 0.12 * Math.sin(t * 6 + pose.t * 1.6)), lerp(-tw * 0.5, tw * 0.62, t + 0.16), -torsoH * 0.86);
    }
    ctx.quadraticCurveTo(tw * 0.8, -torsoH * 0.7, tw * 0.5, -torsoH * 0.62);
    ctx.quadraticCurveTo(0, -torsoH * 0.66, -tw * 0.7, -torsoH * 0.7);
    ctx.closePath();
    ctx.fillStyle = rgbCss(shade(light, -0.02), 0.62);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,18,0.32)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  // ambient occlusion at the hips
  ctx.beginPath();
  ctx.ellipse(0, -torsoH * 0.02, tw * 0.92, torsoH * 0.2, 0, 0, TAU);
  ctx.fillStyle = 'rgba(8,6,14,0.28)';
  ctx.fill();
  // rim light down the back
  ctx.beginPath();
  ctx.moveTo(-tw * 0.9, -torsoH * 0.06);
  ctx.quadraticCurveTo(-tw * 1.1, -torsoH * 0.55, -tw * 0.62, -torsoH * 0.96);
  ctx.strokeStyle = RIM(0.34);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // ── near arm
  const armSwing = step * 5 * gait;
  const reach = pose.cast * 12 + pose.attack * 7;
  const armX = tw * 0.42 + 3;
  limb(
    ctx, armX * 0.4, shoulderY + 4,
    armX + reach * 0.9 + armSwing * 0.5,
    shoulderY + 15 - reach * 0.6 + armSwing - pose.attack * 5,
    5.6, 4.4,
    { x: 3.6 + pose.attack * 3, y: 1.4 },
    rgbCss(shade(base, 0.02)),
  );
  paw(
    ctx, armX + reach * 0.9 + armSwing * 0.5, shoulderY + 16.4 - reach * 0.6 + armSwing - pose.attack * 5,
    4.7, rgbCss(shade(base, 0.08)), 1.9,
  );

  // ── collar with a moon charm (shared costume language)
  drawCollar(ctx, cat, pose, 0, shoulderY + 3, tw, torsoH);

  // ── head
  drawHead(ctx, cat, pose, 2 + lean * 10, headY, headR);

  ctx.restore();
  return { x: (opts.x ?? 0) + facing * (2 + lean * 10) * sc, y: (opts.y ?? 0) + headY * sc };
}

/** Head-only portrait for menus / HUD frames. */
export function drawCatFace(ctx, cat, x, y, size, opts = {}) {
  const pose = poseDefaults({ t: opts.t || 0, blink: opts.blink || 0, headTilt: opts.tilt || 0, mouth: opts.mouth || 0, ears: opts.ears || 0, hurt: opts.hurt || 0, attack: opts.attack || 0 });
  ctx.save();
  ctx.translate(x, y);
  const k = size / 26;
  ctx.scale(k, k);
  drawHead(ctx, cat, pose, 0, 0, 12.4 * cat.look.head);
  ctx.restore();
}

/** Tailored silhouette used by the codex to prove cats differ. */
export function drawCatSilhouette(ctx, cat, x, y, scale, pose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 1;
  const prev = ctx.fillStyle;
  drawCat(ctx, cat, pose || { t: 0.2, gait: 0.25 }, { x: 0, y: 0, scale: 1 });
  ctx.restore();
  void prev;
}

/** Collar + charm: the one accessory every legend wears. Colour is per cat. */
function drawCollar(ctx, cat, pose, x, y, tw, torsoH) {
  const accent = cat.collar || '#ffc966';
  const c = hex(accent);
  const swing = Math.sin(pose.t * 3.1 + 0.7) * 1.6 + pose.attack * 3 + pose.dash * 4;
  ctx.save();
  ctx.translate(x, y - torsoH * 0.62);
  ctx.rotate(-0.1 + pose.lean * 0.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, tw * 0.72, tw * 0.28, 0, 0, TAU);
  ctx.fillStyle = rgbCss(c);
  ctx.fill();
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -tw * 0.06, tw * 0.72, tw * 0.2, 0, 0, TAU);
  ctx.fillStyle = rgbCss(shade(c, 0.22), 0.7);
  ctx.fill();
  // charm
  ctx.beginPath();
  ctx.moveTo(tw * 0.1, tw * 0.2);
  ctx.lineTo(tw * 0.1 + swing * 0.2, tw * 0.62 + Math.abs(swing) * 0.3);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgbCss(shade(c, -0.4));
  ctx.stroke();
  const cy = tw * 0.62 + Math.abs(swing) * 0.3;
  ctx.beginPath();
  ctx.arc(tw * 0.1 + swing * 0.2, cy + 3, 3.4, 0, TAU);
  ctx.fillStyle = '#ffe8a8';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tw * 0.1 + swing * 0.2 - 1, cy + 2, 1, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.restore();
}
