/**
 * EventBus
 * --------
 * The nervous system of the workshop. Systems never call each other directly —
 * they publish events ("time:changed", "interact:start", "weather:changed")
 * and anything that cares can subscribe. This is what lets us add a brand new
 * system later (say, a seasonal-decorations system) without touching the code
 * of any system that already exists: it just subscribes to the events it needs.
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(eventName, handler) {
    if (!this._listeners.has(eventName)) this._listeners.set(eventName, new Set());
    this._listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    this._listeners.get(eventName)?.delete(handler);
  }

  emit(eventName, payload) {
    const handlers = this._listeners.get(eventName);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] listener for "${eventName}" threw:`, err);
      }
    }
  }
}
