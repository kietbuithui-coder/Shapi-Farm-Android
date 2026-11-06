// Presentation bridge: subscribes to the simulation's events and turns them into
// visuals + audio + camera feel. Keeps gameplay completely free of draw code.

import { ParticleSystem } from './pool.js';
import { clamp, dist, rgbCss } from '../core/math.js';
import { audio } from '../audio/audio.js';
import { ENEMY_BY_ID } from '../data/enemies.js';

const FX_TTL = {
  slash: 0.3, ring: 0.55, telegraph: 1, beam: 0.42, impact: 0.45, chain: 0.34,
  nova: 0.7, blast: 0.5, lineStrike: 0.38, lightning: 0.3, zonePulse: 0.6,
  minionHit: 0.3, trap: 0.4, drain: 0.5, heal: 0.9, shield: 0.7, blink: 0.34,
  dashTrail: 0.5, execute: 0.6, mark: 0.7, soul: 0.6, timeSlow: 1, castTell: 0.5,
  summonRing: 0.8, burst: 0.55, shieldHit: 0.35, whiff: 0.2,
};

export class Presentation {
  constructor(run, { camera, settings } = {}) {
    this.run = run;
    this.camera = camera;
    this.settings = settings || { shake: 1, damageNumbers: true, reduceMotion: false };
    this.particles = new ParticleSystem(560);
    this.fx = [];
    this.floating = [];
    this.tells = new Map();
    this.rings = [];
    this.zoneFx = [];
    this.offs = [];
    this.binder();
    if (this.camera) this.camera.reduceMotion = !!this.settings.reduceMotion;
  }

  addFx(kind, opts) {
    this.fx.push({ kind, t: 0, life: opts.life || FX_TTL[kind] || 0.4, ...opts });
    if (this.fx.length > 90) this.fx.shift();
  }

  float(text, x, y, opts = {}) {
    if (!this.settings.damageNumbers && !opts.always) return;
    this.floating.push({ text, x, y, t: 0, life: opts.life || 0.75, ...opts });
  }

  binder() {
    const run = this.run;
    const on = (type, fn) => this.offs.push(run.on(type, fn));
    const pan = (x) => (x / 1180) * 2 - 1;

    on('fx:slash', ({ x, y, facing, crit, skill, angle: a }) => {
      const angleBase = a != null ? a : facing > 0 ? -0.35 : Math.PI + 0.35;
      this.addFx('slash', { x, y, radius: skill ? 96 : 74, angle: angleBase, spread: 1.7, color: crit ? '#ffe066' : '#ffd7a8', life: 0.2 });
      this.particles.burst(x, y, crit ? 7 : 4, { speed: 130, life: 0.25, size: 2.4, color: crit ? '#ffe066' : '#ffd0a0', spread: 1.6, dir: angleBase });
      audio.hit('slash', crit ? 0.9 : 0.5, pan(x));
    });
    on('fx:hit', ({ x, y, amount, crit }) => {
      this.particles.burst(x, y, crit ? 9 : 5, { speed: 150, life: 0.3, size: crit ? 3.4 : 2.3, color: crit ? ['#ffe066', '#fff3dc'] : ['#ffd0a0', '#f2a24b'], kind: 'spark' });
      if (this.camera) this.camera.addTrauma(crit ? 0.16 : 0.06 * (this.settings.shake ?? 1));
      if (amount >= 30) audio.hit('heavy', 0.8, pan(x));
    });
    // Damage numbers are capped and jittered: a busy screen must not become a
    // wall of digits. Player damage always shows (it is the feedback that matters).
    const recent = { t: 0, n: 0 };
    this._recent = recent;
    on('damage', (d) => {
      if (!(d.amount > 0.5)) return;
      const crit = d.crit;
      const isPlayer = d.target === 'player';
      if (!isPlayer) {
        recent.n = recent.t <= 0 ? 1 : recent.n + 1;
        recent.t = 0.1;
        if (recent.n > 3 && !crit && d.amount < 6) return;
      }
      const size = Math.min(24, 12 + Math.log2(Math.max(1, d.amount)) * 2.8);
      const jx = (Math.random() - 0.5) * 14;
      this.float(Math.round(d.amount).toString(), d.x + jx, d.y, { size, color: isPlayer ? '#ff8f9b' : crit ? '#ffe066' : '#fff3dc', crit });
    });
    on('fx:skill', (e) => {
      const color = e.tint || '#b48bff';
      this.addFx('castTell', { x: e.x, y: e.y, radius: 26, color, life: 0.3 });
      this.particles.burst(e.x, e.y, 6, { speed: 90, life: 0.35, size: 2.6, color, kind: 'glow', up: -20 });
    });
    on('fx:nova', ({ x, y, radius, color }) => {
      this.addFx('ring', { x, y, radius, color, life: 0.55, fill: true });
      this.particles.burst(x, y, 18, { speed: 240, life: 0.5, size: 3, color: [color, '#ffffff'], kind: 'spark' });
      if (this.camera) this.camera.addTrauma(0.16 * (this.settings.shake ?? 1));
      audio.hit('magic', 0.7, pan(x));
    });
    on('fx:blast', ({ x, y, radius, color }) => {
      this.addFx('ring', { x, y, radius, color, life: 0.5, fill: true });
      this.addFx('impact', { x, y, radius, color, life: 0.42 });
      this.particles.burst(x, y, 20, { speed: 260, life: 0.55, size: 3.4, color: [color, '#ffe066', '#ffffff'], kind: 'ember', up: -40 });
      if (this.camera) this.camera.addTrauma(0.22 * (this.settings.shake ?? 1));
      audio.hit('heavy', 1, pan(x));
    });
    on('fx:impact', ({ x, y, radius, color }) => {
      this.addFx('impact', { x, y, radius, color: color || '#ff8f4d' });
      this.addFx('ring', { x, y, radius, color: color || '#ff8f4d', life: 0.4 });
      this.particles.burst(x, y, 14, { speed: 220, life: 0.5, size: 3, color: [color || '#ff8f4d', '#ffe066'], kind: 'ember', grav: 260, up: -60 });
      if (this.camera) this.camera.addTrauma(0.3 * (this.settings.shake ?? 1));
      audio.hit('heavy', 1, pan(x));
    });
    on('fx:beam', ({ x, y, angle, length, width, color }) => {
      this.addFx('beam', { x, y, angle, length, width, color, life: 0.3 });
      this.particles.burst(x + Math.cos(angle) * 40, y + Math.sin(angle) * 40, 12, { speed: 180, life: 0.4, size: 2.6, color: [color, '#ffffff'], dir: angle, spread: 0.7, kind: 'spark' });
      audio.hit('magic', 0.9, pan(x));
    });
    on('fx:chain', ({ points, color }) => {
      this.addFx('chain', { points, color, life: 0.3 });
      audio.hit('magic', 0.8, pan(points[0]?.x || 0));
    });
    on('fx:lightning', ({ x, y, x2 }) => {
      this.addFx('lightning', { points: [{ x, y: 0 }, { x: (x + x2) / 2 + 12, y: y * 0.5 }, { x: x2, y }], color: '#ffe066', life: 0.3, seed: x });
      audio.hit('magic', 0.7, pan(x));
    });
    on('fx:telegraph', ({ x, y, radius, delay }) => {
      this.addFx('telegraph', { x, y, radius, color: '#ff8f4d', duration: delay, life: delay });
    });
    on('fx:zonePulse', ({ x, y, radius, color, kind }) => {
      const c = kind === 'void' ? '#a48bff' : color || '#7ce0b0';
      this.addFx('ring', { x, y, radius: radius * 0.3, color: c, life: 0.4 });
    });
    on('fx:heal', ({ x, y, color }) => {
      this.addFx('heal', { x, y, color: color || '#67e8a0', life: 0.9 });
      this.particles.burst(x, y - 10, 14, { speed: 60, life: 0.8, size: 2.6, color: ['#67e8a0', '#d8ffe8'], kind: 'glow', up: -70 });
      audio.pickup('hp');
    });
    on('fx:shield', ({ x, y }) => {
      this.addFx('shield', { x, y, color: '#8fe0ff', life: 0.7 });
      audio.tone?.({});
    });
    on('fx:shieldHit', ({ x, y }) => {
      this.addFx('ring', { x, y, radius: 44, color: '#8fe0ff', life: 0.3 });
      this.particles.burst(x, y - 16, 8, { speed: 140, life: 0.3, size: 2.4, color: '#bfefff', kind: 'shard' });
    });
    on('fx:blink', ({ x, y, x2, y2, color }) => {
      this.addFx('blink', { x, y, x2, y2, color: color || '#a48bff', life: 0.34 });
      this.particles.burst(x, y - 20, 9, { speed: 110, life: 0.4, size: 2.6, color: color || '#a48bff', kind: 'glow' });
      this.particles.burst(x2, y2 - 20, 9, { speed: 110, life: 0.4, size: 2.6, color: '#ffffff', kind: 'glow' });
      audio.hit('magic', 0.4, pan(x2));
    });
    on('fx:dashTrail', ({ x, y, color }) => {
      this.addFx('dashTrail', { x, y, color, life: 0.5 });
    });
    on('fx:minionHit', ({ x, y, color }) => {
      this.particles.burst(x, y, 4, { speed: 90, life: 0.25, size: 2.2, color: color || '#7ce0b0' });
    });
    on('fx:drain', ({ x, y, x2, y2, color }) => {
      this.addFx('drain', { x, y, x2, y2, color, life: 0.5 });
      audio.hit('magic', 0.4, pan(x2));
    });
    on('fx:trap', ({ x, y, color }) => {
      this.addFx('ring', { x, y, radius: 60, color: color || '#cfe4ff', life: 0.4 });
    });
    on('fx:execute', ({ x, y }) => {
      this.addFx('execute', { x, y, life: 0.55 });
      this.particles.burst(x, y, 16, { speed: 260, life: 0.6, size: 3.6, color: ['#ff4f5e', '#ffd7a8'], kind: 'shard', grav: 300 });
      if (this.camera) this.camera.addTrauma(0.34);
      audio.hit('heavy', 1, pan(x));
    });
    on('fx:mark', ({ x, y, color }) => {
      this.addFx('mark', { x, y, color: color || '#b48bff', life: 0.7 });
    });
    on('fx:summonRing', ({ x, y, color }) => {
      this.addFx('ring', { x, y, radius: 90, color, life: 0.8, fill: true });
      this.particles.burst(x, y, 16, { speed: 130, life: 0.7, size: 3, color, kind: 'glow', up: -50 });
      audio.hit('magic', 0.6, pan(x));
    });
    on('fx:burst', ({ x, y, color, radius }) => {
      this.addFx('ring', { x, y, radius, color, life: 0.5, fill: true });
      this.particles.burst(x, y, 14, { speed: 200, life: 0.5, size: 3, color: [color, '#ffd7a8'], kind: 'ember', grav: 260 });
    });
    on('fx:timeSlow', ({ x, y, radius, color }) => {
      this.addFx('timeSlow', { x, y, radius, color, life: 0.9 });
    });
    on('fx:lineStrike', ({ x, y, x2, y2, width, color }) => {
      this.addFx('lineStrike', { x, y, x2, y2, width, color: color || '#ff8f4d', life: 0.36 });
    });
    on('fx:whiff', ({ x, y }) => {
      this.particles.burst(x, y, 2, { speed: 40, life: 0.2, size: 1.6, color: 'rgba(200,210,230,0.5)' });
    });
    on('fx:castTell', ({ x, y, color }) => {
      this.addFx('castTell', { x, y, radius: 30, color, life: 0.4, burst: true });
    });

    // ── audio + camera hooks on gameplay events
    on('skill:cast', ({ id, slot }) => audio.ui('tap'));
    on('levelup', () => { audio.levelUp(); if (this.camera) this.camera.addTrauma(0.12); });
    on('player:hurt', ({ amount, x }) => {
      if (this.camera) this.camera.addTrauma(0.34 * (this.settings.shake ?? 1));
      this.particles.burst(x, 500, 10, { speed: 160, life: 0.4, size: 2.6, color: ['#ff5f6d', '#ffd7a8'], kind: 'spark', up: -60 });
      if (amount > 0) audio.hurt();
      this.float('-' + Math.round(amount), x, 460, { color: '#ff8f9b', size: 20, always: true });
    });
    on('player:dodge', () => audio.tone?.({}));
    on('player:revive', () => audio.victory());
    on('enemy:death', ({ x, y, elite }) => {
      this.particles.burst(x, y - 14, elite ? 20 : 10, { speed: elite ? 240 : 160, life: 0.55, size: elite ? 3.2 : 2.4, color: elite ? ['#ffe066', '#ff8f4d'] : ['#9f8fbf', '#5b5070'], kind: elite ? 'ember' : 'smoke', grav: 120 });
      if (elite) { audio.hit('heavy', 0.9, pan(x)); if (this.camera) this.camera.addTrauma(0.14); }
    });
    on('pickup', ({ kind, x, y }) => {
      if (kind === 'gold') this.particles.burst(x, y, 4, { speed: 90, life: 0.4, size: 2.6, color: '#ffc966', kind: 'coin' });
      audio.pickup(kind === 'gold' ? 'coin' : kind === 'hp' ? 'hp' : 'xp');
    });
    on('boss:spawn', () => {
      audio.bossWarn();
      if (this.camera) this.camera.addTrauma(0.5);
    });
    on('boss:phase', () => { audio.bossWarn(); if (this.camera) this.camera.addTrauma(0.3); });
    on('enemy:tell', ({ enemy, kind, color }) => {
      if (!enemy) return;
      this.tells.set(enemy.uid, { t: 0, life: kind === 'fan' ? 0.55 : 0.4, color: color || '#ff4f5e', enemy });
    });
    on('wave:begin', ({ wave }) => {
      if (wave === 1) return;
      audio.ui('open');
    });
    on('night:begin', () => {
      audio.startMusic('battle');
    });
    on('run:defeat', () => { audio.stopMusic(); audio.death(); });
    on('run:victory', () => { audio.stopMusic(); audio.victory(); });
    on('chest:open', ({ x, y }) => {
      this.particles.burst(x, y - 20, 22, { speed: 190, life: 0.8, size: 3, color: ['#ffe066', '#fff3dc'], kind: 'ember', up: -80, grav: 160 });
    });
  }

  update(dt) {
    if (this._recent) this._recent.t = Math.max(0, this._recent.t - dt);
    this.particles.update(dt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
    for (let i = this.floating.length - 1; i >= 0; i--) {
      const f = this.floating[i];
      f.t += dt;
      if (f.t >= f.life) this.floating.splice(i, 1);
    }
    for (const [uid, tell] of this.tells) {
      tell.t += dt;
      if (tell.t >= tell.life || tell.enemy.dead) this.tells.delete(uid);
    }
  }

  clear() {
    this.offs.forEach((off) => off());
    this.offs.length = 0;
    this.particles.clear();
    this.fx.length = 0;
    this.floating.length = 0;
    this.tells.clear();
  }

  emitTrail(e) {
    // ambient: burning enemies shed embers
    if (e.poisonTime > 0) this.particles.emit({ x: e.x + (Math.random() - 0.5) * 22, y: e.y - 20, vx: 0, vy: -22, life: 0.5, size: 2, color: '#9ad14b', kind: 'glow', drag: 0.94, grav: 0 });
    if (e.bleedTime > 0) this.particles.emit({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 16, vx: 0, vy: 30, life: 0.4, size: 1.8, color: '#b3202f', kind: 'ember', drag: 0.9, grav: 120 });
    void ENEMY_BY_ID; void dist; void clamp; void rgbCss;
  }
}
