// Icon set drawn with vector paths — one visual language across skills, perks,
// upgrades and the HUD. Every glyph is designed on a 24x24 grid, centred on the
// origin, filled with the caller's colour and outlined in ink so it reads at
// 14px on a phone and at 96px on a card.
//
// Rules kept by every glyph here:
//   · one dominant silhouette, at most two supporting shapes
//   · ink outline on every filled shape (never a floating flat blob)
//   · no letterforms, no emoji, no gradients, no external files

import { TAU } from '../core/math.js';

const INK = 'rgba(10,8,18,0.88)';
const LW = 1.5;

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ── primitives ─────────────────────────────────────────────────────────────
   fill() paints the current path, stroke() inks it. Keeping them separate lets a
   glyph fill several sub-paths and then outline once. */
function fill(ctx) { ctx.fill(); }
function stroke(ctx) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

/** A tapered blade/leaf from (x1,y1) to (x2,y2) with the given half-width. */
function blade(ctx, x1, y1, x2, y2, w1, w2, bend = 0.3) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const nx = -dy, ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * w1, oy = (ny / len) * w1;
  const bx = (nx / len) * w2, by = (ny / len) * w2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx + ox + dx * bend * 0.2, my + oy + dy * bend * 0.2, x2, y2);
  ctx.quadraticCurveTo(mx - bx + dx * bend * 0.2, my - by + dy * bend * 0.2, x1, y1);
  ctx.closePath();
}

function starPath(ctx, cx, cy, r1, r2, n, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 ? r2 : r1;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/* ── glyphs ───────────────────────────────────────────────────────────────── */
const G = {
  /* claws & fangs ------------------------------------------------------- */
  claw(ctx) {
    for (let i = -1; i <= 1; i++) {
      const o = i * 5.6;
      ctx.beginPath();
      ctx.moveTo(o - 2.6, -9.2);
      ctx.quadraticCurveTo(o + 2.2, -1, o + 0.8, 8.6);
      ctx.quadraticCurveTo(o - 2.6, 2, o - 4.2, -8.4);
      ctx.closePath();
      fill(ctx);
      stroke(ctx);
    }
  },
  claw3(ctx) {
    // three rakes with motion cuts
    for (let i = 0; i < 3; i++) {
      const y = -6 + i * 6;
      ctx.beginPath();
      ctx.moveTo(-9.4, y - 2.2);
      ctx.quadraticCurveTo(0, y + 1.6, 8.6, y - 1.8);
      ctx.quadraticCurveTo(0, y + 4.2, -9.4, y + 0.6);
      ctx.closePath();
      fill(ctx);
      stroke(ctx);
    }
  },
  fang(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8.2, -8.6);
    ctx.quadraticCurveTo(0, -5.2, 8.2, -8.6);
    ctx.quadraticCurveTo(6.4, 0.4, 2.6, 3.4);
    ctx.quadraticCurveTo(1.2, -0.4, 0.2, -4.2);
    ctx.quadraticCurveTo(-1.2, -0.4, -2.6, 3.4);
    ctx.quadraticCurveTo(-6.4, 0.4, -8.2, -8.6);
    ctx.closePath();
    fill(ctx);
    stroke(ctx);
  },
  skull(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7.4, 1.2);
    ctx.bezierCurveTo(-8.6, -8.4, 8.6, -8.4, 7.4, 1.2);
    ctx.quadraticCurveTo(6.6, 5.4, 4.6, 6.2);
    ctx.lineTo(4.6, 9.2);
    ctx.quadraticCurveTo(0, 10.4, -4.6, 9.2);
    ctx.lineTo(-4.6, 6.2);
    ctx.quadraticCurveTo(-6.6, 5.4, -7.4, 1.2);
    ctx.closePath();
    fill(ctx);
    stroke(ctx);
    // eye sockets punched in ink
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-3.4, -1.2, 2.1, 2.5, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3.4, -1.2, 2.1, 2.5, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillRect(-1.2, 6, 0.9, 3.2);
    ctx.fillRect(0.4, 6, 0.9, 3.2);
    ctx.restore();
  },

  /* paws & cats --------------------------------------------------------- */
  paw(ctx) {
    dot(ctx, 0, 3.4, 5.2);
    fill(ctx);
    stroke(ctx);
    for (const [x, y, r] of [[-6.6, -4.4, 2.5], [-2.2, -7.6, 2.6], [2.2, -7.6, 2.6], [6.6, -4.4, 2.5]]) {
      dot(ctx, x, y, r);
      fill(ctx);
      stroke(ctx);
    }
  },
  foot(ctx) {
    // paw print with three bean toes and one heel
    ctx.beginPath();
    ctx.moveTo(-5.6, 6.4);
    ctx.bezierCurveTo(-9.2, 3, -6.6, -2.4, -2.4, -1.2);
    ctx.bezierCurveTo(0, -0.4, 0, 3.4, 2.4, 2.8);
    ctx.bezierCurveTo(6, 2, 7.4, 7.6, 3.6, 8.8);
    ctx.bezierCurveTo(-0.4, 10, -2.8, 9, -5.6, 6.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    for (const [x, y, r] of [[-6.4, -6.4, 2.4], [-1.4, -8.6, 2.5], [3.8, -7.4, 2.5], [7.6, -3.4, 2.2]]) {
      dot(ctx, x, y, r);
      fill(ctx); stroke(ctx);
    }
  },
  kitten(ctx) {
    // cat head, ears up, whiskers — the game's signature mark
    ctx.beginPath();
    ctx.moveTo(-8.6, 2.4);
    ctx.quadraticCurveTo(-9.4, -8.6, 0, -8.6);
    ctx.quadraticCurveTo(9.4, -8.6, 8.6, 2.4);
    ctx.quadraticCurveTo(7.6, 9.4, 0, 9.4);
    ctx.quadraticCurveTo(-7.6, 9.4, -8.6, 2.4);
    ctx.closePath();
    fill(ctx);
    stroke(ctx);
    // ears sit on the silhouette
    ctx.beginPath();
    ctx.moveTo(-8.2, -4.2);
    ctx.lineTo(-7.2, -11.2);
    ctx.lineTo(-1.6, -7.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(8.2, -4.2);
    ctx.lineTo(7.2, -11.2);
    ctx.lineTo(1.6, -7.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-3.1, 0.4, 1.5, 1.9, 0.1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3.1, 0.4, 1.5, 1.9, -0.1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-1.5, 4.4);
    ctx.quadraticCurveTo(0, 6.2, 1.5, 4.4);
    ctx.quadraticCurveTo(0, 3.4, -1.5, 4.4);
    ctx.fill();
    ctx.restore();
  },
  lion(ctx) {
    // mane ring + inner face
    starPath(ctx, 0, 0.4, 10.4, 7.4, 9, -Math.PI / 2);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,18,0.28)';
    dot(ctx, 0, 0.6, 4.6);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, -1.8, -0.6, 1.1);
    ctx.fill();
    dot(ctx, 1.8, -0.6, 1.1);
    ctx.fill();
    ctx.restore();
  },
  spirit(ctx) {
    // cat wisp with a trailing tail
    ctx.beginPath();
    ctx.moveTo(-6.6, 8.6);
    ctx.quadraticCurveTo(-8.4, -0.4, -3.4, -6.2);
    ctx.quadraticCurveTo(0, -10.4, 3.4, -6.2);
    ctx.quadraticCurveTo(8.4, -0.4, 6.6, 8.6);
    ctx.quadraticCurveTo(3.2, 4.6, 0, 8.6);
    ctx.quadraticCurveTo(-3.2, 4.6, -6.6, 8.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-3.4, -5.2); ctx.lineTo(-2.6, -9.6); ctx.lineTo(0.2, -7.2); ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(3.4, -5.2); ctx.lineTo(2.6, -9.6); ctx.lineTo(-0.2, -7.2); ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, -2, 0.6, 1.3); ctx.fill();
    dot(ctx, 2, 0.6, 1.3); ctx.fill();
    ctx.restore();
  },

  /* strikes ------------------------------------------------------------- */
  pounce(ctx) {
    // leaping cat arc + landing streak
    ctx.beginPath();
    ctx.moveTo(-9.6, 6.6);
    ctx.quadraticCurveTo(-2.4, -3.6, 6.4, -6.4);
    ctx.quadraticCurveTo(3.2, 0.6, 8.6, 6.2);
    ctx.quadraticCurveTo(-1.6, 4.4, -9.6, 6.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-9.8, 9.4 + i * 0.2 - i * 2.6);
      ctx.lineTo(-3.4 + i * 3.2, 9.4 - i * 2.6);
      ctx.stroke();
    }
    ctx.restore();
  },
  whirl(ctx) {
    // spin: three curved blades around a hub
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * TAU);
      ctx.beginPath();
      ctx.moveTo(0.8, -2.2);
      ctx.quadraticCurveTo(6.6, -8.6, 9.2, -1.6);
      ctx.quadraticCurveTo(3.6, 0.2, 0.8, -2.2);
      ctx.closePath();
      fill(ctx); stroke(ctx);
      ctx.restore();
    }
    dot(ctx, 0, 0, 2);
    fill(ctx); stroke(ctx);
  },
  wave(ctx) {
    for (let i = 0; i < 3; i++) {
      const r = 4 + i * 3;
      ctx.beginPath();
      ctx.arc(0, 6.6, r, -Math.PI * 0.84, -Math.PI * 0.16);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.8 - i * 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    dot(ctx, 0, 6.4, 2.4);
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-9.6, 9.4);
    ctx.lineTo(9.6, 9.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  },
  dagger(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -10.4);
    ctx.quadraticCurveTo(3, -4, 2.2, 3.4);
    ctx.lineTo(-2.2, 3.4);
    ctx.quadraticCurveTo(-3, -4, 0, -10.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    rounded(ctx, -5.8, 3.2, 11.6, 2.6, 1.2);
    fill(ctx); stroke(ctx);
    rounded(ctx, -1.5, 5.8, 3, 4.6, 1.4);
    fill(ctx); stroke(ctx);
  },
  needle(ctx) {
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -10.4);
    ctx.lineTo(2.2, 4.2);
    ctx.quadraticCurveTo(0, 5.6, -2.2, 4.2);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 2.2, 0.7, 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(5.4, 7, 2.4, 10.6, 6.4, 10.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.restore();
  },
  boomerang(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8.6, 3.4);
    ctx.quadraticCurveTo(-2, -8.6, 8.4, -5.4);
    ctx.quadraticCurveTo(1, -3.6, -3.2, 5.2);
    ctx.quadraticCurveTo(-5.8, 6.4, -8.6, 3.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 10.6, -2.5, -1.5);
    ctx.stroke();
    ctx.restore();
  },
  spikes(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -7.8 + i * 5.2;
      ctx.moveTo(x - 2, 6.2);
      ctx.lineTo(x, -8);
      ctx.lineTo(x + 2, 6.2);
      ctx.closePath();
    }
    fill(ctx); stroke(ctx);
    rounded(ctx, -10, 5, 20, 3.4, 1.6);
    fill(ctx); stroke(ctx);
  },
  hairball(ctx) {
    // a knotted ball of fur: one lumpy silhouette, not six overlapping discs
    ctx.beginPath();
    const pts = 9;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * TAU;
      const r = 8.2 + Math.sin(i * 2.4) * 1.9;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 3 + i * 2.2, i * 1.1, i * 1.1 + 2.4);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* projectiles --------------------------------------------------------- */
  orb(ctx) {
    dot(ctx, 0, 0, 8.4);
    fill(ctx); stroke(ctx);
    // highlight crescent reads as a sphere rather than a flat disc
    ctx.beginPath();
    ctx.arc(-2.4, -2.8, 3.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.4, 3, 4.4, 0, TAU);
    ctx.fillStyle = 'rgba(10,8,18,0.2)';
    ctx.fill();
  },
  bolt(ctx) {
    ctx.beginPath();
    ctx.moveTo(2.6, -10.6);
    ctx.lineTo(-7.2, 1.4);
    ctx.lineTo(-0.8, 1.4);
    ctx.lineTo(-3.2, 10.6);
    ctx.lineTo(7.2, -2.2);
    ctx.lineTo(0.6, -2.2);
    ctx.closePath();
    fill(ctx); stroke(ctx);
  },
  boltstep(ctx) {
    ctx.save();
    ctx.scale(0.78, 0.78);
    ctx.translate(-1.6, 0);
    G.bolt(ctx);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(6.4 + i * 2.6, -5.4 + i * 1.6);
      ctx.lineTo(9.6 + i * 2.2, -5.4 + i * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  },
  flame(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -10.6);
    ctx.bezierCurveTo(6.2, -4, 8.4, 1.6, 5.4, 6.4);
    ctx.bezierCurveTo(2.6, 10.6, -2.6, 10.6, -5.4, 6.4);
    ctx.bezierCurveTo(-8.4, 1.6, -3.6, -2, 0, -10.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(0, -1.6);
    ctx.bezierCurveTo(3, 1.4, 3.4, 4.4, 1.6, 6.6);
    ctx.bezierCurveTo(-0.6, 8.6, -3.2, 6.4, -2.6, 3.4);
    ctx.bezierCurveTo(-2.2, 1.4, -1, 0.6, 0, -1.6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fill();
  },
  snow(ctx) {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -9.4);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -6.2);
      ctx.lineTo(2.4, -8.2);
      ctx.moveTo(0, -6.2);
      ctx.lineTo(-2.4, -8.2);
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.restore();
    }
    dot(ctx, 0, 0, 2.2);
    fill(ctx);
    ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke();
  },
  moonbeam(ctx) {
    ctx.beginPath();
    ctx.moveTo(-3.4, -10.4);
    ctx.quadraticCurveTo(-0.4, -1, 2.6, 10.4);
    ctx.quadraticCurveTo(6.8, 0.6, 4.4, -10.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-8.6, 8.2);
    ctx.lineTo(-4, 6.4);
    ctx.moveTo(-9.4, 1.4);
    ctx.lineTo(-5.2, 1.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },
  meteor(ctx) {
    // falling star: bright head, three tapering trails
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-9.6 + i * 0.2, -7.4 + i * 1.1);
      ctx.quadraticCurveTo(-4.2, -3.4 + i * 1.4, 1.4, -0.6 + i * 1.6);
      ctx.lineWidth = 2.6 - i * 0.5;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    dot(ctx, 5, 3.4, 4.8);
    fill(ctx); stroke(ctx);
  },
  fireorbit(ctx) {
    // blazing sun with an orbiting ember
    dot(ctx, 0, 0, 4.4);
    fill(ctx); stroke(ctx);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5.6, Math.sin(a) * 5.6);
      ctx.lineTo(Math.cos(a) * (8.6 + (i % 2) * 1.2), Math.sin(a) * (8.6 + (i % 2) * 1.2));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.6, 4.8, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    dot(ctx, 8.6, -3.4, 2);
    fill(ctx); stroke(ctx);
  },
  well(ctx) {
    // gravity well: nested rings pulled inward + core
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, i * 3.2, -0.6, Math.PI * 1.4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6 - i * 0.5;
      ctx.stroke();
    }
    dot(ctx, 0, 0, 2.6);
    fill(ctx); stroke(ctx);
  },
  void(ctx) {
    // black hole: ink core inside a lit ring, one arm escaping
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.6, 0, TAU);
    ctx.stroke();
    ctx.restore();
    dot(ctx, 0, 0, 6.4);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, 0, 0, 4.4);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, -4.4);
    ctx.quadraticCurveTo(5.6, -4, 7.4, 1.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  },

  /* marks & magic ------------------------------------------------------- */
  sigil(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 9.4, 0, TAU);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6.2);
    ctx.lineTo(5.4, 3.2);
    ctx.lineTo(-5.4, 3.2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  },
  hex(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * TAU;
      const x = Math.cos(a) * 9.4, y = Math.sin(a) * 9.4;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i / 3) * TAU;
      const x = Math.cos(a) * 3.6, y = Math.sin(a) * 3.6;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  aura(ctx) {
    // figure inside a warding ring
    ctx.beginPath();
    ctx.moveTo(0, -8.6);
    ctx.quadraticCurveTo(4.6, -8.6, 4.6, -3.4);
    ctx.quadraticCurveTo(4.6, 0, 0, 0.6);
    ctx.quadraticCurveTo(-4.6, 0, -4.6, -3.4);
    ctx.quadraticCurveTo(-4.6, -8.6, 0, -8.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-6.4, 8.4);
    ctx.quadraticCurveTo(-6.4, 2.4, 0, 2.4);
    ctx.quadraticCurveTo(6.4, 2.4, 6.4, 8.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 10.4, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  },
  trap(ctx) {
    // bear-trap jaws
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.scale(dir, 1);
      ctx.beginPath();
      ctx.moveTo(0, 6.4);
      ctx.quadraticCurveTo(8.6, 6.4, 9.6, -2.4);
      ctx.quadraticCurveTo(4.4, 1.6, 0, 1.2);
      ctx.closePath();
      fill(ctx); stroke(ctx);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(2 + i * 2.4, 1.6);
        ctx.lineTo(2.6 + i * 2.4, -2.6);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.restore();
    }
    rounded(ctx, -2.4, 6, 4.8, 3.6, 1.2);
    fill(ctx); stroke(ctx);
  },
  mirror(ctx) {
    // hand mirror: framed glass with a handle
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-7.4, -9.4);
    ctx.lineTo(7.4, -9.4);
    ctx.quadraticCurveTo(8.6, -1.4, 0, 1.6);
    ctx.quadraticCurveTo(-8.6, -1.4, -7.4, -9.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-2, -7.6);
    ctx.lineTo(-4.4, -3.4);
    ctx.lineTo(-1.6, -2.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    rounded(ctx, -1.6, 1.2, 3.2, 5.4, 1.4);
    fill(ctx); stroke(ctx);
    rounded(ctx, -4.6, 6, 9.2, 3.4, 1.6);
    fill(ctx); stroke(ctx);
  },
  soul(ctx) {
    // wisp with two trailing tails
    ctx.beginPath();
    ctx.moveTo(0, -10.4);
    ctx.bezierCurveTo(6.4, -7.4, 8.6, -2.4, 6.6, 2.6);
    ctx.bezierCurveTo(5, 6.6, 2.6, 8.4, 0, 9.2);
    ctx.bezierCurveTo(-2.6, 8.4, -5, 6.6, -6.6, 2.6);
    ctx.bezierCurveTo(-8.6, -2.4, -6.4, -7.4, 0, -10.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, -2.6, -1.2, 1.3); ctx.fill();
    dot(ctx, 2.6, -1.2, 1.3); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-1.2, 9); ctx.quadraticCurveTo(-3.4, 10.6, -5.4, 9.4);
    ctx.moveTo(1.2, 9); ctx.quadraticCurveTo(3.4, 10.6, 5.4, 9.4);
    ctx.stroke();
    ctx.restore();
  },
  bloodmoon(ctx) {
    // crescent with three falling drops
    ctx.beginPath();
    ctx.arc(-0.6, -1.6, 8.6, -Math.PI * 0.86, Math.PI * 0.42);
    ctx.arc(2.6, -1.6, 7.4, Math.PI * 0.42, -Math.PI * 0.86, true);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      const x = 5.4 + i * 3.4, y = 5.4 + i * 2.4;
      ctx.moveTo(x, y - 3.2);
      ctx.quadraticCurveTo(x + 2.2, y + 0.4, x, y + 1.6);
      ctx.quadraticCurveTo(x - 2.2, y + 0.4, x, y - 3.2);
      ctx.closePath();
      fill(ctx); stroke(ctx);
    }
  },
  bubble(ctx) {
    dot(ctx, 0, 0, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    fill(ctx);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    stroke(ctx);
    ctx.beginPath();
    ctx.arc(-2.2, -1.4, 4.6, Math.PI * 1.08, Math.PI * 1.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  },
  stone(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9, 2.6);
    ctx.lineTo(-5.4, -7.2);
    ctx.lineTo(3.4, -9.4);
    ctx.lineTo(9.4, -1.6);
    ctx.lineTo(6.4, 8.4);
    ctx.lineTo(-4.4, 8.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5.4, -7.2); ctx.lineTo(-1.4, -0.6); ctx.lineTo(-9, 2.6);
    ctx.moveTo(-1.4, -0.6); ctx.lineTo(3.4, -9.4);
    ctx.moveTo(-1.4, -0.6); ctx.lineTo(6.4, 8.4);
    ctx.moveTo(-1.4, -0.6); ctx.lineTo(9.4, -1.6);
    ctx.stroke();
    ctx.restore();
  },
  shield(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -10.4);
    ctx.quadraticCurveTo(6, -8, 9.4, -7.2);
    ctx.quadraticCurveTo(9.4, 4.4, 0, 10.4);
    ctx.quadraticCurveTo(-9.4, 4.4, -9.4, -7.2);
    ctx.quadraticCurveTo(-6, -8, 0, -10.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(0, -6.6);
    ctx.lineTo(0, 6.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  },
  heart(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 9.4);
    ctx.bezierCurveTo(-11.4, 1.4, -8.6, -9.6, -3.2, -9.2);
    ctx.bezierCurveTo(-1.2, -9, -0.4, -7.6, 0, -6.2);
    ctx.bezierCurveTo(0.4, -7.6, 1.2, -9, 3.2, -9.2);
    ctx.bezierCurveTo(8.6, -9.6, 11.4, 1.4, 0, 9.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
  },
  lives(ctx) {
    // nine lives: cat head over a row of pips
    ctx.save();
    ctx.translate(0, -1.8);
    ctx.scale(0.82, 0.82);
    G.kitten(ctx);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      dot(ctx, -4.6 + i * 4.6, 9.6, 1.7);
      fill(ctx);
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.stroke();
    }
  },
  drain(ctx) {
    // droplets pulled into a mouth
    dot(ctx, 0, 1.6, 4.6);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, 0, 1.6, 2);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.9;
      const x = Math.cos(a) * 8.4, y = Math.sin(a) * 8.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 2.6);
      ctx.quadraticCurveTo(x + 1.8, y + 0.4, x, y + 1.4);
      ctx.quadraticCurveTo(x - 1.8, y + 0.4, x, y - 2.6);
      ctx.closePath();
      fill(ctx); stroke(ctx);
    }
  },
  leaf(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8.4, 8.4);
    ctx.bezierCurveTo(-9.4, -1.6, -1.4, -9.4, 8.6, -9.4);
    ctx.bezierCurveTo(9.4, 1.4, 1.4, 9.4, -8.4, 8.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-8.4, 8.4);
    ctx.lineTo(6.6, -6.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  },
  clover(ctx) {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU + Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -5.8, 3.6, 5, 0, 0, TAU);
      fill(ctx); stroke(ctx);
      ctx.restore();
    }
    dot(ctx, 0, 0, 2.2);
    fill(ctx); stroke(ctx);
  },

  /* instruments & objects ----------------------------------------------- */
  star(ctx) {
    starPath(ctx, 0, 0.6, 10.2, 4.4, 5);
    fill(ctx); stroke(ctx);
  },
  coin(ctx) {
    dot(ctx, 0, 0, 9.2);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.6, -3.6);
    ctx.lineTo(-2.6, 3.6);
    ctx.moveTo(2.6, -3.6);
    ctx.lineTo(2.6, 3.6);
    ctx.stroke();
    ctx.restore();
  },
  ember(ctx) {
    // a live coal: glowing body, cracked facets
    ctx.beginPath();
    ctx.moveTo(-7.4, 4.6);
    ctx.quadraticCurveTo(-8.6, -5.4, 0, -8.4);
    ctx.quadraticCurveTo(8.6, -5.4, 7.4, 4.6);
    ctx.quadraticCurveTo(3.4, 9.4, 0, 8.4);
    ctx.quadraticCurveTo(-3.4, 9.4, -7.4, 4.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3.4, -4.6); ctx.lineTo(0, 0.4); ctx.lineTo(3.6, -3.6);
    ctx.moveTo(0, 0.4); ctx.lineTo(1.6, 6.2);
    ctx.stroke();
    ctx.restore();
  },
  clock(ctx) {
    dot(ctx, 0, 0, 9.4);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -5.4);
    ctx.moveTo(0, 0); ctx.lineTo(4, 1.8);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      dot(ctx, Math.cos(a) * 7, Math.sin(a) * 7, 0.9);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    ctx.restore();
  },
  veil(ctx) {
    // curtain drawn for the pause button
    ctx.beginPath();
    ctx.moveTo(-8.6, -9.4);
    ctx.lineTo(8.6, -9.4);
    ctx.quadraticCurveTo(6.6, 0, 7.6, 9.4);
    ctx.quadraticCurveTo(2.4, 6.4, 0, 9.4);
    ctx.quadraticCurveTo(-2.4, 6.4, -7.6, 9.4);
    ctx.quadraticCurveTo(-6.6, 0, -8.6, -9.4);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4.4, -9.4);
    ctx.quadraticCurveTo(-3.4, 1, -4.4, 8);
    ctx.moveTo(4.4, -9.4);
    ctx.quadraticCurveTo(3.4, 1, 4.4, 8);
    ctx.stroke();
    ctx.restore();
  },
  wind(ctx) {
    for (let i = 0; i < 3; i++) {
      const y = -6.2 + i * 5.6;
      const len = 9.4 - i * 1.8;
      ctx.beginPath();
      ctx.moveTo(-9.4, y);
      ctx.lineTo(len - 4, y);
      ctx.arc(len - 4, y + 2.4, 2.4, -Math.PI / 2, Math.PI / 2, true);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },
  blink(ctx) {
    // eye mid-blink: lid line with lashes and two motion ticks
    ctx.beginPath();
    ctx.moveTo(-9.6, -0.6);
    ctx.quadraticCurveTo(0, 6.4, 9.6, -0.6);
    ctx.quadraticCurveTo(0, -2.6, -9.6, -0.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4.8, 3.2);
      ctx.lineTo(i * 6, 7.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-11, -6.4); ctx.lineTo(-6.6, -6.4);
    ctx.moveTo(-11, -9.8); ctx.lineTo(-7.6, -9.8);
    ctx.stroke();
    ctx.restore();
  },
  leap(ctx) {
    // arc over a gap: launch, apex, dust
    ctx.beginPath();
    ctx.moveTo(-10, 6.4);
    ctx.quadraticCurveTo(0, -12, 8.6, 0.8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.6, 0.8);
    ctx.lineTo(4.8, 0.2);
    ctx.moveTo(8.6, 0.8);
    ctx.lineTo(9.2, -3.2);
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      dot(ctx, -8.4 + i * 3, 8.8 - Math.abs(i - 1) * 0.8, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.0)';
      ctx.fillStyle = INK;
      ctx.fill();
    }
  },
  snack(ctx) {
    // a fish, the pickup for health
    ctx.beginPath();
    ctx.moveTo(-9.4, 0);
    ctx.quadraticCurveTo(-2.4, -7.4, 5.4, -3.6);
    ctx.quadraticCurveTo(7.6, 0, 5.4, 3.6);
    ctx.quadraticCurveTo(-2.4, 7.4, -9.4, 0);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(5.4, -3.6);
    ctx.lineTo(9.6, -6.4);
    ctx.lineTo(9.2, 0);
    ctx.lineTo(9.6, 6.4);
    ctx.lineTo(5.4, 3.6);
    ctx.closePath();
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, -4.6, -0.8, 1.3);
    ctx.fill();
    ctx.restore();
  },
  yarn(ctx) {
    dot(ctx, 0, 0, 8.6);
    fill(ctx); stroke(ctx);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.2 - Math.abs(i) * 1.4, 3 + Math.abs(i) * 2.4, i * 0.7, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(7.4, 4.4);
    ctx.quadraticCurveTo(10.4, 7.6, 8.4, 10.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  },
  target(ctx) {
    for (const [r, ink] of [[9.4, true], [5.8, true], [2.2, false]]) {
      dot(ctx, 0, 0, r);
      if (ink) { fill(ctx); stroke(ctx); }
    }
    ctx.save();
    ctx.fillStyle = INK;
    dot(ctx, 0, 0, 2.2);
    ctx.fill();
    ctx.restore();
  },
  magnet(ctx) {
    // horseshoe magnet with two poles
    ctx.save();
    ctx.lineWidth = 5.2;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, -1.4, 6.6, Math.PI * 0.98, Math.PI * 2.02);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, -1.4, 6.6, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    for (const dx of [-6.6, 2.2]) {
      rounded(ctx, dx, 4.4, 4.4, 5.4, 1.2);
      fill(ctx); stroke(ctx);
    }
  },
  /* chrome -------------------------------------------------------------- */
  back(ctx) {
    ctx.beginPath();
    ctx.moveTo(2.6, -8.6);
    ctx.lineTo(-5.4, 0);
    ctx.lineTo(2.6, 8.6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
  pause(ctx) {
    rounded(ctx, -6.4, -8.4, 4.6, 16.8, 2);
    fill(ctx); stroke(ctx);
    rounded(ctx, 1.8, -8.4, 4.6, 16.8, 2);
    fill(ctx); stroke(ctx);
  },
  play(ctx) {
    ctx.beginPath();
    ctx.moveTo(-5.4, -9);
    ctx.quadraticCurveTo(0.6, -5.2, 8.2, 0);
    ctx.quadraticCurveTo(0.6, 5.2, -5.4, 9);
    ctx.closePath();
    fill(ctx); stroke(ctx);
  },
  close(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
    ctx.moveTo(7, -7); ctx.lineTo(-7, 7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  },
};

const GLYPH_ALIASES = { claw3: 'claw3', paw: 'paw' };

/** Draw an icon centred at (x,y). */
export function drawIcon(ctx, name, x, y, size, color = '#f4ecd8', opts = {}) {
  const fn = G[GLYPH_ALIASES[name] || name] || G.paw;
  ctx.save();
  ctx.translate(x, y);
  const k = size / 24;
  ctx.scale(k, k);
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 18 / k;
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  fn(ctx);
  ctx.restore();
}

export const ICON_NAMES = Object.keys(G);
export { rounded, GLYPH_ALIASES };
