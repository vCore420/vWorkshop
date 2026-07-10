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
    this.idleLocationId = null; // the resident's current destination — see ResidentMovement.js's own "idleLocationId is set the moment travel starts" behaviour
    this.mood = "content"; // a plain label ResidentBehaviour.js/ResidentRenderer.js both read — see ResidentBehaviour.js's own MOOD list
    // "Current position... current idle destination... current movement
    // state... current facing direction... current expression... current
    // connection state." currentPosition is genuinely restored on load —
    // see ResidentController.js's own comment on how (idleLocationId
    // above already covers "current idle destination"; "current movement
    // state" isn't tracked separately since ResidentBehaviour's own mode
    // is reconstructed fresh, not meaningful to restore mid-transition).
    // facingDirection/expression/connectionState are last-known
    // *snapshots* only, plain fields written every frame the same way
    // currentPosition is, but never read back to drive behaviour — the
    // resident's actual visual orientation is already recomputed fresh
    // each frame from its idle location's own look-at target (already
    // restored via idleLocationId) plus continuous procedural sway, and
    // its expression/connection state must always reflect the live mood
    // and the actual current Ollama connection, never a stale persisted
    // value from last session.
    this.currentPosition = null; // {x, y, z} | null — null only before the very first frame ever runs
    this.facingDirection = 0; // radians (rotation.y) — last known only, see comment above
    this.expression = "content"; // last known only — see comment above
    this.connectionState = "connecting"; // last known only — see comment above
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
    return {
      idleLocationId: this.idleLocationId,
      mood: this.mood,
      currentPosition: this.currentPosition,
      facingDirection: this.facingDirection,
      expression: this.expression,
      connectionState: this.connectionState,
    };
  }

  load(data) {
    if (!data) return;
    this.idleLocationId = data.idleLocationId ?? null;
    this.mood = data.mood ?? "content";
    this.currentPosition = data.currentPosition ?? null;
    this.facingDirection = data.facingDirection ?? 0;
    this.expression = data.expression ?? "content";
    this.connectionState = data.connectionState ?? "connecting";
    this.events.emit("state:changed");
  }
}
