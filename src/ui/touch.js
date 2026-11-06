// Touch controls drawn over the canvas: an analog stick on the left, four big
// skill buttons on the right, pause top-right. Sized for thumbs, never for mice.
// The HUD owns skill cooldown display; this layer only owns the hit areas.

import { TAU, clamp } from '../core/math.js';
import { drawIcon } from '../art/icons.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { FONT } from '../data/palette.js';
import { hexA } from '../art/actors.js';

export class TouchControls {
  constructor() {
    this.stick = { cx: 0, cy: 0, r: 66 };
    this.buttons = [];
    this.pressed = [0, 0, 0, 0];
    this.pauseRect = { x: 0, y: 0, w: 0, h: 0 };
  }

  layout(w, h, safe, run) {
    const R = Math.min(78, Math.max(56, w * 0.075));
    // stick sits in the lower-left thumb arc
    this.stick = { cx: safe.left + R + 34, cy: h - safe.bottom - R - 30, r: R };
    // four skill buttons in a shallow diamond at the lower right
    const size = Math.min(84, Math.max(62, w * 0.082));
    const gap = size * 0.18;
    const right = w - safe.right - 28;
    const bottom = h - safe.bottom - 26;
    const slots = run?.slots || [];
    this.buttons = [
      { index: 0, x: right - size * 2 - gap, y: bottom - size, w: size, h: size },
      { index: 1, x: right - size, y: bottom - size * 2 - gap, w: size, h: size },
      { index: 2, x: right - size, y: bottom - size, w: size, h: size },
      { index: 3, x: right - size * 2 - gap, y: bottom - size * 2 - gap, w: size, h: size },
    ];
    this.buttons.forEach((b, i) => { b.slot = slots[i]; });
    this.size = size;
    this.pauseRect = { x: w - safe.right - 66, y: safe.top + 8, w: 58, h: 46 };
    return this.buttons;
  }

  /** Jump the stick ring to a fresh touch so it never feels disconnected. */
  anchor(x, y) {
    this.stickHome = { x, y };
  }

  hitTest(x, y) {
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { kind: 'skill', index: b.index };
    }
    if (x >= this.pauseRect.x && x <= this.pauseRect.x + this.pauseRect.w && y >= this.pauseRect.y && y <= this.pauseRect.y + this.pauseRect.h) return { kind: 'pause' };
    return null;
  }

  press(index) {
    this.pressed[index] = 1;
  }

  update(dt) {
    for (let i = 0; i < 4; i++) this.pressed[i] = Math.max(0, this.pressed[i] - dt * 3.4);
  }

  draw(ctx, run, input, t, opts = {}) {
    const stickState = input?.stick;
    const s = this.stick;
    const alpha = opts.alpha ?? 0.85;
    ctx.save();
    ctx.globalAlpha = alpha;

    // ── stick: fixed ring, floating knob
    const bx = stickState ? stickState.ox : s.cx;
    const by = stickState ? stickState.oy : s.cy;
    const ringR = s.r;
    const g = ctx.createRadialGradient(bx, by, ringR * 0.2, bx, by, ringR);
    g.addColorStop(0, 'rgba(12,16,30,0.34)');
    g.addColorStop(1, 'rgba(12,16,30,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, ringR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = stickState ? 'rgba(255,232,168,0.42)' : 'rgba(255,232,168,0.22)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // cardinal ticks
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * (ringR - 7), by + Math.sin(a) * (ringR - 7));
      ctx.lineTo(bx + Math.cos(a) * (ringR - 1), by + Math.sin(a) * (ringR - 1));
      ctx.strokeStyle = 'rgba(255,232,168,0.24)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const kx = bx + (stickState?.x || 0) * ringR * 0.68;
    const ky = by + (stickState?.y || 0) * ringR * 0.68;
    const knobR = ringR * 0.38;
    const kg = ctx.createRadialGradient(kx - knobR * 0.3, ky - knobR * 0.4, knobR * 0.2, kx, ky, knobR);
    kg.addColorStop(0, 'rgba(255,246,222,0.92)');
    kg.addColorStop(1, 'rgba(232,201,143,0.55)');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.arc(kx, ky, knobR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,18,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // a cat paw printed on the knob, so the stick belongs to this game
    drawIcon(ctx, 'paw', kx, ky - 1, knobR * 1.05, 'rgba(60,38,14,0.55)');

    // ── skill buttons
    for (const b of this.buttons) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const r = b.w / 2;
      const slot = b.slot;
      const ready = slot && slot.cd <= 0 && slot.charges > 0;
      const tint = slot ? slot.def.icon.tint : 'rgba(160,170,195,0.5)';
      const press = this.pressed[b.index];
      // plate
      const bg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
      bg.addColorStop(0, ready ? hexA(tint, 0.3) : 'rgba(18,23,40,0.5)');
      bg.addColorStop(1, 'rgba(8,11,22,0.44)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1 + press * 0.06), 0, TAU);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = ready ? hexA(tint, 0.75) : 'rgba(255,201,102,0.2)';
      ctx.lineWidth = ready ? 2.2 : 1.4;
      ctx.stroke();
      if (slot) {
        ctx.save();
        ctx.globalAlpha = ready ? 0.95 : 0.45;
        drawIcon(ctx, slot.def.icon.glyph, cx, cy - 2, r * 0.92, tint);
        ctx.restore();
      }
      if (slot && slot.cd > 0) {
        // radial cooldown fill, drawn as a shrinking lid
        const frac = clamp(slot.cd / Math.max(0.01, slot.def.cd), 0, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.closePath();
        ctx.fillStyle = 'rgba(4,6,14,0.62)';
        ctx.fill();
        ctx.fillStyle = '#f4ecd8';
        ctx.font = `700 ${Math.round(r * 0.5)}px ${FONT.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText(slot.cd >= 10 ? String(Math.ceil(slot.cd)) : slot.cd.toFixed(1), cx, cy + r * 0.18);
      }
      if (slot && typeof run?.energy === 'number' && run.energy < slot.def.cost) {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, TAU);
        ctx.fillStyle = 'rgba(12,10,30,0.34)';
        ctx.fill();
      }
      if (press > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3 + press * 9, 0, TAU);
        ctx.strokeStyle = hexA(tint, press * 0.55);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ── pause
    const p = this.pauseRect;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 20, 0, TAU);
    ctx.fillStyle = 'rgba(10,14,26,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,201,102,0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawIcon(ctx, 'pause', p.x + p.w / 2, p.y + p.h / 2, 18, 'rgba(244,236,216,0.85)');
    ctx.restore();
    void t; void run;
  }
}
