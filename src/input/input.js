// Input: one normalised state consumed by the game loop.
//   { moveX, moveY, dodge, cast:[bool x4] }
// Sources are additive and never fight: keyboard + mouse, gamepad, and a touch
// layer drawn over the canvas. Touch is authoritative when a finger is down so a
// connected controller cannot hijack a phone mid-swipe.

import { clamp, TAU } from '../core/math.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  Digit1: 's1', Digit2: 's2', Digit3: 's3', Digit4: 's4',
  KeyJ: 's1', KeyK: 's2', KeyL: 's3', KeyU: 's4',
};

export class Input {
  constructor(canvas, { onPause, onAny } = {}) {
    this.canvas = canvas;
    this.state = { moveX: 0, moveY: 0, dodge: false, cast: [false, false, false, false] };
    this.keys = new Set();
    this.pressed = { dodge: false, cast: [false, false, false, false], pause: false };
    this.touch = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, nx: 0, ny: 0, mag: 0, buttons: [] };
    this.pointer = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
    this.onPause = onPause;
    this.onAny = onAny;
    this.usingTouch = false;
    this.usingPad = false;
    this.enabled = true;
    this.lastDevice = 'keyboard';
    this._bind();
  }

  /* ── keyboard + mouse ─────────────────────────────────────────────────── */
  _bind() {
    const isTyping = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    addEventListener('keydown', (e) => {
      if (!this.enabled || isTyping(e.target)) return;
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        if (!e.repeat) {
          if (action === 'dodge') this.pressed.dodge = true;
          else if (action.startsWith('s')) this.pressed.cast[Number(action[1]) - 1] = true;
          if (this.onAny) this.onAny();
        }
        this.keys.add(action);
        this.lastDevice = 'keyboard';
        this.usingPad = false;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (!e.repeat && this.onPause) this.onPause();
      }
    });
    addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.keys.delete(action);
    });
    addEventListener('blur', () => this.keys.clear());

    const rectOf = () => this.canvas.getBoundingClientRect();
    this.canvas.addEventListener('pointermove', (e) => {
      const r = rectOf();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      if (e.pointerType === 'touch') this._touchMove(e);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { this._touchDown(e); return; }
      this.pointer.down = true;
      if (this.onAny) this.onAny();
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') { this._touchUp(e); return; }
      this.pointer.down = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  }

  /* ── touch ───────────────────────────────────────────────────────────── */
  _touchDown(e) {
    this.usingTouch = true;
    this.lastDevice = 'touch';
    if (this.onAny) this.onAny();
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // Skill buttons are hit-tested by the game (it owns the HUD layout); the
    // input layer only needs the movement half of the screen.
    //
    // Anywhere on the movement half starts the stick, and the finger's own
    // landing point is the origin. That is deliberate (it is what makes the
    // whole lower-left corner a valid thumb target, so a thumb that lands a
    // little outside the drawn ring still works), and it means the ring's
    // on-screen position is presentation rather than a hit area.
    if (x < this.w * 0.55) {
      if (this.touch.id === null) {
        this.touch.active = true;
        this.touch.id = e.pointerId;
        this.touch.ox = x;
        this.touch.oy = y;
        this.touch.x = x;
        this.touch.y = y;
        this.touch.nx = 0;
        this.touch.ny = 0;
        this.touch.mag = 0;
        this.touch.originX = x;
        this.touch.originY = y;
        this._touchMoved = false;
      }
    }
  }

  _touchMove(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (e.pointerId === this.touch.id) {
      const dx = x - this.touch.ox;
      const dy = y - this.touch.oy;
      const len = Math.hypot(dx, dy);
      const dead = 10;
      const maxR = 62;
      if (len > dead) {
        const k = Math.min(1, (len - dead) / (maxR - dead));
        this.touch.nx = (dx / len) * k;
        this.touch.ny = (dy / len) * k;
        this.touch.mag = k;
        if (len > maxR) {
          // drag the ring along so long swipes keep full deflection
          this.touch.ox = x - (dx / len) * maxR;
          this.touch.oy = y - (dy / len) * maxR;
        }
      } else {
        this.touch.nx = 0;
        this.touch.ny = 0;
        this.touch.mag = 0;
      }
      this.touch.x = x;
      this.touch.y = y;
      this._touchMoved = true;
    }
  }

  _touchUp(e) {
    if (e.pointerId === this.touch.id) {
      this.touch.active = false;
      this.touch.id = null;
      this.touch.nx = 0;
      this.touch.ny = 0;
      this.touch.mag = 0;
    }
  }

  /* ── gamepad ──────────────────────────────────────────────────────────── */
  _pollPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const dz = 0.22;
      const mag = Math.hypot(ax, ay);
      // A centred stick must NOT disqualify the pad: buttons (dash, skills,
      // pause) have to work while standing still.
      const inside = mag < dz;
      const k = inside ? 0 : clamp((mag - dz) / (1 - dz), 0, 1);
      const nx = inside ? 0 : (ax / mag) * k;
      const ny = inside ? 0 : (ay / mag) * k;
      const btns = pad.buttons;
      const down = (i) => !!btns[i]?.pressed;
      // Standard mapping: A/0 dash (plus LB/RB), X/Y/B cast, Start/Select pause.
      // Button 3 is Y — the old entry `down(1) === false && false` was always
      // false, so slot 3 could never be cast.
      return {
        moveX: nx, moveY: ny,
        dodge: down(0) || down(6) || down(7),
        cast: [down(2), down(1), down(3), down(5)],
        pause: down(9) || down(8),
      };
    }
    return null;
  }

  /* ── simulation helpers ───────────────────────────────────────────────── */
  /** Called by the touch HUD each frame: which on-screen buttons exist. */
  setTouchButtons(buttons) {
    this.touch.buttonsLayout = buttons;
  }

  /** A press on the touch HUD was consumed by the game (not movement). */
  consumeTouchPoint(x, y) {
    if (this.touch.id !== null) return false;
    if (!this.touch.buttonsLayout) return false;
    return this.touch.buttonsLayout.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  /** Snapshot for one simulation tick. Reads and then clears one-shot presses. */
  poll(dt, { width, height } = {}) {
    this.w = width || this.canvas.clientWidth || 960;
    this.h = height || this.canvas.clientHeight || 540;
    if (!this.enabled) return { moveX: 0, moveY: 0, dodge: false, cast: [false, false, false, false] };

    let moveX = 0;
    let moveY = 0;
    const k = this.keys;
    if (k.has('left')) moveX -= 1;
    if (k.has('right')) moveX += 1;
    if (k.has('up')) moveY -= 1;
    if (k.has('down')) moveY += 1;

    let touchSteer = false;
    if (this.touch.active && this.touch.mag > 0.01) {
      moveX = this.touch.nx;
      moveY = this.touch.ny;
      touchSteer = true;
    }

    const pad = this._pollPad();
    if (pad && Math.hypot(pad.moveX, pad.moveY) > 0.05) {
      moveX = pad.moveX;
      moveY = pad.moveY;
      this.usingPad = true;
      this.lastDevice = 'gamepad';
    } else if (pad) this.usingPad = true;

    const len = Math.hypot(moveX, moveY);
    if (len > 1) { moveX /= len; moveY /= len; }

    // `pressed.dodge` is a keyboard one-shot; a pad button is level-triggered
    // and edge-detected here so it fires once per press, like the keyboard.
    const padDodge = !!(pad && pad.dodge);
    const dodge = this.pressed.dodge || (padDodge && !this._padDodgeHeld) || false;
    // Every slot must accept the pad. Slot 3 (index 2) used to have no pad
    // fallback at all, so pressing Y on a controller did nothing.
    const cast = [0, 1, 2, 3].map((i) => this.pressed.cast[i] || (pad && pad.cast[i]) || false);
    this.pressed.dodge = false;
    this.pressed.cast = [false, false, false, false];
    this._padDodgeHeld = padDodge;

    return { moveX, moveY, dodge, cast, touchSteer, len };
  }

  /** True while the on-screen stick is in use (drives the touch UI's stick). */
  get stick() {
    return this.touch.active && this.touch.mag > 0 ? { x: this.touch.nx, y: this.touch.ny, mag: this.touch.mag, ox: this.touch.ox, oy: this.touch.oy, x2: this.touch.x, y2: this.touch.y } : null;
  }

  rumble(ms = 40) {
    if (navigator.vibrate && this.usingTouch) navigator.vibrate(ms);
  }
}

/** Player-facing control help shown once, then never again. */
export function controlsFor(device) {
  if (device === 'touch') return { left: 'stick', right: 'buttons' };
  return { left: 'wasd', right: 'digits' };
}

void TAU;
