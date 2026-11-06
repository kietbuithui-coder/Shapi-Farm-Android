// The codex is a manual built from the game's own data. These tests guard the
// two things that make it trustworthy: it cannot drift from the systems it
// documents, and it cannot reveal content the player has not met.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildWiki, markSeen, WIKI_CATEGORIES } from '../src/data/wiki.js';
import { ENEMIES, MINIBOSSES, BOSSES } from '../src/data/enemies.js';
import { SKILLS } from '../src/data/skills.js';
import { CATS } from '../src/data/cats.js';
import { PERK_LINES } from '../src/data/perks.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { ICON_NAMES } from '../src/art/icons.js';
import { Run } from '../src/systems/run.js';

const empty = () => ({ seen: {} });

test('the codex has exactly the eight categories the brief asks for', () => {
  assert.equal(WIKI_CATEGORIES.length, 8);
  const ids = WIKI_CATEGORIES.map((c) => c.id);
  assert.deepEqual(ids, ['bestiary', 'bosses', 'skills', 'cat', 'perks', 'upgrades', 'world', 'feats']);
  const wiki = buildWiki(empty(), 'en');
  assert.equal(wiki.length, 8);
  for (const c of wiki) assert.ok(c.total > 0, `${c.id} has no entries at all`);
});

test('every category covers the real game data, with nothing missing', () => {
  // If a new enemy or skill ships without a codex entry, the manual quietly
  // starts lying. These counts are derived from the same arrays the game runs.
  const w = Object.fromEntries(buildWiki(empty(), 'en').map((c) => [c.id, c]));
  assert.equal(w.bestiary.total, ENEMIES.length, 'bestiary must list every enemy');
  assert.equal(w.bosses.total, MINIBOSSES.length + BOSSES.length, 'bosses must list every boss and miniboss');
  assert.equal(w.skills.total, SKILLS.length, 'skills must list every skill');
  assert.equal(w.cat.total, CATS.length, 'cats must list every cat');
  assert.equal(w.perks.total, PERK_LINES.length, 'embers must list every perk line');
  assert.equal(w.upgrades.total, UPGRADES.length, 'upgrades must list every upgrade');
  assert.equal(w.feats.total, ACHIEVEMENTS.length, 'feats must list every achievement');
});

test('the codex reads live numbers instead of copying them', () => {
  // The whole point of building from data is that a rebalance shows up here with
  // no migration. Prove it by changing a def and re-reading the codex.
  const wiki = buildWiki(empty(), 'en');
  const bosses = wiki.find((c) => c.id === 'bosses');
  const queen = bosses.entries.find((e) => e.key === 'boss:crystal_queen');
  const real = BOSSES.find((b) => b.id === 'crystal_queen');
  assert.ok(queen.body.some((l) => l.includes(String(real.hp))), `expected hp ${real.hp} in ${JSON.stringify(queen.body)}`);

  const before = real.hp;
  try {
    real.hp = 9999;
    const after = buildWiki(empty(), 'en').find((c) => c.id === 'bosses')
      .entries.find((e) => e.key === 'boss:crystal_queen');
    assert.ok(after.body.some((l) => l.includes('9999')), 'codex did not follow the changed hp');
  } finally {
    real.hp = before;
  }
});

test('boss pages state when each phase begins', () => {
  // "phase 2 has 4 attacks" is useless without knowing when it starts.
  const bosses = buildWiki(empty(), 'en').find((c) => c.id === 'bosses');
  const queen = bosses.entries.find((e) => e.key === 'boss:crystal_queen');
  assert.ok(queen.body.some((l) => /below \d+% HP/.test(l)), `expected a phase threshold in ${JSON.stringify(queen.body)}`);
});

test('nothing is revealed until it is discovered', () => {
  const clean = buildWiki(empty(), 'en');
  for (const c of clean) {
    if (c.id === 'feats') continue;               // feats are goals, not spoilers
    assert.equal(c.discovered, 0, `${c.id} revealed ${c.discovered} entries with an empty profile`);
    for (const e of c.entries) assert.equal(e.locked, true, `${e.id} was not locked`);
  }
});

test('discovering one thing unlocks one thing, and persists', () => {
  const profile = empty();
  assert.equal(markSeen(profile, 'enemy:grub'), true, 'first discovery reports true');
  assert.equal(markSeen(profile, 'enemy:grub'), false, 'rediscovery reports false');
  const bestiary = buildWiki(profile, 'en').find((c) => c.id === 'bestiary');
  assert.equal(bestiary.discovered, 1);
  const grub = bestiary.entries.find((e) => e.key === 'enemy:grub');
  assert.equal(grub.locked, false);
  // ...and no neighbours came with it
  assert.equal(bestiary.entries.filter((e) => !e.locked).length, 1);
});

test('playing the game actually discovers things', () => {
  // Discovery has to come from play, not from a debug flag. A short run should
  // unlock the cat, the starting skills, the world rules and some enemies.
  const run = new Run({ catId: 'tabby', skills: ['claw_slash', 'pounce'], perks: {}, seed: 3 });
  const seen = new Set();
  run.on('codex:unlock', ({ key }) => seen.add(key));
  run.start();
  for (let i = 0; i < 60 * 45; i++) {
    run.step(1 / 60, {});
    while (run.state === 'levelup') run.chooseOffer(0);
    while (run.state === 'reward') run.chooseReward(0);
    if (run.state === 'dead') break;
  }
  assert.ok(seen.has('cat:tabby'), 'the cat you play as was never discovered');
  assert.ok(seen.has('skill:claw_slash'), 'a starting skill was never discovered');
  assert.ok(seen.has('world:night'), 'the most basic rule of the game was never discovered');
  const enemies = [...seen].filter((k) => k.startsWith('enemy:'));
  assert.ok(enemies.length >= 2, `only met ${enemies.length} kinds of enemy in 45s`);
  // and nothing outside the real data was reported
  const valid = new Set([
    ...ENEMIES.map((e) => `enemy:${e.id}`),
    ...[...MINIBOSSES, ...BOSSES].map((e) => `boss:${e.id}`),
    ...SKILLS.map((s) => `skill:${s.id}`),
    ...CATS.map((c) => `cat:${c.id}`),
    ...UPGRADES.map((u) => `upgrade:${u.id}`),
    ...PERK_LINES.map((p) => `perk:${p.id}`),
  ]);
  const worldKeys = new Set(WIKI_CATEGORIES.find((c) => c.id === 'world') ? buildWiki(empty(), 'en').find((c) => c.id === 'world').entries.map((e) => e.key) : []);
  for (const k of seen) {
    assert.ok(valid.has(k) || worldKeys.has(k), `discovered a key that no codex entry uses: ${k}`);
  }
});

test('every codex entry renders a real icon', () => {
  // An unknown icon name silently draws a paw, which looks like a design choice
  // rather than a bug. Catch it here instead.
  for (const lang of ['vi', 'en']) {
    for (const c of buildWiki(empty(), lang)) {
      assert.ok(ICON_NAMES.includes(c.icon), `${c.id} uses unknown icon "${c.icon}"`);
      for (const e of c.entries) {
        assert.ok(ICON_NAMES.includes(e.icon), `${e.id} uses unknown icon "${e.icon}"`);
      }
    }
  }
});

test('the codex is fully translated in both languages', () => {
  for (const lang of ['vi', 'en']) {
    for (const c of buildWiki(empty(), lang)) {
      assert.ok(c.label && c.label.trim(), `${c.id} has no label in ${lang}`);
      for (const e of c.entries) {
        assert.ok(e.title && e.title.trim(), `${e.id} has no title in ${lang}`);
        assert.ok(e.body.length > 0, `${e.id} has no body in ${lang}`);
        for (const line of e.body) {
          assert.equal(typeof line, 'string', `${e.id} has a non-string line in ${lang}`);
          assert.ok(!line.includes('[object'), `${e.id} rendered an object instead of text: ${line}`);
        }
      }
    }
  }
});

test('no codex entry leaks a raw internal id as its title', () => {
  const wiki = buildWiki(empty(), 'en');
  for (const c of wiki) {
    for (const e of c.entries) {
      assert.ok(!/^[a-z0-9_]+$/.test(e.title.replace(/ /g, '_')), `${e.id} shows the raw id "${e.title}"`);
    }
  }
});
