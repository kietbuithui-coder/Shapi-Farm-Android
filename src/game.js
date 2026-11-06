// CAT LEGENDS — application shell.
// Owns: canvas sizing, the scene stack, one Run at a time, the camera, the
// presentation bridge, HUD/touch overlays and the fixed-step loop.
//
// Scene flow:
//   home → cats → skills → setup → run → (level-up / reward / pause) → results

import { clamp, TAU, lerp } from './core/math.js';
import { ProfileStore } from './core/save.js';
import { Camera } from './core/camera.js';
import { audio } from './audio/audio.js';
import { Run, RUN_STATE, ARENA } from './systems/run.js';
import { BotBrain } from './systems/bot.js';
import { Presentation } from './systems/presentation.js';
import { Renderer } from './art/renderer.js';
import { FullscreenController, FS_STATE } from './systems/fullscreen.js';
import { setIconRenderer, roundRect } from './ui/theme.js';
import { drawIcon } from './art/icons.js';
import { Hud } from './ui/hud.js';
import { TouchControls } from './ui/touch.js';
import { Input } from './input/input.js';
import * as Scenes from './ui/scenes.js';

/** Settings drawn as 0..1 sliders (see drawSettings) rather than on/off rows. */
const SLIDER_SETTINGS = ['music', 'sfx', 'voice', 'shake'];
import { buildWiki } from './data/wiki.js';
import { CATS, CAT_BY_ID } from './data/cats.js';
import { PALETTE } from './data/palette.js';
import { SKILLS, SKILL_BY_ID, STARTER_SKILLS } from './data/skills.js';
import { PERK_LINES, PERK_TIERS, PERK_COST, perkBonuses } from './data/perks.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { applyFrame } from './data/strings.js';

const KNOWN = {
  cats: (id) => !!CAT_BY_ID[id],
  skills: (id) => !!SKILL_BY_ID[id],
  upgrades: (id) => PERK_LINES.some((p) => p.id === id),
  achievements: (id) => ACHIEVEMENTS.some((a) => a.id === id),
};

const TRANSITION = 0.26;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    setIconRenderer(drawIcon);

    this.store = new ProfileStore({ isKnown: (cat, id) => (KNOWN[cat] ? KNOWN[cat](id) : true) });
    this.profile = this.store.load();
    applyFrame(this.profile.settings.lang);
    audio.setVolumes(this.profile.settings);   // first chance to touch audio


    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.hud = new Hud();
    this.touch = new TouchControls();
    this.input = new Input(canvas, {
      onPause: () => this.togglePause(),
      onAny: () => this.wake(),
    });

    this.scene = 'home';
    this.prevScene = null;
    this.sceneT = 0;
    this.fade = 0;
    this.fadeDir = 0;
    this.pending = null;
    this.time = 0;
    this.acc = 0;
    this.last = 0;
    this.hover = null;
    this.run = null;
    this.pres = null;
    this.bot = null;
    this.paused = false;
    this.botMode = false;
    this.selected = this.profile.loadout.cat || 'tabby';
    this.selectedPrev = null;
    this.pickT = 1;
    this.selectedSkills = [];
    this.skillPage = 0;      // paged skill grid (52 skills never fit one screen)
    this.difficulty = 'normal';
    this.summary = null;
    this.overlay = null; // 'pause' | 'levelup' | 'results' | 'setup'
    this.offers = [];
    this.rewards = [];
    this.hitRects = [];
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };
    this.mobile = false;
    this.hudMode = 'standard';       // compact | standard | large
    this.hudScale = 1;               // 0.7 – 1.4, multiplies the mode
    this.leftHanded = false;
    this.fsState = FS_STATE.UNSUPPORTED;
    this.fs = null;                  // FullscreenController, created in attachFullscreen()
    this.dpr = 1;
    this.fpsMeter = { frames: 0, t: 0, value: 60 };
    this.settingsReturn = null;
    this.resetTimer = 0;
    this.showHitboxes = false;   // debug overlay, F1

    this.initLoadout();
    this.bind();
    this.resize();
    this.attachFullscreen();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  /* ── setup ─────────────────────────────────────────────────────────────── */
  initLoadout() {
    const saved = this.profile.loadout;
    const pool = SKILLS.filter((s) => s.starter || this.profile.skills[s.id]?.unlocked).map((s) => s.id);
    // four slots: keep what the player chose, otherwise fill with their cat's kit
    const cat = CAT_BY_ID[saved.cat] || CATS[0];
    const picks = [];
    for (const id of saved.skills || []) if (SKILL_BY_ID[id] && picks.length < 4 && !picks.includes(id)) picks.push(id);
    for (const id of cat.skills || []) if (SKILL_BY_ID[id] && picks.length < 4 && !picks.includes(id)) picks.push(id);
    for (const id of STARTER_SKILLS) if (picks.length < 4 && !picks.includes(id)) picks.push(id);
    for (const id of pool) if (picks.length < 4 && !picks.includes(id)) picks.push(id);
    this.selectedSkills = picks.slice(0, 4);
    this.persistLoadout();
  }

  persistLoadout() {
    const l = this.profile.loadout;
    l.cat = this.selected;
    l.skills = this.selectedSkills.filter(Boolean).slice(0, 4);
    l.unlockedSlots = 4;
    this.store.markDirty();
  }

  bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    const unlock = () => audio.unlock?.();
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
    // Hitbox overlay. The player asked to be able to see the hitboxes; rather
    // than permanently clutter the screen this is a toggle, and it is not in
    // the HUD so it never appears in normal play. F1 on desktop, the same row
    // in Settings on a phone.
    addEventListener('keydown', (e) => {
      if (e.code === 'F1') { e.preventDefault(); this.toggleHitboxes(); }
    });
    addEventListener('visibilitychange', () => {
      if (document.hidden && this.run && this.scene === 'run' && !this.paused) this.togglePause(true);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = this.localPoint(e);
      this.hover = this.hitTest(x, y);
      this.mouseX = x;
      this.mouseY = y;
      // A slider that has been pressed follows the pointer until release.
      // `sliderGrabbed` used to be assigned on press and never read, which is
      // why dragging a volume control did nothing at all.
      if (this.sliderGrabbed) this.dragSlider(x);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      const { x, y } = this.localPoint(e);
      if (e.pointerType === 'touch' && this.mobile) {
        const hit = this.touch.hitTest(x, y);
        if (hit) {
          if (hit.kind === 'skill') {
            this.touch.press(hit.index);
            this.castSkill(hit.index);
          } else if (hit.kind === 'pause') this.togglePause(true);
          else if (hit.kind === 'fullscreen') this.toggleFullscreen();
          return;
        }
        // Movement is owned by the Input layer, but WHICH side is the stick
        // depends on handedness — hardcoding "left half" silently broke
        // left-handed players (their stick taps opened menus instead).
        if (this.touch.inStickZone(x, y)) return;
      }
      this.hover = this.hitTest(x, y);
      this.click(this.hover, x, y);
    });
    // Any release, wherever it happens, ends the drag. Listening on the window
    // (not the canvas) also catches the pointer leaving the canvas mid-drag.
    const release = () => { this.sliderGrabbed = null; };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    addEventListener('pointerup', release);
  }

  /**
   * Set the grabbed slider from an absolute pointer x.
   * Shared by press and drag so a tap and a drag can never disagree.
   */
  dragSlider(x) {
    const id = this.sliderGrabbed;
    if (!id) return false;
    const row = (this._cachedRects || []).find((r) => r.id === id && r.slider);
    if (!row) return false;
    const t = clamp((x - row.x) / Math.max(1, row.w), 0, 1);
    const P = this.profile;
    // Shake reads better as "off / weak / strong" than as a fraction, so it
    // snaps to quarters; the audio buses keep 5% steps.
    P.settings[id] = id === 'shake' ? Math.round(t * 4) / 4 : Math.round(t * 20) / 20;
    this.applySettings();
    this.store.saveNow();
    return true;
  }

  localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.cssW / Math.max(1, r.width)), y: (e.clientY - r.top) * (this.cssH / Math.max(1, r.height)) };
  }

  resize() {
    const cssW = Math.max(320, innerWidth);
    const cssH = Math.max(240, innerHeight);
    this.cssW = cssW;
    this.cssH = cssH;
    this.mobile = (navigator.maxTouchPoints || 0) > 0 && cssW < 1100;
    this.dpr = Math.min(devicePixelRatio || 1, this.profile.settings.quality === 'low' ? 1.25 : 2);
    this.renderer.quality = this.profile.settings.quality === 'low' ? 'low' : 'high';
    this.renderer.resize(cssW, cssH, this.dpr);
    // Logical UI space: 1 unit = 1 CSS pixel, capped so 4K screens keep sane type.
    this.overScale = 1;
    this.w = cssW;
    this.h = cssH;
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };
    this.hud.layout(this.w, this.h, this.safe, this.mobile);
    this.touch.layout(this.w, this.h, this.safe, this.run);
    if (this.run) this.input.enabled = true;
  }

  /* ── scene plumbing ───────────────────────────────────────────────────── */
  /* ── fullscreen ───────────────────────────────────────────────────────── */

  /** Wire the Fullscreen API and re-layout on every change. Never restarts a run. */
  attachFullscreen() {
    if (this.fs) return this.fs;
    const host = this.canvas.parentElement || this.canvas;
    this.fs = new FullscreenController(host, {
      onChange: () => {
        // Re-measure, re-layout, keep the run. This is the whole point: the
        // viewport changed, the game state must not.
        this.resize();
        this.syncHudConfig();
        this.fsState = this.fs ? this.fs.state : this.fsState;
      },
    }).attach();
    this.fsState = this.fs.state;
    return this.fs;
  }

  /** @returns {Promise<{ok:boolean, state:string, reason?:string}>} */
  async toggleFullscreen() {
    const fs = this.attachFullscreen();
    const res = await fs.toggle();
    this.fsState = fs.state;
    if (!res.ok) {
      // Honest feedback: say it failed rather than silently doing nothing.
      this.toast = { name: { vi: 'Trình duyệt không cho toàn màn hình', en: 'Fullscreen unavailable here' }, t: 2.6 };
    } else {
      audio.ui?.('tap');
    }
    return res;
  }

  get isFullscreen() {
    return this.fs ? this.fs.isFullscreen : false;
  }

  /** Push saved HUD preferences into the touch layer. */
  syncHudConfig() {
    const st = this.profile.settings;
    this.hudMode = st.hudMode || 'standard';
    this.hudScale = typeof st.hudScale === 'number' ? st.hudScale : 1;
    this.leftHanded = !!st.leftHanded;
    this.touch.configure({ mode: this.hudMode, scale: this.hudScale, leftHanded: this.leftHanded });
    // Re-layout immediately: size and mirroring are computed in layout(), so
    // without this the new preference only took effect on the next frame that
    // happened to lay the HUD out again.
    if (this.w && this.h) this.touch.layout(this.w, this.h, this.safe, this.run);
  }

  go(next, payload) {
    if (this.scene === next) return;
    this.pending = { next, payload };
    this.fadeDir = 1;
    this.fade = 0;
  }

  applyPending() {
    const { next, payload } = this.pending;
    this.pending = null;
    this.prevScene = this.scene;
    this.scene = next;
    this.sceneT = 0;
    this.hover = null;
    this.setupScene(next, payload);
  }

  setupScene(next, payload) {
    if (next === 'skills') this.skillPage = 0;
    if (next === 'run') {
      this.startRun(payload);
    } else if (next === 'results') {
      this.summary = payload;
      this.teardownRun();
      audio.stopMusic?.();
      if (payload.victory) audio.victory?.(); else audio.defeat?.();
    } else if (next === 'settings') {
      this.settingsReturn = payload?.return || 'home';
    }
    this.hitRects = [];
  }

  /* ── run lifecycle ────────────────────────────────────────────────────── */
  startRun({ catId, skills, difficulty, seed } = {}) {
    const perks = this.profile.upgrades || {};
    const rng = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.run = new Run({
      catId: catId || this.selected,
      skills: (skills || this.selectedSkills).filter(Boolean),
      perks,
      difficulty: difficulty || this.difficulty,
      seed: seed ?? rng,
      profile: this.profile,
    });
    // Codex discovery. The run reports what the player has now met; the game
    // owns the profile, so it is the game that persists it. New discoveries are
    // flushed on the normal save tick rather than written per unlock, so a
    // first night does not queue twenty disk writes.
    this.run.on('codex:unlock', ({ key }) => {
      if (!key) return;
      if (!this.profile.seen) this.profile.seen = {};
      if (this.profile.seen[key]) return;
      this.profile.seen[key] = true;
      this.codexUnseen = (this.codexUnseen || 0) + 1;
      this.store.markDirty?.();
    });
    this.pres = new Presentation(this.run, { camera: this.camera, settings: this.profile.settings });
    this.bot = this.botMode ? new BotBrain(this.run) : null;
    this.botTimer = 0;
    this.run.start();
    this.ending = false;
    this.paused = false;
    // The run wraps a follow-camera: it tracks the cat and picks a zoom that
    // frames it for this screen (see Camera.fitZoom). Menus stay at 1:1.
    this.camera.autoZoom = true;
    this.camera.zoom = this.camera.fitZoom(this.w, this.h);
    this.camera.targetZoom = this.camera.zoom;
    this.camera.snapNext = true;
    this.hud.lastLevel = 1;
    this.hud.lastCombo = 0;
    this.touch.layout(this.w, this.h, this.safe, this.run);
    audio.startMusic?.(this.run.act?.env || 'garden');
    this.profile.stats.runs = (this.profile.stats.runs || 0) + 1;
    this.store.markDirty?.();
  }

  teardownRun() {
    if (this.run) {
      this.profile.lastRun = {
        cat: this.run.cat.id,
        skills: (this.run.slots || []).filter(Boolean).map((s) => s.id),
        seed: this.run.seed,
        depth: this.run.summary().depth,
      };
    }
    this.run = null;
    this.pres = null;
    this.bot = null;
    this.overlay = null;
    this.deathTimer = 0;
    this.botMode = false;
  }

  finishRun(victory) {
    const run = this.run;
    // Guard: tick() keeps calling this while the fade to results is running, and
    // a second call would reset the fade and stall the transition forever.
    if (!run || this.ending) return;
    this.ending = true;
    const sum = run.summary();
    const depth = victory ? 45 : sum.depth;
    const before = this.profile.stats.bestDepth || 0;
    const s = this.profile.stats;
    s.bestDepth = Math.max(before, depth);
    s.bestRunKills = Math.max(s.bestRunKills || 0, sum.kills);
    s.bestLevel = Math.max(s.bestLevel || 0, sum.level);
    s.kills = (s.kills || 0) + sum.kills;
    s.elites = (s.elites || 0) + (sum.elites || 0);
    s.coins = (s.coins || 0) + Math.round(sum.gold || 0);
    s.minions = (s.minions || 0) + (sum.minions || 0);
    s.totalTime = (s.totalTime || 0) + Math.round(sum.time);
    if (victory) s.wins = (s.wins || 0) + 1;
    const embers = Math.round((sum.embers || 0) + depth * 2 + sum.kills * 0.12 + (victory ? 240 : 0));
    this.profile.embers = (this.profile.embers || 0) + embers;
    this.claimAchievements();
    const newBest = depth > before;
    this.store.saveNow();
    this.go('results', { ...sum, victory, depth, embers, newBest, night: victory ? 9 : sum.night });
  }

  claimAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.profile.achievements[a.id]) continue;
      let ok = false;
      try { ok = !!a.check(this.profile); } catch { ok = false; }
      if (ok) {
        this.profile.achievements[a.id] = true;
        this.profile.embers += a.embers || 0;
        this.toast = { name: a.name, t: 3.2 };
      }
    }
  }

  /* ── codex ────────────────────────────────────────────────────────────── */

  /**
   * The codex is rebuilt from live data every time it is opened, not cached in
   * the profile. That is what keeps it honest: a balance change to a skill shows
   * up in the codex with no migration, and there is no second copy to drift.
   */
  wikiTabs() {
    // `this.lang` never existed, so the wiki was built with undefined and
    // always fell back to Vietnamese regardless of the language setting.
    return buildWiki(this.profile, this.profile.settings.lang);
  }

  /**
   * Push the saved settings into the systems that use them.
   *
   * Called once at boot AND after every change. It used to be called only at
   * boot, so the volume sliders were write-only: the value was stored, drawn
   * and saved, but nothing read it again until the page was reloaded.
   */
  applySettings() {
    const st = this.profile.settings || {};
    audio.setVolumes({ music: st.music, sfx: st.sfx, voice: st.voice });
    // Presentation reads shake per-event, so it only needs the new profile.
    if (this.pres) this.pres.settings = st;
    if (this.run && this.run.applySettings) this.run.applySettings(st);
  }

  /** Show/hide the debug hitbox overlay (player hurtbox, attack reach). */
  toggleHitboxes() {
    this.showHitboxes = !this.showHitboxes;
    return this.showHitboxes;
  }

  /**
   * Debug overlay: draws the hurtbox of the player and every enemy, plus the
   * player's reach. Off unless toggled (F1), and never part of the HUD.
   *
   * This exists because "the hitbox is big" and "the character needs a hitbox"
   * are impossible to act on from a description alone — the numbers were
   * already sensible (the cat's hurtbox is r=17 against boss hitboxes of 46-56)
   * but there was no way for a player to see that. Seeing it settles the
   * question, and it also makes any future mismatch obvious at a glance.
   */
  drawHitboxes(ctx, dpr) {
    const run = this.run;
    if (!run) return;
    const cam = this.camera;
    const sx = this.w, sy = this.h;
    // The world is drawn by the renderer's own arena fit (fitArena), NOT by a
    // centred camera transform — so this overlay has to use the same numbers or
    // it draws circles that do not line up with the sprites. The renderer owns
    // scale/offset; cam.zoom is already folded into renderer.scale.
    const k = this.renderer.scale;
    const ox = this.renderer.offsetX;
    const oy = this.renderer.offsetY;
    const toScreen = (x, y) => ({
      x: ox + x * k + cam.shakeX,
      y: oy + y * k + cam.shakeY,
    });
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1.5;
    // player hurtbox
    const p = toScreen(run.player.x, run.player.y - 18);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, run.player.radius * k, run.player.radius * 0.72 * k, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(120,255,170,0.95)';
    ctx.stroke();
    // every enemy's hitbox
    for (const e of run.enemies) {
      if (e.dead) continue;
      const q = toScreen(e.x, e.y - 14);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, e.radius * k, e.radius * 0.72 * k, 0, 0, TAU);
      ctx.strokeStyle = e.boss ? 'rgba(255,90,90,0.95)' : e.mini ? 'rgba(255,170,60,0.9)' : 'rgba(255,120,160,0.7)';
      ctx.stroke();
    }
    // player reach: the radius the basic attack acquires at
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 150 * 0.85 * k, 150 * 0.85 * 0.72 * k, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(120,200,255,0.45)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ── pause ────────────────────────────────────────────────────────────── */
  togglePause(force) {
    if (this.scene !== 'run' || !this.run) return;
    if (['dead', 'victory'].includes(this.run.state)) return;
    if (this.run.state === RUN_STATE.LEVELUP) return;
    const next = typeof force === 'boolean' ? force : !this.paused;
    if (next === this.paused) return;
    this.paused = next;
    this.input.enabled = !next;
    this.input.pressed.dodge = false;
    this.input.pressed.cast = [false, false, false, false];
    audio.ui?.(next ? 'back' : 'open');
  }

  wake() {
    this.audioAwake = true;
  }

  /* ── clicks ───────────────────────────────────────────────────────────── */
  click(id, x, y) {
    if (!id) return;
    audio.ui?.('tap');
    const P = this.profile;
    switch (this.scene) {
      case 'home':
        if (id === 'play') this.go('run', { catId: this.selected, skills: this.selectedSkills, difficulty: this.difficulty });
        else if (id === 'cats') this.go('cats');
        else if (id === 'skills') this.go('skills');
        else if (id === 'upgrades') this.go('upgrades');
        else if (id === 'collection') this.go('collection');
        else if (id === 'codex') { this.codexTab = 0; this.codexPage = 0; this.codexEntry = null; this.go('codex'); }
        else if (id === 'settings') this.go('settings');
        break;
      case 'codex': {
        if (id === 'back') return this.go('home');
        if (id === 'codex-close') { this.codexEntry = null; return; }
        if (id.startsWith('codex-tab:')) {
          this.codexTab = Number(id.split(':')[1]) || 0;
          this.codexPage = 0;
          this.codexEntry = null;
          return;
        }
        if (id === 'codex-page:prev') { this.codexPage = Math.max(0, (this.codexPage || 0) - 1); return; }
        if (id === 'codex-page:next') { this.codexPage = (this.codexPage || 0) + 1; return; }
        if (id.startsWith('codex:')) {
          const key = id.slice('codex:'.length);
          const tab = this.wikiTabs()[this.codexTab] || { entries: [] };
          const entry = tab.entries.find((e) => e.id === key && !e.locked);
          if (entry) this.codexEntry = entry;
          return;
        }
        break;
      }
      case 'cats': {
        if (id === 'back') return this.go('home');
        if (id.startsWith('cat:')) {
          const next = id.slice(4);
          if (next !== this.selected) {
            this.selectedPrev = this.selected;
            this.selected = next;
            this.pickT = 0;
          }
          return;
        }
        if (id === 'equip') {
          P.loadout.cat = this.selected;
          // the cat's own kit becomes the default loadout, slots untouched
          const cat = CAT_BY_ID[this.selected];
          const kept = this.selectedSkills.filter((s) => s);
          const merged = [...new Set([...(cat.skills || []), ...kept])].slice(0, 4);
          this.selectedSkills = merged;
          this.persistLoadout();
          audio.meow?.(this.selected);
          return;
        }
        if (id === 'start') return this.go('run', { catId: this.selected, skills: this.selectedSkills, difficulty: this.difficulty });
        if (id === 'unlock') {
          const cat = CAT_BY_ID[this.selected];
          const cost = cat.unlock.embers;
          if (P.embers >= cost) {
            P.embers -= cost;
            P.cats[cat.id] = { ...(P.cats[cat.id] || {}), unlocked: true, level: 1 };
            audio.levelUp?.();
            this.store.saveNow();
          } else audio.ui?.('deny');
          return;
        }
        break;
      }
      case 'skills': {
        if (id === 'back') return this.go('home');
        if (id.startsWith('slot:')) {
          const i = Number(id.slice(5));
          this.selectedSkills[i] = null;
          this.activeSlot = i;
          return;
        }
        if (id.startsWith('skill:')) {
          const sid = id.slice(6);
          const sk = SKILL_BY_ID[sid];
          if (!sk) return;
          const unlocked = sk.starter || P.skills[sid]?.unlocked;
          if (!unlocked) {
            const cost = Scenes.emberCost(sk);
            if (P.embers >= cost) {
              P.embers -= cost;
              P.skills[sid] = { ...(P.skills[sid] || {}), unlocked: true };
              audio.levelUp?.();
              this.store.saveNow();
            } else audio.ui?.('deny');
            return;
          }
          const at = this.selectedSkills.indexOf(sid);
          if (at >= 0) { this.selectedSkills[at] = null; return; }
          let slot = this.selectedSkills.findIndex((s) => !s);
          if (slot < 0) slot = 0;
          this.selectedSkills[slot] = sid;
          this.persistLoadout();
          return;
        }
        if (id === 'skills:prev' || id === 'skills:next') {
          // Clamp on the live pool size; drawSkillSelect computes the same
          // rows/cols split, so an off-by-one here would just re-clamp.
          const pageCount = Scenes.skillPageCount(this.profile, this.w, this.h, this.safe);
          const delta = id === 'skills:next' ? 1 : -1;
          const next = Math.min(pageCount - 1, Math.max(0, (this.skillPage || 0) + delta));
          if (next !== this.skillPage) { this.skillPage = next; audio.ui?.('tap'); }
          return;
        }
        if (id === 'fight') {
          if (this.selectedSkills.filter(Boolean).length < 4) {
            audio.ui?.('deny');
            return;
          }
          this.persistLoadout();
          return this.go('run', { catId: this.selected, skills: this.selectedSkills, difficulty: this.difficulty });
        }
        break;
      }
      case 'upgrades': {
        if (id === 'back') return this.go('home');
        if (id.startsWith('perk:')) {
          const pid = id.slice(5);
          const line = PERK_LINES.find((l) => l.id === pid);
          if (!line) return;
          const tier = P.upgrades[pid] || 0;
          if (tier >= PERK_TIERS) return;
          const cost = PERK_COST[tier];
          if (P.embers >= cost) {
            P.embers -= cost;
            P.upgrades[pid] = tier + 1;
            audio.levelUp?.();
            this.store.saveNow();
            this.claimAchievements();
          } else audio.ui?.('deny');
          return;
        }
        break;
      }
      case 'collection':
        if (id === 'back') return this.go('home');
        break;
      case 'settings':
        if (id === 'back') return this.go(this.settingsReturn || 'home');
        // Volume and shake are SLIDERS: the value comes from where you tapped
        // across the row, not from the fact that you tapped. There was no
        // handler for any of them at all, so music/sfx/voice/shake were four
        // controls that did nothing when touched — the only reason it was not
        // obvious is that they still drew at their saved values.
        if (SLIDER_SETTINGS.includes(id)) {
          // Take the grab first, then set the value: dragSlider is shared with
          // pointermove, so press-and-slide and tap-to-set cannot disagree.
          this.sliderGrabbed = id;
          const moved = this.dragSlider(x);
          if (!moved) {
            // No geometry (keyboard/automation): step through useful values.
            const cur = typeof P.settings[id] === 'number' ? P.settings[id] : 0;
            P.settings[id] = id === 'shake' ? (Math.round(cur * 4 + 1) % 5) / 4 : (Math.round(cur * 20 + 5) % 21) / 20;
            this.applySettings();
          }
          this.store.saveNow();
          audio.ui?.('tap');
          return;
        }
        if (id.startsWith('hud:')) {
          P.settings.hudMode = id.slice(4);
          this.syncHudConfig();
          this.store.saveNow();
          audio.ui?.('tap');
          return;
        }
        if (id === 'hudScaleUp' || id === 'hudScaleDown') {
          const step = 0.1;
          const cur = typeof P.settings.hudScale === 'number' ? P.settings.hudScale : 1;
          const next = Math.min(1.4, Math.max(0.7, Math.round((cur + (id === 'hudScaleUp' ? step : -step)) * 10) / 10));
          if (next !== cur) {
            P.settings.hudScale = next;
            this.syncHudConfig();
            this.store.saveNow();
            audio.ui?.('tap');
          }
          return;
        }
        if (id === 'leftHanded') {
          P.settings.leftHanded = !P.settings.leftHanded;
          this.syncHudConfig();
          this.store.saveNow();
          audio.ui?.('tap');
          return;
        }
        if (id === 'fullscreen') { this.toggleFullscreen(); return; }
        if (id === 'reset') {
          this.resetTimer = 2.5;
          this.resetArmed = true;
          return;
        }
        if (id.startsWith('lang:')) {
          P.settings.lang = id.slice(5);
          applyFrame(P.settings.lang);
          this.store.saveNow();
          return;
        }
        if (['damageNumbers', 'reduceMotion', 'aimAssist'].includes(id)) {
          P.settings[id] = !P.settings[id];
          this.applySettings();
          this.store.saveNow();
          return;
        }
        if (id === 'qualityLow') {
          P.settings.quality = P.settings.quality === 'low' ? 'auto' : 'low';
          this.resize();
          this.store.saveNow();
          return;
        }
        break;
      case 'run':
        if (id === 'fullscreen') { this.toggleFullscreen(); return; }
        if (this.paused) {
          if (id === 'resume') this.togglePause(false);
          else if (id === 'botToggle') { this.botMode = !this.botMode; this.bot = this.botMode ? new BotBrain(this.run) : null; }
          else if (id === 'settings') this.go('settings', { return: 'run' });
          else if (id === 'quit') this.finishRun(false);
          return;
        }
        if (this.overlay === 'levelup') {
          if (id.startsWith('offer:')) this.pickOffer(Number(id.slice(6)));
          return;
        }
        if (this.overlay === 'reward') {
          if (id.startsWith('reward:')) this.pickReward(Number(id.slice(7)));
          return;
        }
        if (id === 'pause') { this.togglePause(true); return; }
        if (id === 'bot') { this.botMode = !this.botMode; this.bot = this.botMode ? new BotBrain(this.run) : null; return; }
        if (id.startsWith('skill')) this.castSkill(Number(id.slice(5)));
        break;
      case 'results':
        if (id === 'again') this.go('run', { catId: this.selected, skills: this.selectedSkills, difficulty: this.difficulty });
        else if (id === 'home') this.go('home');
        break;
      default:
        break;
    }
  }

  castSkill(index) {
    if (this.scene !== 'run' || !this.run || this.overlay) return;
    const res = this.run.castSlot(index);
    if (res.ok) this.touch.press(index);
    else audio.ui?.('deny');
  }

  pickOffer(index) {
    if (!this.run) return;
    this.run.chooseOffer(index);
    audio.levelUp?.();
    this.offers = [];
    this.overlay = null;
  }

  pickReward(index) {
    if (!this.run) return;
    this.run.chooseReward(index);
    this.rewards = [];
    this.overlay = null;
  }

  /* ── main loop ────────────────────────────────────────────────────────── */
  frame(now) {
    // rAF timestamps can arrive out of order (tab switches, first frame, or a
    // host that passes its own clock) — never let a bad delta stall the world.
    const stamp = typeof now === 'number' && Number.isFinite(now) ? now : performance.now();
    const raw = (stamp - this.last) / 1000;
    this.last = stamp;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.time += dt;
    this.tick(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  tick(dt) {
    // fade between scenes
    if (this.fadeDir === 1) {
      this.fade = Math.min(1, this.fade + dt / TRANSITION);
      if (this.fade >= 1) {
        this.applyPending();
        this.fadeDir = -1;
      }
    } else if (this.fadeDir === -1) {
      this.fade = Math.max(0, this.fade - dt / TRANSITION);
      if (this.fade <= 0) this.fadeDir = 0;
    }
    this.sceneT += dt;
    this.pickT = Math.min(1, this.pickT + dt * 6);
    if (this.resetArmed) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.resetArmed = false;
    }
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    this.fpsMeter.frames++;
    this.fpsMeter.t += dt;
    if (this.fpsMeter.t > 0.5) {
      this.fpsMeter.value = this.fpsMeter.frames / this.fpsMeter.t;
      this.fpsMeter.frames = 0;
      this.fpsMeter.t = 0;
    }

    if (this.scene !== 'run' || !this.run) {
      this.input.enabled = true;
      return;
    }

    const run = this.run;
    // A finished run ignores pause entirely: results must always resolve.
    const finished = run.state === RUN_STATE.DEAD || run.state === RUN_STATE.VICTORY;
    if (finished && this.paused) this.togglePause(false);
    const inOverlay = !!this.overlay || this.paused;
    this.input.enabled = !inOverlay;
    const state = this.input.poll(dt, { width: this.w, height: this.h });

    // autoplay: the bot replaces human input entirely while it is on
    if (this.botMode && !inOverlay) {
      this.botTimer -= dt;
      if (this.botTimer <= 0) {
        this.botTimer = 1 / 30;
        const botInput = this.bot ? this.bot.update(this.botTimer + 1 / 60) : state;
        this.spawnOnlyInput = botInput;
      }
    }

    if (!inOverlay) {
      const simInput = this.botMode && this.spawnOnlyInput ? this.spawnOnlyInput : state;
      // fixed-ish step: run the simulation at up to 120 Hz but never spiral
      this.acc = Math.min(this.acc + dt, 0.1);
      const step = 1 / 60;
      let guard = 0;
      while (this.acc >= step && guard++ < 6) {
        if (!this.paused) run.step(step, simInput);
        this.acc -= step;
      }
      // skill buttons from input
      state.cast.forEach((v, i) => { if (v) this.castSkill(i); });
    }

    // presentation always ticks so trails finish even during a level-up
    this.pres?.update(dt);
    this.touch.update(dt);
    this.hud.update(dt, run);
    // A little lead in the direction the cat is facing: on a phone the zoom is
    // tight enough that the cat sat dead-centre with the wave arriving from the
    // edge of the screen. The lead is deliberately small (26 world units) so
    // aiming does not feel like the camera is fighting the player.
    const lead = (run.player.facing || 1) * 26;
    this.camera.update(dt, this.time, {
      x: run.player.x + lead, y: run.player.y - 20, worldW: ARENA.w, worldH: ARENA.h,
    }, this.w / Math.max(0.001, this.renderer.scale || 1), this.h / Math.max(0.001, this.renderer.scale || 1));
    this.camera.snapNext = false;

    // run state → overlays
    if (run.state === RUN_STATE.LEVELUP && this.overlay !== 'levelup') {
      this.offers = run.offers;
      this.overlay = 'levelup';
      if (this.botMode) { this.bot?.chooseOffer(); this.overlay = null; this.offers = []; }
    } else if (run.state === RUN_STATE.REWARD && this.overlay !== 'reward') {
      this.rewards = run.rewards;
      this.overlay = 'reward';
      if (this.botMode) { run.chooseReward(0); this.overlay = null; }
    } else if (run.state === RUN_STATE.DEAD && this.overlay !== 'results') {
      this.overlay = 'results';
      this.deathTimer = 1.4;
    } else if (run.state === RUN_STATE.VICTORY && this.overlay !== 'results') {
      this.overlay = 'results';
      this.deathTimer = 1.6;
    }
    if (this.overlay === 'results') {
      this.deathTimer = Math.max(0, (this.deathTimer || 0) - dt);
      if (this.deathTimer <= 0 && this.run) {
        // the run object is gone after this call — leave the tick immediately
        const wasVictory = run.state === RUN_STATE.VICTORY;
        this.finishRun(wasVictory);
        return;
      }
    }
    if (this.scene !== 'run' || !this.run) return;
    // announce night/wave transitions
    if (run.night !== this.lastNight) {
      this.lastNight = run.night;
      this.hud.showAnnounce(`${this.t('night')} ${run.night}`, this.localize(run.act.subtitle), '#ffe8a8', 2.6);
      audio.bossWarn?.();
    }
    if (this.paused) this.hitRects = [];
  }

  t(key) { return ScenesLang(this.profile.settings.lang, key); }
  localize(obj) { return obj ? obj[this.profile.settings.lang] || obj.vi : ''; }

  /* ── drawing ──────────────────────────────────────────────────────────── */
  draw() {
    const ctx = this.renderer.ctx;
    const dpr = this.renderer.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.w;
    const h = this.h;
    this.hitRects = [];

    // world or menu background
    if (this.scene === 'run' && this.run) {
      this.renderer.fitArena(this.camera);
      this.renderer.drawWorld(this.run, this.pres, this.camera, this.time, {});
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.showHitboxes) this.drawHitboxes(ctx, dpr);
      this.drawRunOverlays(ctx, w, h);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Scenes.drawBackdrop(ctx, w, h, this.sceneT, PALETTE.lilac, 1);
      this.drawMenu(ctx, w, h);
    }

    // scene fade
    if (this.fade > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(4,5,12,${Math.min(1, this.fade)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  drawMenu(ctx, w, h) {
    const lang = this.profile.settings.lang;
    const base = { w, h, safe: this.safe, t: this.sceneT, lang, profile: this.profile, hover: this.hover };
    let rects = [];
    switch (this.scene) {
      case 'home': rects = Scenes.drawHome(ctx, base); break;
      case 'cats': rects = Scenes.drawCatSelect(ctx, { ...base, selected: this.selected, selectedPrev: this.selectedPrev, fadeT: this.pickT, botMode: this.botMode }); break;
      case 'skills': rects = Scenes.drawSkillSelect(ctx, { ...base, selectedSkills: this.selectedSkills, botMode: this.botMode, page: this.skillPage }); break;
      case 'upgrades': rects = Scenes.drawUpgrades(ctx, base); break;
      case 'collection': rects = Scenes.drawCollection(ctx, base); break;
      case 'codex': {
        rects = Scenes.drawCodex(ctx, { ...base, wiki: this.wikiTabs(), tab: this.codexTab, page: this.codexPage });
        if (this.codexEntry) {
          rects = rects.concat(Scenes.drawCodexDetail(ctx, { ...base, entry: this.codexEntry, wiki: this.wikiTabs() }));
        }
        break;
      }
      case 'settings': rects = Scenes.drawSettings(ctx, { ...base, confirmReset: this.resetArmed }); break;
      case 'results': rects = Scenes.drawResults(ctx, { ...base, summary: this.summary || {}, victory: !!this.summary?.victory }); break;
      default: break;
    }
    this._cachedRects = rects;
  }

  drawRunOverlays(ctx, w, h) {
    const run = this.run;
    const lang = this.profile.settings.lang;
    // HUD
    this.hud.hover = this.hover;
    // The touch layer draws the corner buttons itself on portrait phones.
    const touchOwnsCorners = this.mobile && this.touch.ownsCornerButtons && !this.overlay && !this.paused;
    this.hud.draw(ctx, run, lang, {
      t: this.sceneT, showNight: true, showBot: true, botOn: this.botMode,
      fullscreen: this.isFullscreen, hideCornerButtons: touchOwnsCorners,
    });
    this.hitRects = [...this.hud.hitRects];

    // touch controls only on touch devices, and never under a modal
    if (this.mobile && !this.overlay && !this.paused) {
      const buttons = this.touch.layout(w, h, this.safe, run);
      this.input.setTouchButtons?.(buttons.concat([this.touch.pauseRect, this.touch.fullscreenRect]));
      this.touch.draw(ctx, run, this.input, this.sceneT, { fullscreen: this.isFullscreen });
      this.hitRects = this.hitRects.filter((r) => !r.id?.startsWith('skill'));
    }

    if (this.overlay === 'levelup') {
      this.hitRects = Scenes.drawLevelUp(ctx, { w, h, safe: this.safe, t: this.sceneT, lang, offers: this.offers, hover: this.hover, level: run.level });
    } else if (this.overlay === 'reward') {
      this.hitRects = this.drawRewards(ctx, w, h, lang);
    } else if (this.overlay === 'results') {
      // hold on the death frame, then cut to results
      ctx.save();
      ctx.fillStyle = `rgba(3,4,10,${clamp(1 - (this.deathTimer || 0) / 1.4, 0, 0.8)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    } else if (this.paused) {
      this.hitRects = Scenes.drawPause(ctx, { w, h, safe: this.safe, t: this.sceneT, lang, hover: this.hover, run });
    }

    if (this.toast) {
      const a = Math.min(1, this.toast.t);
      ctx.save();
      ctx.globalAlpha = a;
      const label = this.localize(this.toast.name);
      ctx.font = `600 11px ${'"Be Vietnam Pro", sans-serif'}`;
      ctx.letterSpacing = '3px';
      ctx.fillStyle = '#ffe8a8';
      ctx.textAlign = 'center';
      ctx.fillText(label.toUpperCase(), w / 2, h - this.safe.bottom - 96);
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
  }

  drawRewards(ctx, w, h, lang) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,14,0.74)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    const n = Math.max(1, this.rewards.length);
    const cardW = Math.min(240, (w - 120) / n - 16);
    const cardH = 250;
    const total = n * cardW + (n - 1) * 16;
    const x0 = w / 2 - total / 2;
    const y0 = h / 2 - cardH / 2;
    const rects = [];
    this.rewards.forEach((r, i) => {
      const x = x0 + i * (cardW + 16);
      const isHover = this.hover === 'reward:' + i;
      drawRewardCard(ctx, x, y0, cardW, cardH, r, isHover, this.localize(r.label));
      rects.push({ id: 'reward:' + i, x, y: y0, w: cardW, h: cardH });
    });
    return rects;
  }

  /* ── hit testing ──────────────────────────────────────────────────────── */
  hitTest(x, y) {
    const list = this.scene === 'run' ? this.hitRects : (this._cachedRects || []);
    for (const r of list) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
    }
    if (this.scene === 'run') {
      const s = this.hud.hitTest(x, y);
      if (s) return s;
    }
    return null;
  }
}

/* Local helpers kept out of the class body for readability. */
function drawRewardCard(ctx, x, y, w, h, reward, hover, label) {
  const r = 18;
  ctx.save();
  if (hover) { ctx.shadowColor = 'rgba(255,201,102,0.42)'; ctx.shadowBlur = 26; }
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(22,28,48,0.97)');
  g.addColorStop(1, 'rgba(10,13,24,0.98)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = hover ? 'rgba(255,201,102,0.85)' : 'rgba(255,201,102,0.3)';
  ctx.lineWidth = hover ? 2 : 1.2;
  ctx.stroke();
  ctx.restore();
  drawIcon(ctx, reward.icon || 'star', x + w / 2, y + 86, 48, '#ffe8a8');
  ctx.save();
  ctx.font = `600 15px ${'"Be Vietnam Pro", sans-serif'}`;
  ctx.fillStyle = '#f4ecd8';
  ctx.textAlign = 'center';
  ctx.fillText(label || '', x + w / 2, y + 170);
  ctx.restore();
}

import { t as _t } from './data/strings.js';
function ScenesLang(lang, key) { return _t(lang, key); }
void lerp; void TAU; void perkBonuses; void SKILL_BY_ID;
