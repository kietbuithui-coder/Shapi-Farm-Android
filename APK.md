# APK — what exists, and what it contains

Short answer: **an APK exists in this repository's Releases, but it does not
contain this game.**

## The APK that exists

| | |
|---|---|
| Release | **`apk-source-3.6`** — "Game 3.6 Android" |
| File | **`app-debug.apk`** |
| Size | 63,676,884 bytes (60.7 MB) |
| Built | 2026-10-25 |
| Also attached | `ShapiFarm-3.6-Android-Source.zip` (103.6 MB) |
| Downloads recorded | **0** |

Where to get it: the repository's **Releases** page → `apk-source-3.6` →
Assets → `app-debug.apk`.

It is a **debug** build (not Play-Store signed), produced by
`.github/workflows/build-apk-from-zip.yml`, which is committed on `main`.

## What it contains

The APK wraps **"Hẹn Nhau Dưới Ánh Trăng 3.6"** — a different, earlier game
produced in an earlier ChatGPT conversation. It is not the rebuild in this
branch.

That workflow cannot build *this* game, for a specific reason: it downloads a
ZIP from a Release and verifies it against a **hardcoded SHA-256**
(`89eb73049c02407cb545b7667e1e3902fa478b873e18f8cfcdec5e32977dec0a`). Any other
ZIP is rejected on purpose. It also expects `public/android-assets-version.txt`
from that source tree. Repointing it at this project means writing a new wrapper,
which is new work rather than a repair.

## Getting this game onto an Android phone

1. **Browser — works today, no build.** Open the hosted `index.html` URL in
   Chrome on the phone. The build is a single self-contained file with no
   network requests, so it also runs from a local file. Add to Home Screen for a
   near-native feel.
2. **New APK wrapper — not done.** Would need an Android WebView project plus a
   workflow that packages `index.html`. Nothing in the repo does this today.

## What is verified

- Release assets, byte sizes, build timestamp and download count — read from the
  GitHub API.
- The workflow's SHA-256 check and asset-version requirement — read from the
  committed YAML on `main`.
- `main`'s file tree contains no `index.html`.

## What is not verified

- **The APK has never been installed or run on a real device**, here or
  apparently anywhere — the download count on the asset is 0. It is a debug
  build with no device test behind it.
