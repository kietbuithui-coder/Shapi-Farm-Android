// Actor rendering: turns run entities into poses, then delegates to the rigs.
// One place decides how a state (idle/walk/attack/hurt/dead) maps to pose data,
// so animation timing stays consistent across all ten cats and every creature.

import { clamp, lerp, smooth, TAU, hash01 } from '../core/math.js';
import { drawCat, drawCatFace } from './catart.js';
import { skillActionPose } from '../systems/skill-animation.js';
import { drawCreature, drawCreatureShadow } from './creatureart.js';

/** Build a pose for the player cat from simulation state. */
export function playerPose(run, t) {
  const p = run.player;
  const speed = Math.hypot(p.vx, p.vy);
  const moving = speed > 12;
  const gait = clamp(speed / 230, 0, 1.35);
  const attack = p.attackAnim || 0;
  const hurt = clamp(p.hurtFlash || 0, 0, 1);
  const crouch = p.crouch || 0;
  const dead = p.alive ? 0 : 1;
  const actionPose = skillActionPose(p.skillAction);
  return {
    t,
    gait: moving ? gait : 0,
    lean: p.dashTime > 0 ? p.facing * 0.6 : moving ? clamp(p.vx / 320, -0.6, 0.6) : 0,
    squash: 1 - hurt * 0.08 + (p.dashTime > 0 ? -0.05 : 0),
    headTilt: p.aim ? clamp(Math.sin(p.aim) * 0.12, -0.2, 0.2) : 0,
    tail: (t * 0.4) % 1,
    ears: moving ? 0.1 : Math.sin(t * 1.7) * 0.08,
    blink: blinkCycle(t, 0.72 + (p.uid || 0) * 0.01),
    mouth: attack > 0.3 ? 0.8 : 0,
    crouch,
    hurt,
    attack,
    cast: attack > 0.3 ? attack * 0.6 : 0,
    dash: p.dashTime > 0 ? 1 : 0,
    dead,
    ...(actionPose || {}),
  };
}

export function blinkCycle(t, phase = 0.7) {
  // a short blink every ~3.4s, felt rather than noticed
  const cycle = (t * 0.29 + phase) % 1;
  if (cycle > 0.965) return Math.sin((cycle - 0.965) / 0.035 * Math.PI);
  return 0;
}

export function drawPlayerActor(ctx, run, t, opts = {}) {
  const p = run.player;
  const pose = playerPose(run, t);
  const facing = p.facing >= 0 ? 1 : -1;
  const scale = opts.scale ?? 1.12;

  // ground shadow (shrinks when airborne/hurt)
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#04050a';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 1, 24 * scale, 8 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // hurt flash ring
  if (p.hurtFlash > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y - 26, 4, p.x, p.y - 26, 46);
    g.addColorStop(0, `rgba(255,80,96,${0.4 * p.hurtFlash})`);
    g.addColorStop(1, 'rgba(255,80,96,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 26, 46, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // shield bubble
  if (p.shield > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 34 + Math.sin(t * 4) * 1.6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 26, r, r * 1.22, 0, 0, TAU);
    const g = ctx.createRadialGradient(p.x, p.y - 26, r * 0.5, p.x, p.y - 26, r);
    g.addColorStop(0, 'rgba(143,224,255,0.02)');
    g.addColorStop(0.75, 'rgba(143,224,255,0.16)');
    g.addColorStop(1, 'rgba(180,240,255,0.5)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,244,255,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  // invulnerability shimmer
  if (p.invuln > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 30);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,240,200,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 26, 30, 38, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawCat(ctx, run.cat, pose, { x: p.x, y: p.y, scale, facing });
  return pose;
}

/** Enemy pose + body rendering with elites, tells and hurt flashes. */
export function drawEnemyActor(ctx, e, t, opts = {}) {
  const hurt = clamp(e.hurt || 0, 0, 1);
  const dead = e.dead ? clamp(e.deathT / 0.8, 0, 1) : 0;
  const windup = e.windupT > 0 ? 1 - e.windupT / (e.def.windup || 0.3) : 0;
  // Creatures are authored small (grubs ~17px tall). 1.6x brings minions to a
  // readable mass next to the ~140px cat without inflating bosses twice over.
  const scale = (opts.scale ?? 1.6) * (e.boss ? 1.9 : e.mini ? 1.5 : 1);
  const bob = Math.sin(t * (e.behaviour === 'boss' ? 1.4 : 2.2) + e.uid) * (e.boss ? 3 : 1.4);

  drawCreatureShadow(ctx, e.def, e.x, e.y + 1, scale, e.dead ? 0.2 * (1 - dead) : 0.3);

  ctx.save();
  if (dead > 0) {
    ctx.globalAlpha = 1 - dead;
    ctx.translate(e.x, e.y);
    ctx.rotate(dead * 0.5 * (e.uid % 2 ? 1 : -1));
    ctx.scale(1 + dead * 0.2, 1 - dead * 0.4);
    ctx.translate(-e.x, -e.y);
  }
  if (hurt > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y - 20, 2, e.x, e.y - 20, 44);
    g.addColorStop(0, `rgba(255,255,255,${0.35 * hurt})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 20, 44, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // Materialisation window for summoned minions. The summon grace is a real
  // gameplay window (they cannot attack yet), so it has to be visible or the
  // player will read the first hit as unfair instead of as their own mistiming.
  if (e.spawnGrace > 0) {
    const g = clamp(e.spawnGrace / 0.8, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = (e.radius || 16) * 2.2 * (1.25 - g * 0.35);
    const grad = ctx.createRadialGradient(e.x, e.y - 14, 1, e.x, e.y - 14, r);
    grad.addColorStop(0, `rgba(210,240,255,${0.5 * g})`);
    grad.addColorStop(1, 'rgba(210,240,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 14, r, 0, TAU);
    ctx.fill();
    // contracting ring that closes exactly when the minion becomes dangerous
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 1, r * (0.55 + g * 0.5), r * (0.24 + g * 0.2), 0, 0, TAU);
    ctx.strokeStyle = `rgba(190,235,255,${0.35 + (1 - g) * 0.45})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 40;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (e.knockT > 0 && !e.boss) {
    const amount = clamp(e.knockT / 0.24, 0, 1);
    ctx.translate(e.x, e.y);
    ctx.rotate(clamp((e.knockX || 0) / 300, -0.55, 0.55) * amount);
    ctx.translate(0, -10 * Math.sin(amount * Math.PI));
    ctx.translate(-e.x, -e.y);
  }
  const pose = {
    t: t + e.uid * 0.7,
    crouchOut: e.attackCd > 1.9 ? clamp((e.attackCd - 1.9) * 2, 0, 1) : 0,
    excite: e.def.attack === 'explode' ? 1 : 0,
    phase: e.phase || 0,
    hurt,
  };
  drawCreature(ctx, e.def, pose, { x: e.x, y: e.y + bob, scale, facing: e.facing });

  // elite aura
  if (e.elite && e.eliteMod) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = (e.radius || 16) * 1.9;
    const g = ctx.createRadialGradient(e.x, e.y - 16, r * 0.4, e.x, e.y - 16, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, hexA(e.eliteMod.tint, 0.18 + Math.sin(t * 3 + e.uid) * 0.05));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 16, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    // elite crown marks
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(e.x + i * 8, e.y - (e.radius || 16) * 2.5 - 6, 2.2, 0, TAU);
      ctx.fillStyle = e.eliteMod.tint;
      ctx.fill();
    }
  }

  // status pips under the body (no text, readable at a glance)
  drawStatusPips(ctx, e, t);

  // attack windup tell
  if (e.windupT > 0 || windup > 0) {
    const total = e.def.windup || 0.3;
    const p = e.windupT > 0 ? 1 - e.windupT / total : windup;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(e.x, e.y - (e.radius || 16) * 1.4, (e.radius || 16) * 1.5 + 6 - p * 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p, 0, 1));
    ctx.strokeStyle = `rgba(255,90,110,${0.5 + p * 0.5})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // boss shadow/hurt handled by the same code path
}

function drawStatusPips(ctx, e, t) {
  const pips = [];
  if (e.bleedTime > 0) pips.push('#b3202f');
  if (e.burnTime > 0) pips.push('#ff8f4d');
  if (e.poisonTime > 0) pips.push('#9ad14b');
  if (e.slowTime > 0) pips.push('#7fb6ff');
  if (e.markTime > 0) pips.push('#b48bff');
  if (e.stun > 0) pips.push('#ffe066');
  if (!pips.length) return;
  const y = e.y + 5;
  const start = e.x - (pips.length - 1) * 4.4;
  pips.forEach((c, i) => {
    const pulse = 0.7 + 0.3 * Math.sin(t * 8 + i);
    ctx.beginPath();
    ctx.arc(start + i * 8.8, y, 2.6 * pulse, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
  });
}

/** Minions (kittens, spirits, lions) and orbiting orbs. */
export function drawMinion(ctx, m, t) {
  if (m.kind === 'orb') {
    const r = m.radius || 14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, 12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, hexA(m.tint || '#7ce0b0', 0.9));
    g.addColorStop(1, hexA(m.tint || '#7ce0b0', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 12, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3.4, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    void r;
    return;
  }
  if (m.kind === 'lion') {
    ctx.save();
    ctx.translate(m.x, m.y);
    const sway = Math.sin(t * 1.2 + m.x) * 2;
    ctx.globalAlpha = clamp(m.life / 1.4, 0, 1) * 0.9;
    ctx.beginPath();
    ctx.ellipse(0, -30, 26, 30, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,201,102,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    void sway;
    return;
  }
  // kitten / spirit: a small cat silhouette in the caller's palette
  const tint = m.kind === 'spirit' ? '#a48bff' : m.tint || '#7ce0b0';
  ctx.save();
  ctx.globalAlpha = m.life < 1.2 ? clamp(m.life / 1.2, 0, 1) : 1;
  ctx.translate(m.x, m.y);
  const s = m.kind === 'kitten' ? 0.42 : 0.52;
  ctx.scale(s, s);
  ctx.translate(-m.x, -m.y);
  // tiny four-legged silhouette: quick, cheap, reads at gameplay scale
  const bob = Math.sin(t * 9 + m.x) * 1.6;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y - 12 + bob, 13, 8, 0, 0, TAU);
  ctx.fillStyle = hexA(tint, 0.9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,6,14,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // head + ears
  ctx.beginPath();
  ctx.arc(m.x + m.facing * 11, m.y - 18 + bob, 7, 0, TAU);
  ctx.fillStyle = hexA(tint, 0.95);
  ctx.fill();
  ctx.stroke();
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(m.x + m.facing * 11 + k * 4.6, m.y - 22 + bob);
    ctx.lineTo(m.x + m.facing * 11 + k * 6, m.y - 29 + bob);
    ctx.lineTo(m.x + m.facing * 11 + k * 1.6, m.y - 24 + bob);
    ctx.closePath();
    ctx.fillStyle = hexA(tint, 0.95);
    ctx.fill();
  }
  // eyes
  ctx.beginPath();
  ctx.arc(m.x + m.facing * 13.4, m.y - 18 + bob, 1.5, 0, TAU);
  ctx.fillStyle = '#0a0812';
  ctx.fill();
  // legs
  ctx.strokeStyle = hexA(tint, 0.9);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const px = m.x - 6 + i * 12 + Math.sin(t * 12 + i * 2 + m.x) * 3;
    ctx.beginPath();
    ctx.moveTo(px, m.y - 8 + bob);
    ctx.lineTo(px + Math.sin(t * 12 + i + m.x) * 2, m.y - 1);
    ctx.stroke();
  }
  ctx.restore();
  // wisps
  if (Math.random() < 0.25) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(tint, 0.4);
    ctx.beginPath();
    ctx.arc(m.x + (Math.random() - 0.5) * 20, m.y - 16 + (Math.random() - 0.5) * 12, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Pickups: xp motes, coins, hearts, chests. No labels, pure iconography. */
export function drawPickup(ctx, k, t) {
  const bob = Math.sin(t * 3 + k.x * 0.05) * 2;
  const y = k.y - 12 + bob;
  ctx.save();
  if (k.kind === 'xp') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(k.x, y, 0, k.x, y, 9);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(124,224,176,0.8)');
    g.addColorStop(1, 'rgba(124,224,176,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(k.x, y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#eafff4';
    ctx.beginPath();
    ctx.moveTo(k.x, y - 4.2);
    ctx.lineTo(k.x + 2.4, y);
    ctx.lineTo(k.x, y + 4.2);
    ctx.lineTo(k.x - 2.4, y);
    ctx.closePath();
    ctx.fill();
  } else if (k.kind === 'gold') {
    const spin = Math.abs(Math.cos(t * 3 + k.x));
    ctx.beginPath();
    ctx.ellipse(k.x, y, 5.6 * spin + 1.4, 5.6, 0, 0, TAU);
    ctx.fillStyle = '#ffc966';
    ctx.fill();
    ctx.strokeStyle = '#a86a1a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(k.x - 1.2, y - 1.4, 1.6 * spin, 1.6, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  } else if (k.kind === 'hp') {
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    ctx.translate(k.x, y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(0, 5.4);
    ctx.bezierCurveTo(-7, 0.4, -5.4, -5, 0, -2.2);
    ctx.bezierCurveTo(5.4, -5, 7, 0.4, 0, 5.4);
    ctx.fillStyle = '#ff5f6d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,10,24,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
    g.addColorStop(0, 'rgba(255,95,109,0.4)');
    g.addColorStop(1, 'rgba(255,95,109,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fill();
  } else if (k.kind === 'chest') {
    ctx.translate(k.x, y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    glow.addColorStop(0, 'rgba(255,214,120,0.35)');
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-11, -7, 22, 15, 3) : ctx.rect(-11, -7, 22, 15);
    ctx.fill();
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#ffc966';
    ctx.fillRect(-11, -2, 22, 3);
    ctx.beginPath();
    ctx.arc(0, 0.4, 2.6, 0, TAU);
    ctx.fillStyle = '#ffe8a8';
    ctx.fill();
  } else if (k.kind === 'ember') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(k.x, y, 0, k.x, y, 12);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,150,80,0.8)');
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(k.x, y, 12, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function hexA(c, a) {
  if (!c) return `rgba(255,255,255,${a})`;
  if (c.startsWith('rgba') || c.startsWith('rgb')) return c;
  const v = c.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export { drawCatFace };
void lerp; void smooth; void hash01;
