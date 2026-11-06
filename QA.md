# QA checklists

What was actually run, and what could not be run here. Kept honest on purpose:
anything marked **not verified** has never been exercised on real hardware, and
says so rather than being quietly assumed.

Run everything with:

```bash
npm install
npm test                    # 145 tests
npm run verify              # index.html self-containment
node tools/verify-fonts.mjs # Vietnamese glyph coverage
node tools/tune.mjs         # balance sweep (deterministic)
```

---

## 1. Build and self-containment

- [x] `npm run build:web` produces one `index.html` (580 KB, 344 KB JS).
- [x] Every `@font-face` is inlined as `data:`; 11 families.
- [x] No `<script src>`, no external stylesheet, no `http(s)://` reference.
- [x] No `data:image/` payload — all art is Canvas 2D.
- [x] No `TODO`, `FIXME`, `lorem ipsum`, or `U+FFFD` in the shipped file
      (`npm run verify` strips base64 runs before scanning, because random font
      bytes contain the word "TODO").
- [x] The built file boots in a `node:vm` context with a canvas shim and paints
      (`tests/bundle.test.mjs`).
- [x] The built file makes zero network requests at runtime.

## 2. Game loop

- [x] Home → cat select → skills → run → level up → pause → death → results →
      home, at 7 viewport shapes (1280×720, 1024×768, 844×390, 780×360,
      667×375, 390×844, 360×640).
- [x] Every menu scene reachable and returns home via its back button.
- [x] No hitbox is off-screen or degenerate at any of those sizes.
- [x] Level-up offers can always be taken; the overlay cannot get stuck.
- [x] Pause and resume work from the HUD button and from `Esc`.
- [x] Death reaches results; results has a retry and a home button.
- [x] HP is 0, never negative, at the moment of death.
- [x] 20 full bot runs (10 cats × 2 seeds) with no NaN positions, no unbounded
      zone/hazard/projectile growth.

## 3. Combat and bosses

- [x] All 27 boss attacks across 5 bosses emit a telegraph.
- [x] No delayed attack resolves faster than 0.35 s (the floor below which a
      human cannot react).
- [x] Phase 2 is reachable in a live fight for both new bosses.
- [x] Phase 2 changes behaviour, not just numbers:
      - Void Predator closes distance 45.7% of frames in phase 2 versus 12.1%
        in phase 1 (measured with the player pinned).
      - Crystal Queen keeps a 95 px walking ring when zoning and 79 px when
        shattering (measured with attacks frozen).
- [x] Crystal walls block movement, and expire on their own within 7.5 s, so
      they cannot soft-lock the arena.
- [x] Summoned minions have a materialisation window and cannot attack in it.
- [x] No attack is chosen twice in a row.
- [x] The anti-stuck watchdog rescues a boss that genuinely cannot move, and
      does not fire on a boss that is deliberately holding ground.

## 4. Save data

- [x] Old profiles load: missing fields, unknown versions, `null`, empty object.
- [x] Corrupt `seen` map is dropped rather than crashing.
- [x] Junk keys in `seen` are filtered to valid codex keys.
- [x] Absurd numbers are clamped (`embers` capped at 1e9, `-5` kills → 0).
- [x] Round-trip through JSON preserves embers and discoveries.

## 5. Codex

- [x] Exactly 8 categories.
- [x] Every category covers its real data with nothing missing (counts are
      derived from the same arrays the game runs).
- [x] Nothing is revealed until discovered.
- [x] Playing the game discovers things (cat, loadout, world rules, enemies).
- [x] The codex follows a changed stat — proof it is not a static copy.
- [x] Both languages complete; no entry leaks a raw internal id as its title.
- [x] Every icon name used exists (an unknown name silently draws a paw).
- [x] Renders correctly at 1280×720, 780×360 and 390×844.

## 6. Balance

- [x] Deterministic sweep (`node tools/tune.mjs`): **27.5 / 45** final against
      **25.0** at the start of the upgrade pass — no regression.
- [x] 20 full-length bot runs across all cats complete without crashing.

---

## Not verified here (needs a real device)

These have **never** been exercised on hardware. They are implemented and
unit-tested at the geometry level, but a unit test cannot replace a thumb.

- [ ] **Touch controls on a real phone.** The stick and buttons are laid out
      from the viewport and safe-area insets and verified geometrically, but no
      human has played with them. Deadzone feel, button size and thumb reach are
      unproven.
- [ ] **Fullscreen on Android.** Uses the real Fullscreen API
      (`requestFullscreen`). Android browsers may keep the system bars visible
      and may require a user gesture; the game does not claim the bars are
      hidden.
- [ ] **iOS Safari.** The safe-area handling is written for `env(safe-area-inset-*)`
      notches, but has not been seen on an iPhone.
- [ ] **Audio.** The Web Audio graph is tested for correct construction and
      gain levels, but nobody has *listened* to it in a browser.
- [ ] **Long-session performance.** The longest run in the sweep was 21.6
      minutes of simulated time; sustained frame rate on a low-end phone is
      unmeasured.
- [ ] **Real gameplay difficulty.** The bot is not a human. Depth 27/45 says the
      curve is intact, not that a person will find it fun.

## 7. Deployment

- [x] `DEPLOY.md` has the verified recipe (build, upload, check).
- [x] `netlify.toml`, `vercel.json`, `.nojekyll` are coherent and covered by
      `tests/deploy.test.mjs`.
- [ ] **No deployment has been performed.** No URL is claimed anywhere in the
      repository, because none exists. The build is ready to upload; uploading
      it is the remaining step.
