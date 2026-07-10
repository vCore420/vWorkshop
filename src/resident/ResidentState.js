import { EventBus } from "../core/EventBus.js";

/**
 * ResidentState
 * ---------------
 * "The resident should remember its state... returning to the Workshop
 * should feel like returning to someone who has continued existing
 * rather than somebody being recreated." This is deliberately narrow —
 * only the resident's own *runtime* presence (which idle location it was
 * at, its current mood) — not identity, not personality, not embodiment
 * appearance, all of which already live on the active profile in
 * `ResidentProfileStore` and are read from there live, every frame,
 * never copied here. "The resident should never duplicate these
 * settings" applies exactly as much to this store's own shape as it does
 * to `ResidentConversation.js`'s.
 *
 * Conversation history is deliberately absent — "conversation history
 * (future memory system)" is explicitly a future phase's own concern
 * (see `MemoryConfiguration.js`'s own "architecture, not implementation"
 * framing), not something to half-build here ahead of a real memory
 * system existing to actually use it.
 */
export class ResidentState {
  constructor() {
    this.events = new EventBus();
    this.idleLocationId = null; // resolved to an actual position by ResidentMovement.js
    this.mood = "content"; // a plain label ResidentBehaviour.js/ResidentRenderer.js both read — see ResidentBehaviour.js's own MOOD list
  }

  setIdleLocation(id) {
    if (this.idleLocationId === id) return;
    this.idleLocationId = id;
    this._emitChanged();
  }

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this._emitChanged();
  }

  _emitChanged() {
    this.events.emit("state:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { idleLocationId: this.idleLocationId, mood: this.mood };
  }

  load(data) {
    if (!data) return;
    this.idleLocationId = data.idleLocationId ?? null;
    this.mood = data.mood ?? "content";
    this.events.emit("state:changed");
  }
}
