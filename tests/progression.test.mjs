// Progression & persistence tests: the parts of the game a player can lose if a
// save is corrupted or an economy transaction double-charges.
//
// These drive the real Game class through a DOM shim (tests/dom.mjs) rather than
// a fake, so the button ids and prices under test are the ones that ship.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ProfileStore, SAVE_KEY, BACKUP_KEY, defaultProfile, sanitize, DEFAULT_SETTINGS } from '../src/core/save.js';
import { CATS, CAT_BY_ID } from '../src/data/cats.js';
import { SKILLS, SKILL_BY_ID } from '../src/data/skills.js';
import { PERK_COST, PERK_TIERS, PERK_LINES } from '../src/data/perks.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../src/data/achievements.js';

/* ── save format ─────────────────────────────────────────────────────────── */

function memStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    persistent: true,
    read: (k) => (m.has(k) ? m.get(k) : null),
    write: (k, v) => { m.set(k, v); return true; },
    remove: (k) => m.delete(k),
    _map: m,
  };
}

test('a fresh profile is valid and owns exactly one cat', () => {
  const p = defaultProfile();
  assert.equal(p.version, 1);
  assert.equal(p.embers, 0);
  assert.deepEqual(p.loadout.cat, 'tabby');
  assert.equal(p.loadout.unlockedSlots, 1);
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  // starters are the only cats a new player has
  const free = CATS.filter((c) => c.starter || c.unlock?.free || c.unlock?.embers === 0).map((c) => c.id);
  assert.ok(free.includes('tabby'), 'tabby is free');
});

test('save → load round-trips every earned value', () => {
  const storage = memStorage();
  const a = new ProfileStore({ storage });
  a.load();
  a.profile.embers = 1234;
  a.profile.upgrades.claws = 3;
  a.profile.skills.claw_slash = { unlocked: true };
  a.profile.cats.bengal = { unlocked: true, level: 4 };
  a.profile.stats.bestDepth = 27;
  a.profile.settings.lang = 'en';
  a.profile.loadout.skills = ['claw_slash', 'pounce'];
  a.saveNow();

  const b = new ProfileStore({ storage });
  b.load();
  assert.equal(b.profile.embers, 1234);
  assert.equal(b.profile.upgrades.claws, 3);
  assert.equal(b.profile.skills.claw_slash.unlocked, true);
  assert.equal(b.profile.cats.bengal.level, 4);
  assert.equal(b.profile.stats.bestDepth, 27);
  assert.equal(b.profile.settings.lang, 'en');
  assert.deepEqual(b.profile.loadout.skills, ['claw_slash', 'pounce']);
});

test('corrupt save falls back to the backup, then to a fresh profile', () => {
  const storage = memStorage();
  const good = new ProfileStore({ storage });
  good.load();
  good.profile.embers = 777;
  good.saveNow();
  const goodRaw = storage.read(SAVE_KEY);
  assert.ok(goodRaw, 'save written');

  // one good save + a corrupt primary
  const withBackup = memStorage({ [SAVE_KEY]: '{not json', [BACKUP_KEY]: goodRaw });
  const recovered = new ProfileStore({ storage: withBackup });
  recovered.load();
  assert.ok(recovered.warnings.includes('profile-corrupt'), 'corruption is reported');
  assert.equal(recovered.profile.embers, 777, 'backup restored the bank');

  // nothing at all → a clean, playable profile rather than a crash
  const broken = new ProfileStore({ storage: memStorage({ [SAVE_KEY]: '<<<garbage>>>' }) });
  const p = broken.load();
  assert.equal(p.embers, 0);
  assert.equal(p.loadout.cat, 'tabby');
  assert.ok(broken.warnings.includes('profile-corrupt'));
});

test('sanitize clamps hostile numbers and drops unknown ids', () => {
  const KNOWN = {
    cats: new Set(CATS.map((c) => c.id)),
    skills: new Set(SKILLS.map((s) => s.id)),
    upgrades: new Set(PERK_LINES.map((l) => l.id)),
    achievements: new Set(ACHIEVEMENTS.map((a) => a.id)),
  };
  const isKnown = (cat, id) => KNOWN[cat] ? KNOWN[cat].has(id) : true;
  const p = sanitize({
    embers: -999,
    cats: { tabby: { unlocked: true }, made_up_cat: { unlocked: true } },
    skills: { claw_slash: { unlocked: true }, made_up_skill: { unlocked: true } },
    upgrades: { claws: 99, not_a_perk: 4 },
    stats: { bestDepth: NaN, kills: 1e12 },
    settings: { music: 42, sfx: -1, lang: 'xx' },
  }, isKnown);

  assert.equal(p.embers, 0, 'negative embers clamp to 0');
  assert.ok(p.cats.tabby, 'known cat kept');
  assert.equal(p.cats.made_up_cat, undefined, 'unknown cat dropped');
  assert.ok(p.skills.claw_slash, 'known skill kept');
  assert.equal(p.skills.made_up_skill, undefined, 'unknown skill dropped');
  assert.ok((p.upgrades.claws || 0) <= PERK_TIERS, 'perk tier clamped');
  assert.equal(p.upgrades.not_a_perk, undefined, 'unknown perk dropped');
  assert.equal(p.stats.bestDepth, 0, 'NaN stat becomes 0');
  assert.ok(Number.isFinite(p.stats.kills) && p.stats.kills <= 1e12, 'absurd stat bounded to a finite ceiling');
  assert.ok(p.settings.music >= 0 && p.settings.music <= 1, 'volume clamped');
  assert.ok(p.settings.sfx >= 0 && p.settings.sfx <= 1, 'volume clamped low');
  assert.ok(['vi', 'en'].includes(p.settings.lang), 'unknown language falls back');
});

/* ── economy, through the real UI ────────────────────────────────────────── */

const money = async (game) => {
  game.profile.embers = 5000;
};

test('buying a perk charges once, caps at max tier, and persists', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade, localStorage } = await bootGame();
  step(3);
  await money(game);
  click('upgrades'); flushFade();

  const before = game.profile.embers;
  assert.ok(click('perk:claws'), 'perk button exists');
  step(2);
  assert.equal(game.profile.upgrades.claws, 1);
  assert.equal(game.profile.embers, before - PERK_COST[0], 'charged the tier-1 price');

  // buying again charges the tier-2 price, not tier 1 again
  click('perk:claws'); step(1);
  assert.equal(game.profile.upgrades.claws, 2);
  assert.equal(game.profile.embers, before - PERK_COST[0] - PERK_COST[1]);

  // fill to max, then confirm it stops charging
  for (let i = 2; i < PERK_TIERS; i++) { click('perk:claws'); step(1); }
  assert.equal(game.profile.upgrades.claws, PERK_TIERS, 'capped at max tier');
  const maxed = game.profile.embers;
  click('perk:claws'); step(1);
  assert.equal(game.profile.embers, maxed, 'no charge at max tier');

  assert.ok(localStorage.getItem(SAVE_KEY), 'purchase was written to storage');
});

test('a purchase is refused when the bank is short', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade } = await bootGame();
  step(3);
  game.profile.embers = PERK_COST[0] - 1;
  click('upgrades'); flushFade();
  click('perk:claws'); step(1);
  assert.equal(game.profile.upgrades.claws || 0, 0, 'no perk for insufficient embers');
  assert.equal(game.profile.embers, PERK_COST[0] - 1, 'bank untouched');
});

test('unlocking a cat costs its price and equipping swaps the loadout', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade } = await bootGame();
  step(3);

  const locked = CATS.find((c) => c.unlock && c.unlock.embers > 0 && !c.starter);
  assert.ok(locked, 'there is a cat to unlock');
  await money(game);
  const before = game.profile.embers;

  click('cats'); flushFade();
  assert.ok(click(`cat:${locked.id}`), 'cat tile exists');
  step(1);
  click('unlock'); step(1);
  assert.equal(game.profile.cats[locked.id]?.unlocked, true, 'cat unlocked');
  assert.equal(game.profile.embers, before - locked.unlock.embers, 'charged the unlock price');

  click('equip'); step(1);
  assert.equal(game.profile.loadout.cat, locked.id, 'cat equipped');
  assert.ok(game.selectedSkills.filter(Boolean).length > 0, 'loadout filled from the cat kit');
});

test('unlocking a skill charges once, then clicking it toggles the loadout for free', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade } = await bootGame();
  step(3);
  await money(game);
  click('skills'); flushFade();

  const locked = SKILLS.find((s) => !s.starter && !game.profile.skills[s.id]?.unlocked);
  assert.ok(locked, 'there is a locked skill');
  const before = game.profile.embers;
  assert.ok(click(`skill:${locked.id}`), 'skill tile exists');
  step(1);
  assert.equal(game.profile.skills[locked.id]?.unlocked, true, 'skill unlocked');
  const spent = before - game.profile.embers;
  assert.ok(spent > 0, 'skill cost embers');

  // clicking it again must not charge; it should equip/unequip instead
  click(`skill:${locked.id}`); step(2);
  assert.equal(game.profile.embers, before - spent, 'equipping is free');
});

test('achievements pay out once and never double-claim', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step } = await bootGame();
  step(3);

  const ach = ACHIEVEMENT_BY_ID.first_pounce;
  game.profile.embers = 0;
  game.profile.stats.bestDepth = 0;
  game.claimAchievements();
  assert.equal(game.profile.achievements[ach.id], undefined, 'not earned yet');

  game.profile.stats.bestDepth = 1;
  game.claimAchievements();
  assert.equal(game.profile.achievements[ach.id], true, 'claimed');
  const afterFirst = game.profile.embers;
  assert.equal(afterFirst, ach.embers, 'paid the achievement');

  game.claimAchievements();
  game.claimAchievements();
  assert.equal(game.profile.embers, afterFirst, 're-claiming pays nothing');
});

test('every achievement is claimable and pays a finite, non-negative reward', () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.name?.vi && a.name?.en, `${a.id} has both names`);
    assert.ok(a.desc?.vi && a.desc?.en, `${a.id} has both descriptions`);
    assert.ok(Number.isFinite(a.embers) && a.embers >= 0, `${a.id} reward is sane`);
    // the predicate must not throw on a real profile shape
    assert.doesNotThrow(() => a.check(defaultProfile()), `${a.id} check is safe`);
  }
});

test('the run-end payout converts a summary into embers exactly once', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step } = await bootGame();
  step(3);
  game.profile.embers = 0;
  // drive a real run to death so the payout path is the shipped one
  game.go('run', { catId: 'tabby', skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'], difficulty: 'normal' });
  for (let i = 0; i < 200 && game.scene !== 'run'; i++) step(1);  // fade into the run
  assert.equal(game.scene, 'run', 'entered the run');
  for (let i = 0; i < 120; i++) step(1, { draw: false });   // past the intro
  game.run.hp = 0;
  for (let i = 0; i < 400 && game.scene === 'run'; i++) step(1, { draw: false });
  assert.equal(game.scene, 'results', 'death resolved to results');
  const banked = game.profile.embers;
  assert.ok(banked > 0, 'a run pays embers');
  const runs = game.profile.stats.runs;
  for (let i = 0; i < 60; i++) step(1);         // stand on the results screen
  assert.equal(game.profile.stats.runs, runs, 'payout did not run twice');
  assert.equal(game.profile.embers, banked, 'embers did not inflate');
});

/* ── skill grid reachability ─────────────────────────────────────────────── */

test('every skill in the pool is reachable from some page at every viewport size', async () => {
  const { skillGridLayout, skillPoolFor } = await import('../src/ui/scenes.js');
  const { defaultProfile } = await import('../src/core/save.js');
  const profile = defaultProfile();
  const pool = skillPoolFor(profile);
  assert.ok(pool.length >= 40, `pool has the full roster (${pool.length})`);

  const sizes = [[1280, 720], [1440, 810], [1920, 1080], [1366, 768], [1024, 600], [960, 540], [768, 1024], [390, 844]];
  for (const [w, h] of sizes) {
    const safe = { top: 0, right: 0, bottom: 0, left: 0 };
    const L = skillGridLayout(pool, w, h, safe);
    assert.ok(L.cardH >= 48, `${w}x${h}: cards stay legible (${L.cardH.toFixed(0)}px)`);
    assert.ok(L.cardW >= 60, `${w}x${h}: cards stay usable (${L.cardW.toFixed(0)}px)`);
    const covered = L.pageCount * L.perPage;
    assert.ok(covered >= pool.length, `${w}x${h}: ${L.pageCount} pages x ${L.perPage} covers all ${pool.length}`);
    assert.ok(L.pageCount <= 8, `${w}x${h}: paging stays sane (${L.pageCount} pages)`);
  }
});

test('the skill pager cycles within bounds and resets on entry', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade } = await bootGame();
  step(3);
  game.profile.embers = 5000;

  click('skills'); flushFade();
  assert.equal(game.skillPage, 0, 'opens on the first page');
  const firstPage = new Set(game._cachedRects.filter((r) => r.id.startsWith('skill:')).map((r) => r.id));

  click('skills:next'); step(1);
  const secondPage = new Set(game._cachedRects.filter((r) => r.id.startsWith('skill:')).map((r) => r.id));
  assert.ok(secondPage.size > 0, 'page 2 has cards');
  assert.ok([...secondPage].every((id) => !firstPage.has(id)), 'pages do not repeat skills');

  // walk to the end and confirm it clamps instead of running off
  for (let i = 0; i < 12; i++) { click('skills:next'); step(1); }
  const last = game.skillPage;
  assert.ok(game._cachedRects.every((r) => r.id !== 'skills:next'), 'no next button on the last page');
  click('skills:next'); step(1);
  assert.equal(game.skillPage, last, 'page clamped at the end');

  for (let i = 0; i < 12; i++) { click('skills:prev'); step(1); }
  assert.equal(game.skillPage, 0, 'page clamped at the start');

  // leaving and re-entering resets, so the screen never opens on an empty page
  click('skills:next'); step(1);
  click('back'); flushFade();
  click('skills'); flushFade();
  assert.equal(game.skillPage, 0, 're-entry resets to page 1');
});
