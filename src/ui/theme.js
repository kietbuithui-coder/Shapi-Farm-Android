// UI theme + shared drawing primitives. Every panel, button and card in the game
// is built from these so the whole interface shares one visual grammar:
//   night-indigo glass, 1px lantern edge, serif display type, mono numerals.

import { PALETTE, FONT } from '../data/palette.js';
import { TAU, clamp, lerp } from '../core/math.js';

export const UI = {
  radius: 14,
  radiusSm: 9,
  pad: 18,
  edge: 'rgba(255,201,102,0.24)',
  edgeStrong: 'rgba(255,201,102,0.52)',
  glass: 'rgba(10,14,28,0.78)',
  glassSolid: '#0d1224',
  text: '#f4ecd8',
  textDim: '#9aa8c8',
  textFaint: 'rgba(154,168,200,0.62)',
  accent: PALETTE.gold,
  danger: '#ff5f6d',
  good: '#67e8a0',
};

export function roundRect(ctx, x, y, w, h, r = UI.radius) {
  const rr = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Frosted night-glass panel with a lantern edge and a soft top highlight. */
export function panel(ctx, x, y, w, h, opts = {}) {
  const r = opts.radius ?? UI.radius;
  ctx.save();
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
  }
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, opts.top || 'rgba(22,29,52,0.94)');
  g.addColorStop(1, opts.bottom || 'rgba(9,12,24,0.96)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = opts.edge || UI.edge;
  ctx.lineWidth = opts.edgeWidth ?? 1.4;
  ctx.stroke();
  // top sheen
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1.2);
  ctx.lineTo(x + w - r, y + 1.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (opts.glow) {
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = opts.glow;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function text(ctx, str, x, y, opts = {}) {
  const size = opts.size || 16;
  const weight = opts.weight || 500;
  const family = opts.font || FONT.ui;
  ctx.save();
  ctx.font = `${opts.italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.letter) ctx.letterSpacing = opts.letter + 'px';
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(4,5,12,0.6)';
    ctx.fillText(str, x + (opts.shadowX ?? 0), y + (opts.shadowY ?? 2));
  }
  ctx.fillStyle = opts.color || UI.text;
  ctx.fillText(str, x, y);
  if (opts.stroke) {
    ctx.lineWidth = opts.strokeWidth || 3;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.restore();
  return ctx.measureText(str).width;
}

export function measure(ctx, str, size = 16, weight = 500, family = FONT.ui) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** A pill button. Returns its hit rect for the input layer. */
export function button(ctx, { x, y, w, h, label, icon, primary, danger, disabled, hover, font, iconGap = 10, iconSize }) {
  const r = h / 2;
  ctx.save();
  const active = hover && !disabled;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (disabled) {
    grad.addColorStop(0, 'rgba(40,46,66,0.7)');
    grad.addColorStop(1, 'rgba(24,28,44,0.7)');
  } else if (danger) {
    grad.addColorStop(0, active ? '#8f2430' : '#6e1c26');
    grad.addColorStop(1, active ? '#64141d' : '#4a1017');
  } else if (primary) {
    grad.addColorStop(0, active ? '#ffd98a' : '#f0c069');
    grad.addColorStop(1, active ? '#e8a23a' : '#c9871f');
  } else {
    grad.addColorStop(0, active ? 'rgba(60,72,108,0.96)' : 'rgba(38,46,74,0.94)');
    grad.addColorStop(1, active ? 'rgba(30,38,62,0.96)' : 'rgba(20,26,44,0.94)');
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = disabled ? 'rgba(120,130,155,0.25)' : primary ? 'rgba(255,236,190,0.75)' : UI.edge;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (active && !disabled) {
    ctx.beginPath();
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r + 2);
    ctx.strokeStyle = primary ? 'rgba(255,236,190,0.28)' : 'rgba(255,201,102,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const labelColor = disabled ? 'rgba(180,190,210,0.45)' : primary ? '#2a1a08' : danger ? '#ffe8ec' : UI.text;
  const size = font ? parseInt(String(font), 10) || 16 : 16;
  let textX = x + w / 2;
  if (icon) {
    const iw = iconSize || size + 6;
    const total = iw + iconGap + measure(ctx, label || '', size, 600);
    const startX = x + (w - total) / 2;
    drawIconInline(ctx, icon, startX + iw / 2, y + h / 2, iw, labelColor);
    textX = startX + iw + iconGap;
    text(ctx, label || '', textX, y + h / 2 + size * 0.36, { size, weight: 600, color: labelColor });
  } else {
    text(ctx, label || '', textX, y + h / 2 + size * 0.36, { size, weight: 600, color: labelColor, align: 'center' });
  }
  ctx.restore();
  return { x, y, w, h };
}

let iconRenderer = null;
export function setIconRenderer(fn) { iconRenderer = fn; }
function drawIconInline(ctx, name, x, y, size, color) {
  if (iconRenderer) iconRenderer(ctx, name, x, y, size, color);
}

/** Circular icon button (pause, back, close). */
export function iconButton(ctx, { x, y, r, icon, color = UI.text, hover, bg = 'rgba(14,19,34,0.82)' }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = hover ? 'rgba(30,40,66,0.95)' : bg;
  ctx.fill();
  ctx.strokeStyle = hover ? UI.edgeStrong : UI.edge;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (iconRenderer) iconRenderer(ctx, icon, x, y - 1, r * 1.05, color);
  ctx.restore();
}

/** Horizontal meter with a soft inner glow. */
export function meter(ctx, x, y, w, h, value, opts = {}) {
  const p = clamp(value, 0, 1);
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = opts.track || 'rgba(8,10,20,0.85)';
  ctx.fill();
  ctx.strokeStyle = opts.edge || 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (p > 0.001) {
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, opts.color2 || opts.color || '#ff5f6d');
    g.addColorStop(1, opts.color || '#b3202f');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * p, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + h * 0.12, w * p, h * 0.3);
    ctx.restore();
  }
  if (opts.shield) {
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(143,224,255,0.75)';
    ctx.fillRect(x, y, w * clamp(opts.shield, 0, 1), h);
    ctx.restore();
  }
  ctx.restore();
}

/** Tiny stat row: icon, value — no explanatory sentence. */
export function statChip(ctx, x, y, w, icon, value, opts = {}) {
  const h = opts.h || 26;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(10,14,26,0.62)';
  ctx.fill();
  if (iconRenderer) iconRenderer(ctx, icon, x + 14, y + h / 2, 14, opts.iconColor || opts.color || UI.textDim);
  text(ctx, value, x + 28, y + h / 2 + 5, { size: opts.size || 13, weight: 600, color: opts.color || UI.text });
}

/** Section heading: small caps, wide tracking, thin lantern rule. */
export function heading(ctx, label, x, y, w, opts = {}) {
  const size = opts.size || 12;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT.ui}`;
  ctx.letterSpacing = '2.4px';
  ctx.fillStyle = opts.color || 'rgba(255,201,102,0.75)';
  ctx.textAlign = opts.align || 'left';
  const labelW = ctx.measureText(label.toUpperCase()).width;
  const startX = opts.align === 'center' ? x + (w - labelW) / 2 : opts.align === 'right' ? x + w - labelW : x;
  ctx.fillText(label.toUpperCase(), startX, y);
  ctx.letterSpacing = '0px';
  const lineY = y + 7;
  ctx.strokeStyle = opts.rule || 'rgba(255,201,102,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (opts.align === 'center') {
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + w, lineY);
  } else {
    ctx.moveTo(startX, lineY);
    ctx.lineTo(x + w, lineY);
  }
  ctx.stroke();
  ctx.restore();
}

export function divider(ctx, x, y, w, color = 'rgba(255,201,102,0.14)') {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, 'rgba(255,201,102,0)');
  g.addColorStop(0.5, color);
  g.addColorStop(1, 'rgba(255,201,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
}

export function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
export function easeIn(t) { return Math.pow(clamp(t, 0, 1), 3); }
export function easeInOut(t) { const x = clamp(t, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
export { lerp };
