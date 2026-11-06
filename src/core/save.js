// Persistent profile: versioned schema, sanitising load, backup + recovery.
// Pure data module — it never touches the DOM.
import { PERK_TIERS } from '../data/perks.js';

export const SAVE_VERSION = 1;
// Highest tier a permanent upgrade can reach; used to clamp tampered saves.
const MAX_PERK_TIER = PERK_TIERS;
export const SAVE_KEY = 'catlegends.profile.v1';
export const BACKUP_KEY = 'catlegends.profile.backup.v1';

export const DEFAULT_SETTINGS = {
  lang: 'vi',
  music: 0.55,
  sfx: 0.75,
  voice: 0.8,
  shake: 1,
  viewDistance: 1.5, // visible width and height relative to the original view
  damageNumbers: true,
  quality: 'auto',
  reduceMotion: false,
  aimAssist: true,
  // Mobile HUD preferences. Defaults are chosen so an existing save that has
  // none of these keys behaves exactly as before — no migration step needed.
  hudMode: 'standard',      // 'compact' | 'standard' | 'large'
  hudScale: 1,              // 0.7 – 1.4, multiplies the mode
  leftHanded: false,
};

export function defaultProfile() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    embers: 0,
    cats: {},
    skills: {},
    upgrades: {},
    achievements: {},
    stats: {
      runs: 0, wins: 0, kills: 0, elites: 0, bosses: 0, damage: 0,
      bestDepth: 0, bestWave: 0, bestLevel: 0, bestTime: 0,
      bestRunKills: 0, minions: 0, coins: 0, totalTime: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    loadout: { cat: 'tabby', skills: [], unlockedSlots: 1, savedSlots: [] },
    seen: {},
    lastRun: null,
  };
}

const num = (v, fallback, min = -Infinity, max = Infinity) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Sanitise untrusted data against the defaults. Unknown ids are passed through
 *  the optional `isKnown(category, id)` predicate so stale content is dropped. */
export function sanitize(raw, isKnown = () => true) {
  const out = defaultProfile();
  if (!raw || typeof raw !== 'object') return out;
  out.createdAt = num(raw.createdAt, out.createdAt, 0);
  out.embers = Math.floor(num(raw.embers, 0, 0, 1e9));

  if (raw.cats && typeof raw.cats === 'object') {
    for (const id of Object.keys(raw.cats)) {
      const entry = raw.cats[id];
      if (!isKnown('cats', id) || !entry || typeof entry !== 'object') continue;
      out.cats[id] = {
        unlocked: !!entry.unlocked,
        level: Math.floor(num(entry.level, 1, 1, 999)),
        xp: Math.floor(num(entry.xp, 0, 0, 1e9)),
        runs: Math.floor(num(entry.runs, 0, 0, 1e6)),
        wins: Math.floor(num(entry.wins, 0, 0, 1e6)),
        kills: Math.floor(num(entry.kills, 0, 0, 1e9)),
      };
    }
  }
  if (raw.skills && typeof raw.skills === 'object') {
    for (const id of Object.keys(raw.skills)) {
      const entry = raw.skills[id];
      if (!isKnown('skills', id) || !entry || typeof entry !== 'object') continue;
      out.skills[id] = { unlocked: !!entry.unlocked, uses: Math.floor(num(entry.uses, 0, 0, 1e9)) };
    }
  }
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const id of Object.keys(raw.upgrades)) {
      if (!isKnown('upgrades', id)) continue;
      // Clamp to the real tier cap, not an arbitrary 99: the UI reads this back
      // and a tampered save would otherwise render "99/4".
      const lv = Math.floor(num(raw.upgrades[id], 0, 0, MAX_PERK_TIER));
      if (lv > 0) out.upgrades[id] = lv;
    }
  }
  if (raw.achievements && typeof raw.achievements === 'object') {
    for (const id of Object.keys(raw.achievements)) {
      if (!isKnown('achievements', id)) continue;
      if (raw.achievements[id]) out.achievements[id] = true;
    }
  }
  if (raw.stats && typeof raw.stats === 'object') {
    for (const key of Object.keys(out.stats)) {
      out.stats[key] = Math.floor(num(raw.stats[key], out.stats[key], 0, 1e12));
    }
  }
  if (raw.settings && typeof raw.settings === 'object') {
    out.settings = sanitizeSettings(raw.settings);
  }
  if (raw.seen && typeof raw.seen === 'object') {
    // Only keep keys shaped like real codex entries. A save edited by hand, or
    // one written by a future build with a category we no longer have, must not
    // be able to bloat the profile with arbitrary keys — and an empty string
    // would sit in the seen map forever doing nothing.
    for (const id of Object.keys(raw.seen)) {
      if (!raw.seen[id]) continue;
      if (typeof id !== 'string' || !/^[a-z]+:[a-z0-9_]+$/.test(id)) continue;
      out.seen[id] = true;
    }
  }
  if (raw.loadout && typeof raw.loadout === 'object') {
    const l = raw.loadout;
    out.loadout.cat = isKnown('cats', l.cat) ? l.cat : out.loadout.cat;
    const slots = Array.isArray(l.skills) ? l.skills.filter((s) => isKnown('skills', s)) : [];
    out.loadout.skills = slots.slice(0, 4);
    out.loadout.unlockedSlots = Math.floor(num(l.unlockedSlots, 1, 1, 4));
    out.loadout.savedSlots = Array.isArray(l.savedSlots)
      ? l.savedSlots
          .filter((arr) => Array.isArray(arr))
          .map((arr) => arr.filter((s) => isKnown('skills', s)).slice(0, 4))
          .slice(0, 4)
      : [];
  }
  if (raw.lastRun && typeof raw.lastRun === 'object') {
    out.lastRun = {
      cat: isKnown('cats', raw.lastRun.cat) ? raw.lastRun.cat : null,
      skills: Array.isArray(raw.lastRun.skills) ? raw.lastRun.skills.filter((s) => isKnown('skills', s)).slice(0, 4) : [],
      seed: Math.floor(num(raw.lastRun.seed, 0, 0, 4294967295)),
      depth: Math.floor(num(raw.lastRun.depth, 0, 0, 999)),
    };
  }
  return out;
}

export function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  if (raw.lang === 'vi' || raw.lang === 'en') s.lang = raw.lang;
  s.music = num(raw.music, s.music, 0, 1);
  s.sfx = num(raw.sfx, s.sfx, 0, 1);
  s.voice = num(raw.voice, s.voice, 0, 1);
  s.shake = num(raw.shake, s.shake, 0, 1);
  s.viewDistance = num(raw.viewDistance, s.viewDistance, 1, 2);
  s.damageNumbers = raw.damageNumbers !== false;
  s.aimAssist = raw.aimAssist !== false;
  s.reduceMotion = !!raw.reduceMotion;
  if (raw.quality === 'auto' || raw.quality === 'high' || raw.quality === 'low') s.quality = raw.quality;
  // HUD prefs: unknown modes fall back rather than producing a broken layout.
  if (raw.hudMode === 'compact' || raw.hudMode === 'standard' || raw.hudMode === 'large') s.hudMode = raw.hudMode;
  s.hudScale = num(raw.hudScale, s.hudScale, 0.7, 1.4);
  s.leftHanded = raw.leftHanded === true;
  return s;
}

/** localStorage wrapper with memory fallback (private mode / file://). */
export function createStorage() {
  let backend = null;
  try {
    const probe = '__catlegends_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    backend = globalThis.localStorage;
  } catch {
    backend = null;
  }
  const mem = new Map();
  return {
    persistent: !!backend,
    read(key) {
      try { return backend ? backend.getItem(key) : (mem.has(key) ? mem.get(key) : null); }
      catch { return null; }
    },
    write(key, value) {
      mem.set(key, value);
      if (!backend) return false;
      try { backend.setItem(key, value); return true; }
      catch { return false; }
    },
    remove(key) {
      mem.delete(key);
      try { backend && backend.removeItem(key); } catch { /* ignore */ }
    },
  };
}

export class ProfileStore {
  constructor({ storage = createStorage(), isKnown = () => true } = {}) {
    this.storage = storage;
    this.isKnown = isKnown;
    this.profile = defaultProfile();
    this.warnings = [];
    this.dirty = false;
    this._saveTimer = null;
  }

  load() {
    const raw = this.storage.read(SAVE_KEY);
    if (!raw) {
      this.profile = defaultProfile();
      return this.profile;
    }
    const parsed = safeParse(raw);
    if (!parsed) {
      this.warnings.push('profile-corrupt');
      this.recover();
      return this.profile;
    }
    this.profile = sanitize(migrate(parsed), this.isKnown);
    return this.profile;
  }

  /** Fall back to the last known-good backup, or a fresh profile. */
  recover() {
    const raw = this.storage.read(BACKUP_KEY);
    const parsed = raw ? safeParse(raw) : null;
    this.profile = parsed ? sanitize(migrate(parsed), this.isKnown) : defaultProfile();
    this.warnings.push(parsed ? 'profile-restored-backup' : 'profile-reset');
    this.saveNow();
    return this.profile;
  }

  markDirty() {
    this.dirty = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this.dirty) this.saveNow();
    }, 400);
  }

  saveNow() {
    try {
      const body = JSON.stringify(this.profile);
      const previous = this.storage.read(SAVE_KEY);
      if (previous) this.storage.write(BACKUP_KEY, previous);
      const ok = this.storage.write(SAVE_KEY, body);
      this.dirty = !ok;
      return ok;
    } catch {
      this.dirty = true;
      return false;
    }
  }

  reset() {
    this.profile = defaultProfile();
    this.saveNow();
    return this.profile;
  }
}

function safeParse(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

/** Forward-compatible migrations. Each step upgrades the object in place. */
export function migrate(data) {
  let v = num(data.version, 0, 0);
  if (v < SAVE_VERSION) {
    // v1 is the initial schema: nothing to translate yet, sanitize() fills gaps.
    v = SAVE_VERSION;
  }
  data.version = Math.min(v, SAVE_VERSION);
  return data;
}
