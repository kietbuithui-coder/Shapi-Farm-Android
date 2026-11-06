// Scene renderer. Layer order is deliberate so gameplay stays legible:
//   environment → floor shade → telegraphed danger → actors (sorted by y)
//   → projectiles → effects → particles → floating numbers → in-world HUD
// Enemies are drawn with a depth sort so front bodies overlap back bodies.

import { TAU, clamp, lerp, smooth, dist, hash01 } from '../core/math.js';
import { getEnvironment, drawAtmosphere, drawFloorShade, drawArenaTrim } from './env.js';
import { drawPlayerActor, drawEnemyActor, drawMinion, drawPickup, hexA } from './actors.js';
import { drawSlashArc, drawRing, drawTelegraph, drawBeam, drawLightning, drawImpact, drawParticle, drawFloating, drawTell } from './fx.js';
import { drawCatFace } from './catart.js';
import { drawIcon } from './icons.js';
import { ARENA } from '../systems/run.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.scale = 1;
    this.viewW = ARENA.w;
    this.viewH = ARENA.h;
    this.quality = 'high';
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };
  }

  resize(cssW, cssH, dpr) {
    const cap = this.quality === 'low' ? 1.25 : 2;
    this.dpr = Math.min(dpr || 1, cap);
    this.width = Math.max(320, Math.round(cssW * this.dpr));
    this.height = Math.max(240, Math.round(cssH * this.dpr));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.cssW = cssW;
    this.cssH = cssH;
  }

  /** Fit the 1180x660 arena into the viewport, filling the screen instead of
   *  letterboxing: the extra room becomes camera framing, not black bars. */
  fitArena(camera) {
    const byWidth = this.width / ARENA.w;
    const byHeight = this.height / ARENA.h;
    const k = Math.max(byWidth, byHeight);
    // PORTRAIT CORRECTION.
    //
    // Cover-fitting a 1180x660 arena into a 412x915 portrait viewport scales by
    // height (1.39) and then crops the sides, which left the player looking at
    // 183px of a 1180px arena — a slot canyon, and enemies entered from off
    // screen with no warning. In portrait we instead fit by WIDTH so the whole
    // arena width is legible, and let the extra height show sky/floor context.
    const tall = this.height > this.width * 1.15;
    // Portrait framing.
    //
    // Cover-fit (the old behaviour) scales by height and crops the sides: the
    // player saw 183px of a 1180px arena and enemies arrived from off screen.
    // Width-fit shows the arena but shrinks characters to specks and shows 190%
    // of the arena height (mostly sky).
    //
    // The compromise: fit by width with a mild zoom, then cap the visible
    // height at ~85% of the arena so the camera crops vertically instead of
    // zooming out. Characters stay readable and ~48% of the width is visible.
    let fit = tall ? byWidth * 1.28 : k;
    if (tall) {
      // Cap: the on-screen height of 0.85 * ARENA.h must fit the viewport.
      const heightCap = (this.height * 0.85) / (ARENA.h * 1.62);
      fit = Math.max(fit, heightCap);
    }
    // Never shrink so far that characters become specks.
    fit = Math.max(fit, byHeight * 0.30);
    // Scrolling view. Squeezing the whole 1570x660 arena into a landscape phone
    // put the play strip in a ~140px band and pushed its bottom-right corner
    // UNDER the skill pad, so enemies there were literally untouchable. When the
    // camera is allowed to scroll (autoZoom) the world is drawn at a readable
    // scale and shifted so the player stays framed; the camera supplies that
    // offset below. Without it, behaviour is exactly as before.
    const scrolling = !!camera?.autoZoom;
    if (scrolling) {
      // Aim for a comfortable band instead of the whole arena: roughly 300px of
      // on-screen height for the play strip plus context.
      const band = Math.max(byHeight * 1.45, this.height / 300);
      fit = Math.max(fit, band);
    }
    this.scale = fit * (camera?.zoom || 1);
    this.offsetX = (this.width - ARENA.w * fit) / 2;
    this.offsetY = (this.height - ARENA.h * fit) / 2;
    if (scrolling) {
      // Centre the camera's target, clamped so the world never slides past its
      // own edges (no void at the rim of the terrace).
      const s2 = this.scale;
      const halfW = this.width / (2 * s2);
      const halfH = this.height / (2 * s2);
      const cx = clamp(camera.x, halfW, Math.max(halfW, ARENA.w - halfW));
      const cy = clamp(camera.y, halfH, Math.max(halfH, ARENA.h - halfH));
      this.offsetX = this.width / 2 - cx * s2;
      // Bias the framing UP: the bottom of the screen is occupied by the thumb
      // pad (skills right, stick left), and a cat drawn there is behind a
      // button. Aim the action at 44% of the height instead of 50% so the
      // character and the floor band sit clear of the controls.
      // Smaller screens give the pad a bigger share, so bias further up there.
      const bias = this.height < 460 ? 0.40 : 0.44;
      this.offsetY = this.height * bias - cy * s2;
    }
    // On tall phones the playfield is taller than the screen: bias the crop down
    // so the ground band (where the action happens) stays in view.
    //
    // This must NOT run when scrolling: those offsets are the static crop for a
    // fixed framing, and applying them after the camera offset silently
    // overwrote it — which put the player hundreds of pixels off screen at the
    // edges of the arena.
    if (!scrolling) {
      const extraX = (ARENA.w * fit - this.width) / 2;
      const extraY = (ARENA.h * fit - this.height) / 2;
      if (extraY > 0) this.offsetY = -extraY * 0.72;
      if (extraX > 0) this.offsetX = -extraX * 0.5;
    }
    this.tall = tall;
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawWorld(run, pres, camera, t, opts = {}) {
    const ctx = this.ctx;
    // The camera looks at a 2x-magnified slice of the arena: characters are
    // ~140px tall on screen (the reference size for this genre) and the world
    // pans with the player instead of showing an empty 1180px room.
    const VIEW = 1.62;
    const env = getEnvironment(run.act, ARENA.w, ARENA.h, this.quality);
    const visW = this.width / Math.max(0.0001, this.scale) / VIEW;
    const visH = this.height / Math.max(0.0001, this.scale) / VIEW;
    // The terrace ends at ~80% of the arena; clamping the view to it keeps the
    // frame filled with stone instead of empty darkness under the floor.
    const floorBottom = ARENA.h * 0.80;
    const maxY = Math.max(visH / 2, floorBottom + 26 - visH / 2);
    const view = {
      x: clamp(camera.x || ARENA.w / 2, visW / 2, Math.max(visW / 2, ARENA.w - visW / 2)),
      y: clamp(camera.y || ARENA.h / 2, visH / 2, maxY),
    };
    // The view centre must map to the canvas centre. (Using the arena's centre
    // here breaks at any scale other than 1, which is every real device.)
    const sx = this.width / 2 - view.x * this.scale * VIEW + (camera.shakeX || 0) * 0.5;
    const sy = this.height / 2 - view.y * this.scale * VIEW + (camera.shakeY || 0) * 0.5;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(this.scale * VIEW, this.scale * VIEW);
    // Tall viewports see past the bottom edge of the 660px arena, which showed
    // as a black band under the terrace where the touch controls sit. Extend the
    // stone downward so the frame stays filled instead of cut off.
    if (visH > ARENA.h * 0.9) {
      ctx.fillStyle = '#0b0d16';
      ctx.fillRect(-ARENA.w, ARENA.h - 1, ARENA.w * 3, visH * 2);
    }
    ctx.drawImage(env, 0, 0, ARENA.w, ARENA.h);
    if (visH > ARENA.h * 0.9) {
      // seam + receding floor so the extension reads as stone, not a pasted block
      const g = ctx.createLinearGradient(0, ARENA.h, 0, ARENA.h + visH);
      g.addColorStop(0, 'rgba(28,26,40,0.92)');
      g.addColorStop(0.35, 'rgba(16,15,26,0.96)');
      g.addColorStop(1, 'rgba(5,6,13,1)');
      ctx.fillStyle = g;
      ctx.fillRect(-ARENA.w, ARENA.h, ARENA.w * 3, visH * 2);
    }
    drawAtmosphere(ctx, run.act, ARENA.w, ARENA.h, t, this.quality === 'low' ? 0.6 : 1);
    drawFloorShade(ctx, ARENA.w, ARENA.h, 512);
    drawArenaTrim(ctx, { x: 40, y: 150, w: ARENA.w - 80, h: 420 }, t, run.act.accent);

    // danger zones go under everything so the player reads them first
    this.drawZones(ctx, run, t);
    this.drawHazardsUnder(ctx, run, t);

    // ground decals: traps, shrine ring
    for (const tr of run.traps) this.drawTrap(ctx, tr, t);

    // floor contact: every body gets a soft pool so nothing reads as floating
    for (const e of run.enemies) this.floorPool(ctx, e.x, e.y + 2, (e.radius || 16) * (e.boss ? 2.4 : 1.5), 0.34);
    for (const m of run.minions) this.floorPool(ctx, m.x, m.y + 2, 16, 0.24);
    this.floorPool(ctx, run.player.x, run.player.y + 2, 30, 0.4);

    // sorted actor pass
    const actors = [];
    for (const e of run.enemies) actors.push({ y: e.y, draw: () => drawEnemyActor(ctx, e, t) });
    for (const m of run.minions) if (m.kind !== 'orb') actors.push({ y: m.y + 2, draw: () => drawMinion(ctx, m, t) });
    actors.push({ y: run.player.y, draw: () => drawPlayerActor(ctx, run, t) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    // airborne projectiles & orbit orbs above bodies
    this.drawProjectiles(ctx, run, t);
    for (const m of run.minions) if (m.kind === 'orb') drawMinion(ctx, m, t);

    this.drawPickups(ctx, run, t);
    this.drawFx(ctx, pres, t, run);
    if (this.quality !== 'low') this.drawParticles(ctx, pres);
    this.drawFloating(ctx, pres);
    this.drawTells(ctx, pres, run);

    // in-world labels: names only where identity matters (bosses)
    this.drawBossPlate(ctx, run);
    ctx.restore();
  }

  /** Soft elliptical contact shadow; the cheapest way to ground 2D sprites. */
  floorPool(ctx, x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(2,3,8,${alpha})`);
    g.addColorStop(0.6, `rgba(2,3,8,${alpha * 0.5})`);
    g.addColorStop(1, 'rgba(2,3,8,0)');
    ctx.save();
    ctx.scale(1, 0.34);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y / 0.34, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawZones(ctx, run, t) {
    for (const z of run.zones) {
      const life = z.time ? clamp(1 - z.t / z.time, 0, 1) : 1;
      ctx.save();
      if (z.kind === 'void') {
        const g = ctx.createRadialGradient(z.x, z.y, 2, z.x, z.y, z.radius);
        g.addColorStop(0, 'rgba(8,4,18,0.95)');
        g.addColorStop(0.55, hexA('#a48bff', 0.35));
        g.addColorStop(1, 'rgba(164,139,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, z.radius, z.radius * 0.6, 0, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = t * 2.4 + (i / 3) * TAU;
          ctx.beginPath();
          ctx.ellipse(z.x + Math.cos(a) * z.radius * 0.5, z.y + Math.sin(a) * z.radius * 0.3, 12, 5, a, 0, TAU);
          ctx.strokeStyle = hexA('#c9b0ff', 0.5);
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      } else if (z.kind === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + t * 0.8;
          const rr = z.radius * 0.5;
          const fx = z.x + Math.cos(a) * rr;
          const fy = z.y + Math.sin(a) * rr * 0.5;
          const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 22);
          g.addColorStop(0, `rgba(255,214,120,${0.5 * life})`);
          g.addColorStop(1, 'rgba(255,120,60,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fx, fy, 22, 0, TAU);
          ctx.fill();
        }
      } else {
        const col = z.slow > 0.5 ? '#8fa0c8' : z.tint || '#7ce0b0';
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, z.radius, z.radius * 0.55, 0, 0, TAU);
        ctx.fillStyle = hexA(col, 0.1);
        ctx.fill();
        ctx.strokeStyle = hexA(col, 0.45 * life);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 18;
        ctx.stroke();
        ctx.setLineDash([]);
        if (z.dps) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 4; i++) {
            const a = t * 1.6 + i * 1.6;
            const rr = z.radius * (0.25 + ((i * 0.23 + t * 0.4) % 0.7));
            ctx.beginPath();
            ctx.arc(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr * 0.5, 2.4, 0, TAU);
            ctx.fillStyle = hexA(col, 0.6 * life);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
  }

  drawHazardsUnder(ctx, run, t) {
    for (const hz of run.hazards) {
      const p = clamp(hz.t / Math.max(0.001, hz.delay), 0, 1);
      const color = hz.tint || hz.color || '#ff8f4d';
      if (hz.kind === 'beam') {
        // thin guide line that thickens as the shot lands
        ctx.save();
        ctx.translate(hz.x, hz.y);
        ctx.rotate(hz.angle);
        ctx.strokeStyle = hexA(color, 0.18 + p * 0.4);
        ctx.lineWidth = hz.width * (0.15 + p * 0.85);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(hz.length, 0);
        ctx.stroke();
        ctx.restore();
      } else if (hz.kind === 'line') {
        const c = hz.tint || hz.color || '#ff8f4d';
        ctx.save();
        ctx.strokeStyle = hexA(c, 0.16 + p * 0.34);
        ctx.lineWidth = hz.width * (0.2 + p * 0.8);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y);
        ctx.lineTo(hz.x2, hz.y2);
        ctx.stroke();
        ctx.restore();
      } else {
        drawTelegraph(ctx, hz.x, hz.y, hz.radius || 60, color, p);
        if (hz.kind === 'meteor' || hz.kind === 'star') {
          // incoming projectile arc: the shadow tells you where it lands
          const fall = 1 - p;
          const startY = hz.y - 420 * fall - 60;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(hz.x, startY, 1, hz.x, startY, 26);
          g.addColorStop(0, '#fff6e0');
          g.addColorStop(0.4, hexA(hz.tint || '#ff8f4d', 0.9));
          g.addColorStop(1, hexA(hz.tint || '#ff8f4d', 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(hz.x, startY, 26, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  drawTrap(ctx, tr, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.ellipse(tr.x, tr.y, tr.radius * 0.5, tr.radius * 0.28, 0, 0, TAU);
    ctx.strokeStyle = hexA(tr.tint || '#cfe4ff', 0.35 + pulse * 0.3);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 12;
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.arc(tr.x + Math.cos(a) * tr.radius * 0.4, tr.y + Math.sin(a) * tr.radius * 0.22, 2, 0, TAU);
      ctx.fillStyle = hexA(tr.tint || '#cfe4ff', 0.7);
      ctx.fill();
    }
    ctx.restore();
  }

  drawProjectiles(ctx, run, t) {
    for (const pr of run.projectiles) {
      const tint = pr.tint || '#ffffff';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // motion trail
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - Math.cos(pr.angle) * 20, pr.y - Math.sin(pr.angle) * 14);
      ctx.strokeStyle = hexA(tint, 0.4);
      ctx.lineWidth = pr.radius * 1.1;
      ctx.lineCap = 'round';
      ctx.stroke();
      const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, pr.radius * 2.6);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, hexA(tint, 0.9));
      g.addColorStop(1, hexA(tint, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (pr.shape === 'needle') {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.angle);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -1, 12, 2);
        ctx.restore();
      }
    }
  }

  drawPickups(ctx, run, t) {
    for (const k of run.pickups) drawPickup(ctx, k, t);
  }

  drawFx(ctx, pres, t, run) {
    if (!pres) return;
    for (const f of pres.fx) {
      const p = clamp(f.t / f.life, 0, 1);
      switch (f.kind) {
        case 'slash': drawSlashArc(ctx, f.x, f.y, f.radius, f.angle, f.spread, f.color, p); break;
        case 'ring': drawRing(ctx, f.x, f.y, f.radius, f.color, p, { fill: f.fill, width: f.kind === 'ring' ? 7 : 5 }); break;
        case 'telegraph': break; // hazards render their own
        case 'impact': drawImpact(ctx, f.x, f.y, f.radius, f.color, p); break;
        case 'beam': drawBeam(ctx, f.x, f.y, f.angle, f.length, f.width, f.color, p); break;
        case 'chain': drawLightning(ctx, f.points, f.color, p, f.x || 3); break;
        case 'lightning': drawLightning(ctx, f.points, f.color, p, f.seed || 1); break;
        case 'lineStrike': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA(f.color, (1 - p) * 0.9);
          ctx.lineWidth = f.width * (1 - p * 0.5);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'execute': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(f.x, f.y);
          const s = 1 + p * 0.8;
          ctx.scale(s, s);
          ctx.rotate(p * 1.4);
          ctx.strokeStyle = hexA('#ff4f5e', (1 - p) * 0.9);
          ctx.lineWidth = 4 * (1 - p);
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, 26, a, a + 0.9);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'mark': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = 18 + Math.sin(p * Math.PI) * 10;
          ctx.strokeStyle = hexA(f.color, (1 - p) * 0.8);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r, t * 2, t * 2 + 4.4);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'heal': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            const r = 18 + p * 26;
            ctx.beginPath();
            ctx.arc(f.x + Math.cos(a) * r * 0.6, f.y - p * 40 + Math.sin(a) * r * 0.4, 3 * (1 - p), 0, TAU);
            ctx.fillStyle = hexA(f.color, (1 - p) * 0.9);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        case 'shield': {
          drawRing(ctx, f.x, f.y, 40, f.color, p, { width: 3 });
          break;
        }
        case 'blink': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - p;
          ctx.strokeStyle = f.color;
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            const k = i / 3;
            ctx.beginPath();
            ctx.arc(lerp(f.x, f.x2, k), lerp(f.y - 24, f.y2 - 24, k), 16 * (1 - p), 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'dashTrail': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - p) * 0.5;
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y - 22, 22 * (1 - p), 30 * (1 - p), 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'drain': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const k = clamp(p * 1.4 - i * 0.2, 0, 1);
            ctx.beginPath();
            ctx.moveTo(lerp(f.x, f.x2, k), lerp(f.y, f.y2, k) - Math.sin(k * Math.PI) * 18);
            ctx.lineTo(lerp(f.x, f.x2, k + 0.1), lerp(f.y, f.y2, k + 0.1));
            ctx.strokeStyle = hexA(f.color, (1 - p) * 0.8);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'timeSlow': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - p) * 0.5;
          const g = ctx.createRadialGradient(f.x, f.y, f.radius * 0.3, f.x, f.y, f.radius);
          g.addColorStop(0, 'rgba(143,224,255,0)');
          g.addColorStop(0.85, hexA('#8fe0ff', 0.35));
          g.addColorStop(1, 'rgba(143,224,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.radius, f.radius * 0.6, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'castCharge': {
          // Ring collapsing inward onto the caster: the eye tracks it and
          // arrives at the origin right as the skill fires.
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = f.radius * (1 - p * 0.72);
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, r, r * 0.62, 0, 0, TAU);
          ctx.strokeStyle = hexA(f.color, 0.55 * (1 - p * 0.5));
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // soft inner pool so the origin reads even against bright floor
          const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, Math.max(6, r * 0.8));
          g.addColorStop(0, hexA(f.color, 0.22 * (1 - p)));
          g.addColorStop(1, hexA(f.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, r * 0.8, r * 0.8 * 0.62, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'castRune': {
          // A short spoke sweeping outward from the sigil ring.
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(f.x, f.y);
          ctx.rotate(f.angle);
          const r0 = f.radius * 0.72;
          const r1 = f.radius * (0.72 + 0.7 * (1 - Math.pow(1 - p, 2)));
          // wide soft body + bright core: two passes so the spoke survives a
          // bright background instead of dissolving into it.
          ctx.beginPath();
          ctx.moveTo(r0, 0);
          ctx.lineTo(r1, 0);
          ctx.strokeStyle = hexA(f.color, (1 - p) * 0.5);
          ctx.lineWidth = 5.5 * (1 - p * 0.4);
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(r0, 0);
          ctx.lineTo(r1, 0);
          ctx.strokeStyle = hexA('#ffffff', (1 - p) * 0.75);
          ctx.lineWidth = 1.6 * (1 - p * 0.4);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'castTell': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * (0.6 + p * 0.6), 0, TAU);
          ctx.strokeStyle = hexA(f.color, (1 - p) * 0.7);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'soul': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const y = f.y - p * 50;
          ctx.beginPath();
          ctx.arc(f.x, y, 6 * (1 - p) + 2, 0, TAU);
          ctx.fillStyle = hexA('#b48bff', (1 - p) * 0.9);
          ctx.fill();
          ctx.restore();
          break;
        }
        default: break;
      }
      void run;
    }
  }

  drawParticles(ctx, pres) {
    ctx.save();
    for (const p of pres.particles.items) {
      if (!p.live) continue;
      drawParticle(ctx, p);
    }
    ctx.restore();
  }

  drawFloating(ctx, pres) {
    if (!pres) return;
    for (const f of pres.floating) {
      drawFloating(ctx, f.text, f.x, f.y, {
        t: f.t / f.life, size: f.size, color: f.color, crit: f.crit,
      });
    }
  }

  drawTells(ctx, pres, run) {
    for (const [, tell] of pres.tells) {
      drawTell(ctx, tell.enemy, tell.t / tell.life, tell.color);
    }
    void run;
  }

  drawBossPlate(ctx, run) {
    const b = run.boss || run.miniBoss;
    if (!b) return;
    const name = b.name;
    if (!name) return;
    const label = this.lang === 'en' ? name.en : name.vi;
    ctx.save();
    ctx.font = '600 15px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,240,214,0.86)';
    ctx.strokeStyle = 'rgba(8,6,14,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, b.x, b.y - (b.def.radius || 40) * 2.6 - 18);
    ctx.fillText(label, b.x, b.y - (b.def.radius || 40) * 2.6 - 18);
    ctx.restore();
  }
}

export { drawCatFace, drawIcon };
void lerp; void smooth; void dist; void hash01;
