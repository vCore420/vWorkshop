import { EventBus } from "../core/EventBus.js";

/**
 * BlueprintStore
 * ----------------
 * "Blueprints are reusable Builder creations... Blueprints should simply
 * become another type of Builder asset." A blueprint is a saved cluster
 * of World Objects and their relative positions to each other — a garden
 * shed's four walls, roof, and door, captured together — not a single
 * new kind of object the way a Construction piece or a Builder-designed
 * object is. Placing one creates that many *independent*
 * `WorldObjectsStore` instances at once, positioned relative to wherever
 * it was placed; "players should still be able to modify them after
 * placement" is true by construction, since each one is an ordinary,
 * separately-selectable World Object the moment it exists, not a single
 * combined thing with its own special editing rules.
 *
 * **How a blueprint is captured.** Real multi-selection exists as of the
 * Builder Evolution phase (shift-click, drag-select — see
 * `BuildModeSystem.js`'s own "Multi-Selection" section) — "Save as
 * Blueprint" from a multi-selection screen captures *exactly* the
 * selected objects (`BuildModeSystem._captureSelectionAsBlueprintObjects()`),
 * no guessing involved. The original, radius-based capture (select one
 * piece of an already-built cluster and everything within a chosen
 * distance comes with it — `captureBlueprintNearSelection()`) still
 * exists as a genuinely useful quick option when only a single object is
 * selected, not a compromise being carried forward — sometimes "grab
 * everything nearby" really is faster than selecting each piece by hand.
 */
export class BlueprintStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, object>} */
    this.blueprints = {};
  }

  /** `objects` is `[{definitionId, definitionSource, offset: [x,y,z],
   *  rotationY, scale, colorOverride}]` — every position already relative
   *  to wherever the blueprint was captured, so placing it anywhere just
   *  means adding the new placement point to each one's own offset. */
  create(name, objects) {
    const id = `blueprint-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const blueprint = { id, name: name?.trim() || "Untitled Blueprint", objects, createdAt: new Date().toISOString() };
    this.blueprints[id] = blueprint;
    this._emitChanged();
    return blueprint;
  }

  /** "Update... replace." Re-captures a blueprint's own object list in
   *  place — same id, same name, same createdAt — the one method that
   *  lets an already-placed, already-shared blueprint be brought up to
   *  date with how its own pieces have since been rearranged, rather
   *  than only ever being able to save a brand new one under a new id.
   *  Called by `BuildModeSystem.updateBlueprintFromSelection()`. */
  update(id, objects) {
    const blueprint = this.get(id);
    if (!blueprint) return null;
    blueprint.objects = objects;
    blueprint.updatedAt = new Date().toISOString();
    this._emitChanged();
    return blueprint;
  }

  rename(id, name) {
    const blueprint = this.get(id);
    if (!blueprint) return;
    blueprint.name = name?.trim() || blueprint.name;
    this._emitChanged();
  }

  remove(id) {
    delete this.blueprints[id];
    this._emitChanged();
  }

  get(id) {
    return this.blueprints[id] ?? null;
  }

  all() {
    return Object.values(this.blueprints).sort((a, b) => a.name.localeCompare(b.name));
  }

  _emitChanged() {
    this.events.emit("blueprints:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { blueprints: this.blueprints };
  }

  load(data) {
    if (!data) return;
    this.blueprints = data.blueprints ?? {};
    this.events.emit("blueprints:changed");
  }
}
