// Phase 4 — web release readiness.
//
// These assertions run against the BUILT index.html, so they catch the class of
// bug that only shows up after bundling: an absolute path that works in dev but
// 404s under a GitHub Pages sub-path, an asset that was never inlined, a splash
// screen that never goes away when the bundle fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const HAS_BUILD = existsSync(ROOT + 'index.html');

test('index.html exists and is a single self-contained file', { skip: !HAS_BUILD && 'run npm run build:web first' }, () => {
  const html = readFileSync(ROOT + 'index.html', 'utf8');
  assert.ok(html.length > 100_000, 'the bundle looks too small to contain the game');

  // No external resources of any kind: every src/href must be a data: URI, an
  // anchor, or absent. This is what makes sub-path hosting and file:// work.
  const refs = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
  const external = refs.filter((r) => r && !r.startsWith('data:') && !r.startsWith('#'));
  assert.deepEqual(external, [], 'found external references');

  // Absolute paths break GitHub Pages project sites, which serve from /<repo>/.
  const absolute = refs.filter((r) => r.startsWith('/'));
  assert.deepEqual(absolute, [], 'found absolute paths');

  // A module script would need a network round-trip per import.
  assert.equal(html.includes('type="module"'), false, 'the bundle must be a classic inline script');
  assert.equal(/<script[^>]+src=/.test(html), false, 'no script may have a src');
});

test('the document is a complete, valid page', { skip: !HAS_BUILD && 'run npm run build:web first' }, () => {
  const html = readFileSync(ROOT + 'index.html', 'utf8');
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="vi"/);
  assert.match(html, /<meta charset="utf-8">/);
  // Android/mobile behaviour depends on these three.
  assert.match(html, /viewport-fit=cover/, 'needs viewport-fit=cover for safe-area insets');
  assert.match(html, /name="theme-color"/);
  assert.match(html, /user-scalable=no/, 'double-tap zoom would fight the touch controls');
  assert.match(html, /<\/html>\s*$/);
  // No scrollbars: the game owns the whole viewport.
  assert.match(html, /overflow:\s*hidden/);
});

test('the loading screen can always resolve', { skip: !HAS_BUILD && 'run npm run build:web first' }, () => {
  const html = readFileSync(ROOT + 'index.html', 'utf8');
  assert.match(html, /id="boot"/, 'there must be a splash to show while the game starts');
  // The failure net must be registered BEFORE the bundle, or a bundle that
  // fails to parse leaves the splash spinning forever with no message.
  const netAt = html.indexOf('Failure net');
  const bundleAt = html.indexOf('<script>', netAt);
  assert.ok(netAt > 0, 'the failure net is missing');
  assert.ok(bundleAt > netAt, 'the failure net must precede the game bundle');
  assert.match(html, /unhandledrejection/);
  assert.match(html, /Try again/);
  assert.match(html, /Timed out while loading/);
});

test('no development leftovers in the shipped file', { skip: !HAS_BUILD && 'run npm run build:web first' }, () => {
  const html = readFileSync(ROOT + 'index.html', 'utf8');
  for (const bad of ['localhost', '127.0.0.1', 'http://localhost:8080', 'TODO', 'FIXME']) {
    assert.equal(html.includes(bad), false, `found ${bad} in the build`);
  }
  // api.github / external urls would be a privacy + offline problem
  const externalUrls = [...html.matchAll(/https?:\/\/[a-z0-9.-]+/gi)]
    .map((m) => m[0])
    .filter((u) => !u.startsWith('http://www.w3.org'));
  assert.deepEqual(externalUrls, [], 'the build must not reference external URLs');
});

test('the game actually boots from the built file', { skip: !HAS_BUILD && 'run npm run build:web first' }, async () => {
  // Execute the built bundle in a canvas-backed DOM and confirm a Game exists,
  // the splash is dismissed, and the menu renders.
  const { bootGame, canvasSize } = await import('./dom-built.mjs');
  const { game, bootHidden } = await bootGame();
  assert.ok(game, 'the built bundle did not create a game');
  assert.equal(bootHidden, true, 'the splash was never dismissed');
  const size = canvasSize();
  assert.ok(size.w > 0 && size.h > 0);
});

test('deployment configs point at the real artefact', () => {
  const netlify = readFileSync(ROOT + 'netlify.toml', 'utf8');
  assert.match(netlify, /build:web/, 'netlify must run the build');
  assert.match(netlify, /publish\s*=\s*"\."/);

  const vercel = JSON.parse(readFileSync(ROOT + 'vercel.json', 'utf8'));
  assert.match(vercel.buildCommand, /build:web/);
  assert.equal(vercel.outputDirectory, '.');

  assert.ok(existsSync(ROOT + '.nojekyll'), '.nojekyll keeps GitHub Pages from running Jekyll');
  assert.ok(existsSync(ROOT + 'DEPLOY.md'));
});

test('the deploy guide does not claim unverified hosting', () => {
  const doc = readFileSync(ROOT + 'DEPLOY.md', 'utf8');
  // The brief forbids claiming a deployment happened. Document the steps, and
  // be explicit about what the platform will not do (Android system UI).
  assert.match(doc, /does not and cannot hide the Android system navigation bar/i);
  assert.equal(/now live at/i.test(doc), false, 'must not claim a live deployment');
  assert.match(doc, /GitHub Pages/);
  assert.match(doc, /Netlify/);
  assert.match(doc, /Vercel/);
});
