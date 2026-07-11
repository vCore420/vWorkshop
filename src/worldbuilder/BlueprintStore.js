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
 * **How a blueprint is captured**: rather than building a full
 * multi-object selection UI (a substantial interaction surface this
 * phase's own time didn't stretch to), "Save as Blueprint" captures
 * every World Object within a chosen radius of the *currently selected*
 * one — select any single piece of an already-built cluster (one wall of
 * a shed, say) and everything else nearby comes with it. A real,
 * acknowledged simplification, not a hidden one — see
 * `BuildModeSystem.js`'s own `captureBlueprintNearSelection()` and
 * docs/WORLD.md's own account of it.
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
