// Camera: keeps the arena centred, adds weighted trauma shake, and reports the
// world→screen transform. Pure math, no DOM.

import { clamp, lerp } from '../core/math.js';

/** Arena width, duplicated only as a framing hint for fitZoom (see below). */
const ARENA_W_HINT = 1570;

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.rot = 0;
    this.reduceMotion = false;
    // Opt-in: game.js turns this on for the run view. Off by default so any
    // existing camera test keeps its exact 1:1 transform.
    this.autoZoom = false;
    this.snapNext = false;
  }
  addTrauma(amount) {
    if (this.reduceMotion) return;
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }
  /**
   * Choose a zoom that frames the player sensibly for this viewport.
   *
   * The arena is 1570x660 and the camera used to sit at zoom 1 forever, so on a
   * landscape phone (where the CSS viewport is roughly 780x360) the visible
   * world was 780x360 of a much taller arena: the player could be near the top
   * or bottom of the screen with no context, and everything read as tiny. This
   * fits a comfortable *vertical* slice of the play field to the viewport and
   * clamps it, so a phone gets a closer, more legible view while a desktop keeps
   * seeing nearly the whole terrace.
   */
  fitZoom(viewW, viewH) {
    if (!viewW || !viewH) return 1;
    // Aim to show ~430 world units of height (the play strip is ~256, so this
    // leaves floor and header context), never more than 1.0 or less than 0.62.
    const want = viewH / 430;
    // Never let the width show less than 60% of the arena, or the player loses
    // sight of incoming waves on a very wide but short screen.
    const widest = Math.max(0.62, (viewW / ARENA_W_HINT) * 1.0);
    return clamp(Math.max(want, 0.62), 0.62, 1);
  }

  update(dt, t, focus, viewW, viewH) {
    if (this.autoZoom) this.targetZoom = this.fitZoom(viewW, viewH);
    this.zoom = lerp(this.zoom, this.targetZoom, Math.min(1, dt * 6));
    const halfW = viewW / (2 * this.zoom);
    const halfH = viewH / (2 * this.zoom);
    if (focus) {
      const tx = clamp(focus.x, halfW, Math.max(halfW, focus.worldW - halfW));
      const ty = clamp(focus.y, halfH, Math.max(halfH, focus.worldH - halfH));
      // Snapping on the first frame of a run avoids a visible slide from the
      // previous run's position — the camera looked like it was drifting.
      const k = this.snapNext ? 1 : Math.min(1, dt * 7);
      this.x = lerp(this.x, tx, k);
      this.y = lerp(this.y, ty, k);
    }
    // trauma decays quadratically: shake reads as impact, then settles fast
    this.trauma = Math.max(0, this.trauma - dt * 1.45);
    const shake = this.trauma * this.trauma;
    const amp = 22 * shake;
    this.shakeX = Math.sin(t * 61.7) * amp + Math.sin(t * 27.3) * amp * 0.4;
    this.shakeY = Math.cos(t * 53.1) * amp * 0.8 + Math.cos(t * 31.9) * amp * 0.3;
    this.rot = Math.sin(t * 41.3) * 0.012 * shake;
  }
  apply(ctx, viewW, viewH) {
    ctx.translate(viewW / 2 + this.shakeX, viewH / 2 + this.shakeY);
    ctx.rotate(this.rot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
  screenToWorld(sx, sy, viewW, viewH) {
    return {
      x: (sx - viewW / 2) / this.zoom + this.x,
      y: (sy - viewH / 2) / this.zoom + this.y,
    };
  }
}
