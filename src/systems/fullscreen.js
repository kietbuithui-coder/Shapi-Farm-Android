// Fullscreen + viewport plumbing.
//
// Two different things get called "fullscreen" and conflating them is how games
// ship a button that does nothing:
//
//   1. The Fullscreen API (`requestFullscreen` on an element). Real, removes
//      browser chrome, changes the viewport, fires `fullscreenchange`.
//   2. A CSS-only fake ("just make the canvas bigger"). Not fullscreen, lies to
//      the player, and breaks input mapping if anything is scaled.
//
// This module uses (1) when it exists and reports honestly when it does not.
// It never lies about hiding system UI: on Android the address bar and the
// system navigation bar are outside the page's control, so `limited` is
// reported as a state rather than pretending it worked.
//
// Every transition ends by calling `onChange` so the game can re-measure and
// re-layout WITHOUT restarting the run.

export const FS_STATE = {
  UNSUPPORTED: 'unsupported',   // no Fullscreen API at all
  WINDOWED: 'windowed',         // normal browser window
  FULLSCREEN: 'fullscreen',     // element is the fullscreen element
};

export class FullscreenController {
  /**
   * @param {HTMLElement} element - the element to make fullscreen (the canvas host)
   * @param {object} opts
   * @param {() => void} opts.onChange - called after any viewport/fullscreen change
   */
  constructor(element, { onChange = () => {} } = {}) {
    this.el = element;
    this.onChange = onChange;
    this.state = FS_STATE.UNSUPPORTED;
    this.lastError = null;
    this._bound = false;
  }

  get supported() {
    if (!this.el) return false;
    const request = this.el.requestFullscreen || this.el.webkitRequestFullscreen || this.el.mozRequestFullScreen || this.el.msRequestFullscreen;
    return typeof request === 'function';
  }

  get isFullscreen() {
    if (typeof document === 'undefined') return false;
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  }

  /** Wire up the change listeners once. Safe to call repeatedly. */
  attach() {
    if (this._bound || typeof document === 'undefined') return this;
    this._bound = true;
    const handler = () => {
      this.state = this.isFullscreen ? FS_STATE.FULLSCREEN : FS_STATE.WINDOWED;
      // Wait a frame: the viewport has not settled when the event fires.
      const run = () => {
        this.onChange();
        // Second pass after the browser finishes its chrome animation.
        if (typeof setTimeout === 'function') setTimeout(() => this.onChange(), 180);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else run();
    };
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']) {
      document.addEventListener(ev, handler);
    }
    this.state = this.isFullscreen ? FS_STATE.FULLSCREEN : FS_STATE.WINDOWED;
    return this;
  }

  /**
   * Toggle. Returns a result object rather than throwing, because a rejected
   * promise here is a normal user situation (iOS Safari, missing gesture), not
   * a crash.
   * @returns {Promise<{ok:boolean, state:string, reason?:string}>}
   */
  async toggle() {
    if (!this.supported) {
      this.state = FS_STATE.UNSUPPORTED;
      return { ok: false, state: this.state, reason: 'unsupported' };
    }
    try {
      if (this.isFullscreen) await this.exit();
      else await this.enter();
      this.state = this.isFullscreen ? FS_STATE.FULLSCREEN : FS_STATE.WINDOWED;
      return { ok: true, state: this.state };
    } catch (err) {
      // NotAllowedError = no user gesture; TypeError = iOS Safari on non-video.
      this.lastError = err;
      this.state = this.isFullscreen ? FS_STATE.FULLSCREEN : FS_STATE.WINDOWED;
      const reason = err && err.name ? err.name : 'error';
      return { ok: false, state: this.state, reason };
    }
  }

  async enter() {
    const request = this.el.requestFullscreen || this.el.webkitRequestFullscreen || this.el.mozRequestFullScreen || this.el.msRequestFullscreen;
    if (!request) throw new Error('no requestFullscreen');
    // Promise-based in modern browsers; callback-based in old WebKit.
    const result = request.call(this.el, { navigationUI: 'hide' });
    if (result && typeof result.then === 'function') await result;
  }

  async exit() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (!fn) return;
    const result = fn.call(document);
    if (result && typeof result.then === 'function') await result;
  }

  /**
   * iOS Safari (not Chrome on iOS) refuses element fullscreen entirely. The
   * honest fallback is to ask for the standalone-safe viewport, not to fake it.
   */
  get canFallback() {
    return this.supported === false;
  }
}
