// FX vocabulary. Every skill is readable at a glance because effects are built
// from a handful of silhouettes (arc, ring, beam, orb, trail) — never a soup of
// unconnected shapes. All drawing is additive and pooled by the caller.

import { TAU, clamp, lerp, rgbCss, hash01, smooth } from '../core/math.js';

const INK = 'rgba(10,8,18,0.8)';

function hex(c) {
  const v = String(c).replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const alpha = (c, a) => {
  if (c.startsWith('rgba') || c.startsWith('rgb')) return c;
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
};
const lighten = (c, f) => {
  const [r, g, b] = hex(c);
  return `rgb(${Math.round(lerp(r, 255, f))},${Math.round(lerp(g, 255, f))},${Math.round(lerp(b, 255, f))})`;
};

/**
 * Claw slash. Three scythe-like strokes sweeping the arc, drawn as thin tapered
 * arcs (not wedges or spikes), fading fast. Reads as a claw at 0.2s.
 */
export function drawSlashArc(ctx, x, y, radius, angle, spread, color, progress, opts = {}) {
  const p = clamp(progress, 0, 1);
  if (p <= 0 || p >= 1) return;
  const a = Math.sin(Math.min(1, p / 0.35) * Math.PI * 0.5) * (1 - Math.max(0, (p - 0.4) / 0.6));
  const strokes = opts.strokes || 3;
  const sweep = -spread * 0.55 + spread * 1.1 * p;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < strokes; i++) {
    const k = strokes === 1 ? 0.5 : i / (strokes - 1);
    const off = (k - 0.5) * spread * 0.85;
    const startA = off + sweep - 0.42;
    const endA = off + sweep + 0.42;
    const rOuter = radius * (0.86 + k * 0.1);
    // wide soft body
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, startA, endA);
    ctx.strokeStyle = alpha(color, 0.16 * a);
    ctx.lineWidth = radius * 0.2;
    ctx.stroke();
    // mid stroke
    ctx.beginPath();
    ctx.arc(0, 0, rOuter * 0.97, startA + 0.03, endA - 0.03);
    ctx.strokeStyle = alpha(color, 0.34 * a);
    ctx.lineWidth = radius * 0.085;
    ctx.stroke();
    // bright leading filament
    ctx.beginPath();
    ctx.arc(0, 0, rOuter * 0.94, startA + 0.1, endA - 0.02);
    ctx.strokeStyle = alpha(lighten(color, 0.55), 0.72 * a);
    ctx.lineWidth = Math.max(1, radius * 0.022);
    ctx.stroke();
  }
  // origin flare
  const bloom = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 0.4);
  bloom.addColorStop(0, alpha(lighten(color, 0.3), 0.16 * a));
  bloom.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Expanding ring for novas, echoes and slams. */
export function drawRing(ctx, x, y, radius, color, progress, opts = {}) {
  const p = clamp(progress, 0, 1);
  if (p >= 1) return;
  const ease = 1 - Math.pow(1 - p, 2.4);
  const r = radius * ease;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (opts.squash ?? 0.55), 0, 0, TAU);
  ctx.strokeStyle = alpha(lighten(color, 0.3), (1 - p) * 0.9);
  ctx.lineWidth = (opts.width || 7) * (1 - p * 0.6);
  ctx.stroke();
  if (opts.fill) {
    ctx.fillStyle = alpha(color, (1 - p) * (opts.fillAlpha ?? 0.16));
    ctx.fill();
  }
  if (p < 0.5) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.7, r * 0.7 * (opts.squash ?? 0.55), 0, 0, TAU);
    ctx.strokeStyle = alpha('#ffffff', (0.5 - p) * 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** Telegraph footprint: the thing that makes every hit fair. */
export function drawTelegraph(ctx, x, y, radius, color, progress, opts = {}) {
  const p = clamp(progress, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  // filled danger zone growing in
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.55, 0, 0, TAU);
  ctx.fillStyle = alpha(color, 0.1 + p * 0.18);
  ctx.fill();
  ctx.strokeStyle = alpha(color, 0.5 + p * 0.4);
  ctx.lineWidth = 2 + p * 1.6;
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -p * 40;
  ctx.stroke();
  ctx.setLineDash([]);
  // inner fill sweep showing time remaining
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * p);
  ctx.closePath();
  ctx.fillStyle = alpha(color, 0.1 + p * 0.12);
  ctx.save();
  ctx.scale(1, 0.55);
  ctx.restore();
  ctx.fill();
  ctx.restore();
  void opts;
}

export function drawBeam(ctx, x, y, angle, length, width, color, progress) {
  const p = clamp(progress, 0, 1);
  if (p >= 1) return;
  const grow = Math.min(1, p * 5);
  const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 0, length * grow, 0);
  g.addColorStop(0, alpha('#ffffff', 0.9 * fade));
  g.addColorStop(0.15, alpha(lighten(color, 0.4), 0.8 * fade));
  g.addColorStop(1, alpha(color, 0.05));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.5);
  ctx.lineTo(length * grow, -width * 0.75);
  ctx.lineTo(length * grow, width * 0.75);
  ctx.lineTo(0, width * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.16);
  ctx.lineTo(length * grow, -width * 0.22);
  ctx.lineTo(length * grow, width * 0.22);
  ctx.lineTo(0, width * 0.16);
  ctx.closePath();
  ctx.fillStyle = alpha('#ffffff', 0.85 * fade);
  ctx.fill();
  ctx.restore();
}

export function drawLightning(ctx, points, color, progress, seed = 1) {
  const p = clamp(progress, 0, 1);
  if (p >= 1) return;
  const fade = 1 - p;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      ctx.moveTo(a.x, a.y);
      const segs = 5;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jitter = s === segs ? 0 : (hash01((i * 91 + s * 13 + seed) | 0) - 0.5) * 20;
        const nx = -(b.y - a.y);
        const ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        ctx.lineTo(lerp(a.x, b.x, t) + (nx / len) * jitter, lerp(a.y, b.y, t) + (ny / len) * jitter);
      }
    }
    ctx.strokeStyle = pass === 0 ? alpha(color, 0.7 * fade) : alpha('#ffffff', 0.95 * fade);
    ctx.lineWidth = pass === 0 ? 7 : 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/** The five effect classes the renderer instantiates from run events. */
export function drawImpact(ctx, x, y, radius, color, progress) {
  const p = clamp(progress, 0, 1);
  const r = radius * (0.35 + p * 0.9);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha('#ffffff', 0.8 * (1 - p)));
  g.addColorStop(0.35, alpha(lighten(color, 0.3), 0.5 * (1 - p)));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawParticle(ctx, p) {
  const t = clamp(p.life / p.max, 0, 1);
  const a = p.alpha * t;
  ctx.save();
  ctx.globalAlpha = a;
  if (p.kind === 'spark') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, p.size * 0.7);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.stroke();
  } else if (p.kind === 'ember') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.7), 0, TAU);
    ctx.fill();
  } else if (p.kind === 'glow') {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
    g.addColorStop(0, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 2.4, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'shard') {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.42, 0);
    ctx.lineTo(0, p.size);
    ctx.lineTo(-p.size * 0.42, 0);
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === 'smoke') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.7), 0, TAU);
    ctx.fill();
  } else if (p.kind === 'coin') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * Math.abs(Math.cos(p.rot)) + 1, p.size, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t + 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Wind-up tell on a creature: an arc that snaps when the attack fires. */
export function drawTell(ctx, enemy, progress, color) {
  const p = clamp(progress, 0, 1);
  const r = (enemy.radius || 16) * 1.5;
  ctx.save();
  ctx.translate(enemy.x, enemy.y - (enemy.def?.radius || 16) * 0.8);
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(0, 0, r + 7 - p * 7, -Math.PI / 2, -Math.PI / 2 + TAU * p);
  ctx.strokeStyle = alpha(color || '#ff4f5e', 0.55 + p * 0.4);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Floating damage / heal numerals. */
export function drawFloating(ctx, text, x, y, opts = {}) {
  const t = clamp(opts.t ?? 0, 0, 1);
  const alphaV = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
  const rise = 34 * smooth(t);
  ctx.save();
  ctx.globalAlpha = alphaV;
  ctx.font = opts.font || `700 ${opts.size || 17}px "Be Vietnam Pro", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = 'rgba(8,6,14,0.72)';
  ctx.strokeText(text, x, y - rise);
  ctx.fillStyle = opts.color || '#fff3dc';
  ctx.fillText(text, x, y - rise);
  ctx.restore();
  void INK;
}
