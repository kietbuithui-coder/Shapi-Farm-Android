// Tiny event bus — decouples gameplay from audio, VFX and UI.
export class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    let list = this.map.get(type);
    if (!list) { list = []; this.map.set(type, list); }
    list.push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const list = this.map.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  once(type, fn) {
    const off = this.on(type, (...args) => { off(); fn(...args); });
    return off;
  }
  emit(type, payload) {
    const list = this.map.get(type);
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }
  clear() { this.map.clear(); }
}
