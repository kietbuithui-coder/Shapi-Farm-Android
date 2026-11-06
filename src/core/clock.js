// Deterministic fixed-timestep clock with catch-up clamping.
export class Clock {
  constructor({ step = 1 / 60, maxCatchUp = 5 } = {}) {
    this.step = step;
    this.maxCatchUp = maxCatchUp;
    this.accumulator = 0;
    this.timeScale = 1;
    this.elapsed = 0;
    this.ticks = 0;
  }
  /**
   * @param {number} deltaSeconds real time since last frame (clamped upstream)
   * @param {(dt:number)=>void} tick fixed-step callback
   * @returns {number} interpolation alpha 0..1 for rendering
   */
  advance(deltaSeconds, tick) {
    const dt = Math.min(deltaSeconds, 0.25) * this.timeScale;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxCatchUp) {
      tick(this.step);
      this.accumulator -= this.step;
      this.elapsed += this.step;
      this.ticks++;
      steps++;
    }
    if (steps >= this.maxCatchUp) this.accumulator = 0;
    return this.accumulator / this.step;
  }
  reset() { this.accumulator = 0; this.elapsed = 0; this.ticks = 0; }
}
