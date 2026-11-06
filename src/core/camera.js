// Camera: keeps the arena centred, adds weighted trauma shake, and reports the
// world→screen transform. Pure math, no DOM.

import { clamp, lerp } from '../core/math.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.rot = 0;
    this.reduceMotion = false;
  }
  addTrauma(amount) {
    if (this.reduceMotion) return;
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }
  update(dt, t, focus, viewW, viewH) {
    this.zoom = lerp(this.zoom, this.targetZoom, Math.min(1, dt * 6));
    const halfW = viewW / (2 * this.zoom);
    const halfH = viewH / (2 * this.zoom);
    if (focus) {
      const tx = clamp(focus.x, halfW, Math.max(halfW, focus.worldW - halfW));
      const ty = clamp(focus.y, halfH, Math.max(halfH, focus.worldH - halfH));
      this.x = lerp(this.x, tx, Math.min(1, dt * 7));
      this.y = lerp(this.y, ty, Math.min(1, dt * 7));
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
