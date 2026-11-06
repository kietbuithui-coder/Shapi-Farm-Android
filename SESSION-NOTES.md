# Session notes — handoff

Written at the end of the build session on **2026-11-06**, updated after the
upgrade pass on **2026-11-07**. Read this first if you are continuing the
project.

---

## Where things stand

The game is **complete and shippable**. `index.html` boots, plays the whole loop
(home → cats → skills → run → level up → pause → death → results → home), and
the full test suite passes.

```
npm test                      # 145/145 pass, ~75 s
npm run verify                # index.html is self-contained
node tools/verify-fonts.mjs   # every Vietnamese glyph resolves
node tools/_boot.mjs          # full flow + screenshots in public/art-check/
node tools/tune.mjs           # balance sweep (deterministic)
node tools/render-bosses.mjs  # both new bosses, in-engine, both phases
```

Live preview: `npm start` → <http://localhost:8080/>.

Deliverable: **`index.html`**, 583 KB, 346 KB JS, 11 inlined fonts, no network
access at runtime.

---

## Bugs found and fixed in this session

Each of these was a real, player-visible defect. They are listed here because
several were invisible to the test suite until a test was written for them.

### 1. Dash was dead code
`updatePlayer()` gated the dash on `p.energy >= 18`, but energy lives on the
`Run` (`run.energy`); `player.energy` was always `undefined`. **The dash never
fired for anyone.** Fixed to `this.energy >= DASH_COST`, with `DASH_COST` /
`DASH_CD` exported from `run.js` so the cost is defined once.

*Side effect:* the bot got much stronger once it could actually dodge. The
"bot must die within 900 s" assertion became a "bot must make progress"
assertion. Balance re-measured at avg depth 25.2/45 (was 25.5) — unchanged.

### 2. Healing resurrected the dead
`heal()` had no floor, and the death check runs at the *end* of `update()`, so
passive regen ticked a 0-HP corpse back to 0.2 and `playerDeath()` never fired.
`heal()` now returns 0 when `hp <= 0`, and passive regen is skipped while
downed. Death is sticky.

### 3. Every "denied" UI sound was silent
Call sites passed `audio.ui('denied')`, `'click'`, `'close'`, but the engine only
knew `'deny'`, `'tap'`, `'back'`, `'pick'` — unknown strings fell through with no
sound. Normalised at the source (`AudioEngine.UI_ALIASES`) and fixed the call
sites, so the "you can't afford that" feedback is audible.

### 4. 38 of 52 skills were unselectable
`drawSkillSelect` computed a grid from a fixed `cardW * 1.16` height capped at
132px and then did `if (y > h - safe.bottom - 20) return;`. At 1280×720 that
showed **14** skills; at 960×540, **5**. Everything else was silently dropped.
Replaced with `skillGridLayout()` (shared by drawing *and* click handling) plus a
pager: `skills:prev` / `skills:next`, `Trang 1/3`, clamped at both ends, reset on
re-entry. Verified at 8 viewport sizes from 390×844 to 1920×1080.

### 5. Perk rows hid their own effect
`drawUpgrades` never rendered `line.label` ("+6% sát thương"). Every row was a
bare name and a price. Now name + effect line, pips right-aligned before the
price, list widened to 640px.

### 6. Skill pager arrows pointed the wrong way
The arrow path put the tip at `cx - dir * 3.5` and the wings at `+`, so "next"
rendered as `<`. Fixed.

### 7. `sanitize()` let tampered perks through the UI
Perk tiers clamped to 99 instead of `PERK_TIERS`, so a hand-edited save rendered
"99/4". Now clamped at the save boundary.

### 8. `npm test` didn't run
`node --test tests/` treats the directory as a module specifier on Node 22 and
fails with `MODULE_NOT_FOUND`. Script is now `node --test tests/*.test.mjs`
(42 tests instead of 1 failure).

### 9. Three controller bugs made the pad half-useless
- `_pollPad()` returned `null` whenever the stick was centred, so **dash and all
  four skills were dead while standing still**.
- `poll()` built its cast array with `this.pressed.cast[2] || false` — slot 3 had
  no pad fallback, so `Y` did nothing.
- `poll()` only read `this.pressed.dodge` (keyboard), never `pad.dodge`.
- Also: `down(1) === false && false` in the pad cast map was always false, and a
  held dash button now edge-detects instead of re-firing every frame.
Covered by `tests/input.test.mjs`.

### 10. Collection screen printed its own title twice
The page heading and the right-rail heading both used `tr(lang, 'collection')`.
Added a dedicated `achievements` string ("Thành Tựu" / "Achievements") for the
rail. `tests/verify.mjs` does not catch this kind of copy bug — it needs eyes.

### 11. Settings used only the left half of the screen
~55% of the screen was empty background. Added a right rail with profile stats,
the control list, and the armed-reset warning copy. Layout is conditional on
`w >= 900` so it never crowds a small window.

### 12. Missing glyphs in *screenshots* (not in the game)
Screenshots read `CHÍN ÊM D I ÁNH TRĂNG` — `đ ơ ư ộ ậ` were blank. This was
**not** a shipping bug: `@napi-rs/canvas` has no `unicode-range` support, so
registering both subsets under one family name made the later file win, and it
lacks the Vietnamese glyphs. `tools/verify-fonts.mjs` parses the WOFF `cmap`
tables and the shipped `@font-face` rules to prove the real page is correct.

Fix for the harness only: register subsets under separate families and rewrite
`ctx.font` to a fallback list (`tests/dom.mjs` → `patchFonts`). **Do not** add
that to `src/`; browsers do this natively.

---

## Things that look like bugs but are not

- **"Vượt" / "Tim" / "Da"** in the upgrades screen are complete Vietnamese words,
  not truncation. The data uses single-word perk names.
- **Stat labels touching bars** on the cat screen: measured at 1:1, they clear.
  It was an artifact of viewing a downscaled screenshot.
- **The 4th skill slot looks empty** in the skills screenshot: the `triple_scratch`
  icon is dark by design. Zoom before concluding.

---

## Conventions to keep

- `Run` stays headless (no DOM, no audio, no timers). This is what makes the
  tests and bots possible.
- `finishRun()` must stay idempotent (guarded by `this.ending`) — `tick()` calls
  it every frame while the results fade runs.
- Pause is intent-based: `togglePause(true | false)`, never a bare toggle.
- Use `roundRect` from `src/ui/theme.js`, never `ctx.roundRect`.
- `buffValue(kind)` is additive; never multiply movement.
- Strip `base64,[A-Za-z0-9+/=]+` before scanning built HTML for placeholder
  words — random font bytes contain "TODO".
- Layout that both draws and hit-tests must live in one function (see
  `skillGridLayout`), or the two drift apart.
- Any new on-screen string must be checked by `tools/verify-fonts.mjs` for
  diacritic coverage.

## What the upgrade pass changed (2026-11-07)

Eight phases, each followed by a test run and a balance check.

| What shipped | Commit |
| --- | --- |
| Boss anti-stuck: watchdog, no stalling, no teleporting onto the player | `fd4802f` |
| Mobile HUD from viewport + safe areas, touch layer, real Fullscreen API | `d2927fa` |
| Web release readiness: self-healing boot, `DEPLOY.md`, deploy configs, deploy tests | `0acb837` |
| Arena 1180 → 1570 wide (**+39.5% playable floor**) | `19b59a4` |
| Five new enemies (crawler, slime, shadow stalker, thorn beast, banshee) | `a26e040` |
| Void Predator + Crystal Queen, attack selection by distance/phase | `c7cb600` |
| Telegraphs on every attack; summons get a visible grace window | `34e1eab` |
| Codex: 8 categories, locked until discovered, built from live data | `1ce661f` |

Run `git log --oneline 5c5c6bb..HEAD` to see them in order.

### Bugs found by the QA pass that the tests had missed

- **HP went negative on death** (seen at −20.6 on a 620 HP cat) and leaked into
  the stats. Now clamped at the moment of death.
- **`profile.seen` accepted junk keys** from a hand-edited save: an empty string
  and arbitrary objects survived sanitising forever. Now only keys shaped like
  real codex entries are kept.
- **`phase.style` was dead data.** The Void Predator's "stops retreating and
  hunts" phase was declared in the boss table and read by nothing, so the
  behaviour change the README and codex both promised did not exist. Movement
  styles are now real: `hunt` closes instead of orbiting (45.7% of frames
  closing versus 12.1%), and each style owns a preferred standoff.
- **The Crystal Queen's phase 1 dropped `crystalWall`**, which left phase 2's
  signature `shatterWall` with no walls to shatter and killed the whole mechanic
  for most of the fight.
- **The anti-stuck watchdog could never fire** for a frozen boss: its threshold
  scaled with the boss's own speed, so at speed 0 the test was `moved < 0`. It
  also counted the separation shove as progress, so a boss pinned on the player
  looked like it was moving.
- **`moonBeam` had no telegraph** despite a 0.7 s fuse — an unavoidable attack
  dressed up as a dodge window. All four summon attacks also materialised
  enemies instantly, sometimes in melee range.
- **The bot's strafe timer used `Math.random`**, which made the balance sweep
  non-reproducible: two runs of the same build differed by three whole nights,
  so no A/B comparison of a combat change could be trusted. It now uses a local
  seeded generator kept separate from the run's own RNG stream.

### Balance methodology

`node tools/tune.mjs` is deterministic: same seed set, same bot, same result
every run. A change is only accepted if this number does not regress. Baseline
for the upgrade pass was 25.0; final is **27.5** (of 45).

Do **not** give the boss attack selector its own RNG stream. Drawing attack
choice from a separate generator was tried and cost 2.5 depth, because the main
stream then shifted underneath everything else — spawns, crits and loot all
re-rolled, and the sweep was measuring the new world rather than the new boss.

## Not available in this environment

- Playwright / any real browser (downloads blocked). `tests/bundle.test.mjs`
  runs the built bundle in `node:vm` with a canvas shim instead.
- Java / Android SDK. The original repo was an Android wrapper; it was removed.
  This is a web build.

## If you pick this up

1. `npm install && npm test` — confirm 145/145 green before changing anything.
2. Look at `public/art-check/boot-*.png`; they regenerate with
   `node tools/_boot.mjs`.
3. Probably worth doing next:
   - **Real device playtest.** Touch layout is verified by geometry only (seven
     viewport shapes are swept by an automated QA script), but the virtual stick
     and buttons have never been used by an actual thumb, and the Fullscreen API
     path has never run on a real Android browser. On Android the browser may
     keep its system bars visible; the game does not claim otherwise.
   - **Difficulty pass.** Sphynx dies at depth ~1 on 2 of 3 seeds, and Bengal
     swings between depth 3 and 7. `node tools/tune.mjs` has the table.
   - **`index.html` head polish.** It currently has no `og:` tags or favicon
     beyond what the build inlines. Harmless, but it is the one rough edge on
     the deliverable.

---

## Post-release tuning round

Seven pieces of feedback after the first playable build. What each turned out to
be, in the order they were investigated.

### 1. "Is there an APK?"

No. There is no APK, no Gradle project, no `AndroidManifest.xml` and no
Capacitor/Cordova/React-Native dependency anywhere in the tree — `git ls-files`
has no `.apk`, and `git log` has no commit that built one. The repo is a pure
web build whose entire deliverable is `index.html`. Playable: yes, via a browser
(GitHub Pages or a local server). Installable: not without adding a wrapper
project. That is a separate piece of work, not a fix to something that failed.

### 2. Levelling felt too fast

`xpForLevel` now multiplies by `XP_PACE = 1.35`, so the requirement is 35%
higher at every level (30 → 30 at level 1, 1114 → 1504 at level 30, +35.0–36.4%).
The curve keeps its shape. Nothing in the UI quotes a level-up rate, so the
change is experienced as a slower climb, per the "don't show it" instruction.

### 3. "The spider boss or its attacks don't work"

Could not reproduce. `hollow_ninth` (in-game *Mang Thứ Chín*) is the spider, and
a god-mode 60-second probe measured 1947px of movement and five attacks —
`summonShades`, `echoRing`, `blinkClaw`, `enrage`, `nineLash` — across all three
phases. Its behaviour was already working.

What **was** broken was nearby and would have read as unfair: bosses could kill
from full health in one frame (see below). That is the most likely thing being
noticed.

### 4. Smaller attack hitboxes

`SKILL_HITBOX = 0.85` scales every skill pattern's radius and width at the one
place they are all derived from, and the basic attack's 150px reach drops to
127px with it. Because these are radii, the covered area shrinks by more than
15%. Per-cat skill-area upgrades still apply on top, so the perk still reads as
a gain rather than being cancelled out.

### 5. Cat stats down 10%

`CAT_POWER = 0.9` on atk, hp, def, crit and dodge in `buildStats`, so every cat
moves by the same amount. **Not** applied to move speed or attack speed: a 10%
cut there changes how the cat handles rather than how strong it is, and mostly
just reads as sluggish. `tests/settings.test.mjs` asserts both halves of that.

### 6. Better skill VFX

Casting used to be a 26px ring and six particles — invisible next to the skill it
announced. It now has a charge ring collapsing inward onto the caster (so the
eye arrives at the origin exactly as the skill fires), radial rune spokes, two
particle bursts and a small camera kick. Ultimates get roughly double the size
and particle count. Two new FX primitives, `castCharge` and `castRune`, drawn in
the renderer's existing `lighter` pipeline. Presented only `if (this.camera)`, so
a headless run is unaffected. Rune spokes needed a second wide pass to stay
visible against a bright floor.

### 7. "Settings not working"

Two separate defects, and neither could throw:

- **The four sliders were inert.** `music`, `sfx`, `voice`, `shake` are drawn
  as sliders and were never handled in the settings `switch` — tapping one did
  nothing. Worse, `pointerdown` set `this.sliderGrabbed = id` and **nothing ever
  read it**: the drag path was assigned and abandoned, so the sliders could not
  be dragged either. They still drew at their saved values, which is why they
  looked functional.
- **The language switch only half worked.** `P.settings.lang` flipped correctly,
  but the codex was built with `buildWiki(profile, this.lang)` — a property that
  does not exist. `undefined` fell back to Vietnamese, so the whole wiki stayed
  Vietnamese in English mode.

Fixed by routing press and move through one `dragSlider(x)`, clearing the grab
on release (window-level, so a pointer that leaves the canvas still releases),
and passing `this.profile.settings.lang`. A tap now sets the value at the tapped
position; a press-and-slide tracks continuously.

### Bonus fix found while investigating: one-shot deaths

`crystal_queen` could kill a full-health player in a single frame. Night 10
multiplies enemy damage by ~4.78×, and `groundSpikes` fires `boss.dmg * 0.8` per
hazard: 110.5 damage into a 106 HP tabby. No dodge, no shield, no revive window —
unwinnable. A per-hit cap of `MAX_HIT_SHARE = 0.5` now applies at the single
point all incoming damage passes through, so one hit can never remove the whole
bar but three still kill. This is also what let the existing crystal_queen test
pass again: it had been failing because the player died and the simulated
`run.state` left `'fight'`, not because the boss misbehaved.

### Numbers

| | before | after |
|---|---|---|
| tests | 145 | **153** (8 new in `tests/settings.test.mjs`) |
| avg depth / 45 | 27.5 | **15.3** |
| `index.html` | 594,271 B | **596,627 B** |

Attribution of the depth change, each reverted alone and re-measured: stat cut
−6.1, hitbox tightening −1.6, XP curve −4.5 (27.5 → 23.0 → 16.9 → 15.3). All
three were requested, so the new figure is recorded rather than tuned away.
