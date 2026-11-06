// Touch controls drawn over the canvas: an analog stick on one side, four skill
// buttons on the other, pause in the corner. Sized for thumbs, never for mice.
//
// This layer owns only geometry and hit areas; the HUD draws the cooldown state.
//
// Sizing rules (these exist because the first mobile pass put the controls in
// the middle of the fight):
//   1. Nothing may enter the top HALF of the screen in landscape — that is where
//      the player, the enemies and every telegraph live.
//   2. Buttons are sized from the SHORT edge of the viewport, so a tall phone and
//      a wide one get comparable thumb targets.
//   3. A configurable `scale` multiplies both the stick and the buttons, and the
//      layout is recomputed from that — it is not a CSS transform.
//   4. Handedness mirrors the whole layout.
import { TAU, clamp } from '../core/math.js';
import { drawIcon } from '../art/icons.js';
import { FONT } from '../data/palette.js';
import { hexA } from '../art/actors.js';

/** Vertical space the layout needs for margins, so the budget maths stays honest. */
function edgeReserve(h) { return h < 500 ? 34 : 48; }

/** Every tunable in one place so layout() and draw() cannot disagree. */
export const HUD_MODES = {
  // comfort: fewer pixels, more arena. standard: the default. large: accessibility.
  compact: { scale: 0.82, alpha: 0.78, labels: false },
  standard: { scale: 1.0, alpha: 0.85, labels: true },
  large: { scale: 1.22, alpha: 0.92, labels: true },
};

export class TouchControls {
  constructor() {
    this.stick = { cx: 0, cy: 0, r: 66 };
    this.buttons = [];
    this.pressed = [0, 0, 0, 0];
    this.pauseRect = { x: 0, y: 0, w: 0, h: 0 };
    this.mode = 'standard';
    this.scale = 1;
    this.leftHanded = false;
    this.layoutW = 0;
    this.layoutH = 0;
  }

  /**
   * @param {object} opts
   * @param {string} [opts.mode]   'compact' | 'standard' | 'large'
   * @param {number} [opts.scale]  0.7 – 1.4, multiplies mode scale
   * @param {boolean} [opts.leftHanded]
   */
  configure({ mode, scale, leftHanded } = {}) {
    if (mode && HUD_MODES[mode]) this.mode = mode;
    if (typeof scale === 'number') this.scale = clamp(scale, 0.7, 1.4);
    if (typeof leftHanded === 'boolean') this.leftHanded = leftHanded;
  }

  get profile() {
    const base = HUD_MODES[this.mode] || HUD_MODES.standard;
    return { ...base, scale: base.scale * this.scale };
  }

  layout(w, h, safe = {}, run) {
    this.layoutW = w;
    this.layoutH = h;
    const prof = this.profile;
    const portrait = h > w;

    // Base the thumb target on the SHORT edge so landscape phones do not get
    // tiny buttons and portrait phones do not get huge ones.
    const shortEdge = Math.min(w, h);
    // In landscape the vertical budget above the controls is tight, so cap by
    // height as well: 4 buttons must fit in the bottom ~35% of the screen.
    // Hard ceiling: the control cluster may never start above 55% of the screen
    // in landscape. That is what keeps it out of the fight, and it has to be
    // enforced AFTER the scale multiplier or "large HUD" pushes into combat.
    const clusterFraction = portrait ? 0.42 : 0.45;   // of screen height, from the bottom
    const heightBudget = (h * clusterFraction - edgeReserve(h)) / 2.2;
    let size = clamp(shortEdge * (portrait ? 0.155 : 0.175), 44, 84);
    size = Math.min(size, heightBudget);
    size = Math.max(38, size * prof.scale);
    // Re-clamp after scaling so accessibility size can never invade the arena.
    size = Math.min(size, Math.max(38, heightBudget));
    const gap = size * 0.20;

    // The stick is deliberately a bit smaller than a button pair: it needs to
    // read as a control, not as furniture.
    const stickR = clamp(size * 0.78, 38, 74) * (prof.scale > 1 ? 1.02 : 1);

    const edge = Math.max(12, Math.min(w, h) * 0.035);
    const bottom = h - (safe.bottom || 0) - edge;

    // Cluster: a 2x2 grid, so the four skills read as one pad rather than a
    // scattered diamond (scattered circles made the hit areas ambiguous).
    const clusterW = size * 2 + gap;
    const clusterH = size * 2 + gap;

    const sideRight = (x) => w - (safe.right || 0) - edge - x;   // distance from right
    const sideLeft = (x) => (safe.left || 0) + edge + x;

    const placeCluster = (anchorRight) => {
      const x0 = anchorRight ? w - (safe.right || 0) - edge - clusterW : (safe.left || 0) + edge;
      const y0 = bottom - clusterH;
      // index order: 0 bottom-left, 1 bottom-right, 2 top-left, 3 top-right
      const pos = [
        { x: x0, y: y0 + size + gap },
        { x: x0 + size + gap, y: y0 + size + gap },
        { x: x0, y: y0 },
        { x: x0 + size + gap, y: y0 },
      ];
      return pos;
    };

    // The stick is centred a radius in from the edge, but its GRAB ZONE is
    // 1.55r wide (thumbs are imprecise). At edge=12 and r=49 that put 76px of
    // grab zone against 62px of room, so a third of the thumb target hung off
    // the left edge — and the same at the bottom, where the ring was clipped by
    // the screen. Players reported the game as unplayable on a phone for this
    // reason alone: the part of the stick you actually grab was outside the
    // viewport. Centre on the bigger of the two margins instead.
    // The grab zone extends BEYOND the drawn ring (see inStickZone, which uses
    // 1.55r). If the ring is centred a radius in from the edge, part of that
    // grab zone hangs off screen and a thumb at the very edge is ignored — the
    // reported "can't play on phone". Inset the ring so the *grab zone* fits.
    const stickGrab = 1.55;
    const inset = Math.min(edge + stickR, stickR * stickGrab + 4);
    const placeStick = (anchorRight) => {
      const cx = anchorRight
        ? Math.max(stickR, w - (safe.right || 0) - inset)
        : Math.max(stickR, (safe.left || 0) + inset);
      const cy = Math.max(stickR, h - (safe.bottom || 0) - inset);
      return { cx, cy, r: stickR };
    };

    // Right-handed (default): stick left, skills right. Left-handed: mirrored.
    const skillOnRight = !this.leftHanded;
    const stick = placeStick(!skillOnRight);
    const pos = placeCluster(skillOnRight);
    const slots = run?.slots || [];
    this.buttons = pos.map((p, i) => ({ index: i, x: p.x, y: p.y, w: size, h: size, slot: slots[i] }));
    this.stick = stick;
    this.size = size;
    this.gap = gap;
    void sideRight; void sideLeft;

    // Pause + fullscreen sit top-right. In PORTRAIT the HUD's health/night bars
    // run the full width there (they overlapped these buttons in testing), so
    // the buttons drop below the bar block; in landscape there is room up top.
    // Only portrait needs its own corner buttons: there the HUD's 28%-wide bars
    // run full width and the HUD's own corner icons land on top of them. In
    // landscape the HUD already draws pause + fullscreen, and drawing a second
    // pair here produced two pause buttons on screen.
    const btnSmall = clamp(shortEdge * 0.075, 34, 48);
    if (portrait) {
      const barRoom = clamp(h * 0.075, 54, 76);
      const btnY = (safe.top || 0) + 10 + barRoom;
      this.pauseRect = { x: w - (safe.right || 0) - btnSmall - 10, y: btnY, w: btnSmall, h: btnSmall };
      this.fullscreenRect = { x: w - (safe.right || 0) - btnSmall * 2 - 20, y: btnY, w: btnSmall, h: btnSmall };
    } else {
      // Zero-size rects: hitTest() ignores them, draw() skips them.
      this.pauseRect = { x: 0, y: 0, w: 0, h: 0 };
      this.fullscreenRect = { x: 0, y: 0, w: 0, h: 0 };
    }
    this.ownsCornerButtons = portrait;
    return this.buttons;
  }

  /** Jump the stick ring to a fresh touch so it never feels disconnected. */
  anchor(x, y) {
    this.stickHome = { x, y };
  }

  /** True if the point is inside the stick's grab area (generous, for thumbs). */
  inStickZone(x, y) {
    const s = this.stick;
    // An ellipse, not a circle: thumbs sweep wide and low. The vertical radius
    // is smaller than the horizontal one because the ring already sits near the
    // bottom edge, so extending upward costs arena space while extending
    // outward costs nothing. A circle here made edge taps fall through to the
    // scene behind and could open a menu mid-run.
    const dx = (x - s.cx) / (s.r * 1.7);
    const dy = (y - s.cy) / (s.r * 1.45);
    return dx * dx + dy * dy <= 1;
  }

  hitTest(x, y) {
    for (const b of this.buttons) {
      // Circular hit areas, matching what is drawn, with a small forgiveness ring.
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      if (Math.hypot(x - cx, y - cy) <= b.w / 2 + 4) return { kind: 'skill', index: b.index };
    }
    const inRect = (r) => r.w > 0 && r.h > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inRect(this.pauseRect)) return { kind: 'pause' };
    if (this.fullscreenRect && inRect(this.fullscreenRect)) return { kind: 'fullscreen' };
    return null;
  }

  press(index) {
    this.pressed[index] = 1;
  }

  update(dt) {
    for (let i = 0; i < 4; i++) this.pressed[i] = Math.max(0, this.pressed[i] - dt * 3.4);
  }

  draw(ctx, run, input, t, opts = {}) {
    const prof = this.profile;
    const stickState = input?.stick;
    const s = this.stick;
    const alpha = opts.alpha ?? prof.alpha;
    ctx.save();
    ctx.globalAlpha = alpha;

    // ── stick: fixed ring, floating knob
    const bx = stickState ? stickState.ox : s.cx;
    const by = stickState ? stickState.oy : s.cy;
    const ringR = s.r;
    const g = ctx.createRadialGradient(bx, by, ringR * 0.2, bx, by, ringR);
    g.addColorStop(0, 'rgba(12,16,30,0.30)');
    g.addColorStop(1, 'rgba(12,16,30,0.08)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, ringR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = stickState ? 'rgba(255,232,168,0.40)' : 'rgba(255,232,168,0.18)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // cardinal ticks — shorter than before, they were reading as a target reticle
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * (ringR - 6), by + Math.sin(a) * (ringR - 6));
      ctx.lineTo(bx + Math.cos(a) * (ringR - 1), by + Math.sin(a) * (ringR - 1));
      ctx.strokeStyle = 'rgba(255,232,168,0.20)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    const kx = bx + (stickState?.x || 0) * ringR * 0.62;
    const ky = by + (stickState?.y || 0) * ringR * 0.62;
    const knobR = ringR * 0.36;
    const kg = ctx.createRadialGradient(kx - knobR * 0.3, ky - knobR * 0.4, knobR * 0.2, kx, ky, knobR);
    kg.addColorStop(0, 'rgba(255,246,222,0.88)');
    kg.addColorStop(1, 'rgba(232,201,143,0.48)');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.arc(kx, ky, knobR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,18,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawIcon(ctx, 'paw', kx, ky - 1, knobR * 1.0, 'rgba(60,38,14,0.5)');

    // ── skill buttons
    for (const b of this.buttons) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const r = b.w / 2;
      const slot = b.slot;
      const ready = slot && slot.cd <= 0 && slot.charges > 0;
      const tint = slot ? slot.def.icon.tint : 'rgba(160,170,195,0.5)';
      const press = this.pressed[b.index];
      const bg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
      bg.addColorStop(0, ready ? hexA(tint, 0.28) : 'rgba(18,23,40,0.46)');
      bg.addColorStop(1, 'rgba(8,11,22,0.40)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1 + press * 0.05), 0, TAU);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = ready ? hexA(tint, 0.7) : 'rgba(255,201,102,0.16)';
      ctx.lineWidth = ready ? 2 : 1.2;
      ctx.stroke();
      if (slot) {
        ctx.save();
        ctx.globalAlpha = ready ? 0.95 : 0.42;
        drawIcon(ctx, slot.def.icon.glyph, cx, cy - 1, r * 0.86, tint);
        ctx.restore();
      }
      if (slot && slot.cd > 0) {
        const frac = clamp(slot.cd / Math.max(0.01, slot.def.cd), 0, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.closePath();
        ctx.fillStyle = 'rgba(4,6,14,0.60)';
        ctx.fill();
        if (frac > 0.12) {
          ctx.fillStyle = '#f4ecd8';
          ctx.font = `700 ${Math.round(r * 0.52)}px ${FONT.ui}`;
          ctx.textAlign = 'center';
          ctx.fillText(slot.cd >= 10 ? String(Math.ceil(slot.cd)) : slot.cd.toFixed(1), cx, cy + r * 0.19);
        }
      }
      if (slot && typeof run?.energy === 'number' && run.energy < slot.def.cost) {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, TAU);
        ctx.fillStyle = 'rgba(12,10,30,0.30)';
        ctx.fill();
      }
      if (press > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2 + press * 6, 0, TAU);
        ctx.strokeStyle = hexA(tint, press * 0.5);
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      // slot number, tiny, top-left of each button — they are keyboard-mapped too
      if (prof.labels) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#e8dcc0';
        ctx.font = `700 ${Math.round(r * 0.30)}px ${FONT.ui}`;
        ctx.textAlign = 'left';
        ctx.fillText(String(b.index + 1), cx - r * 0.72, cy - r * 0.52);
        ctx.restore();
      }
    }

    // ── pause + fullscreen
    const small = (rect, icon, label) => {
      const rr = rect.w / 2;
      ctx.beginPath();
      ctx.arc(rect.x + rr, rect.y + rr, rr, 0, TAU);
      ctx.fillStyle = 'rgba(10,14,26,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,201,102,0.26)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      drawIcon(ctx, icon, rect.x + rr, rect.y + rr, rr * 1.5, 'rgba(244,236,216,0.85)');
      void label;
    };
    if (this.pauseRect.w > 0) small(this.pauseRect, 'pause');
    if (this.fullscreenRect && this.fullscreenRect.w > 0) small(this.fullscreenRect, opts.fullscreen ? 'compress' : 'expand');

    ctx.restore();
    void t;
  }
}
