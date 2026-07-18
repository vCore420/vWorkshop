import { EventBus } from "../core/EventBus.js";
import { DEFAULT_BLUEPRINTS } from "./DefaultBlueprints.js";

/** A well-formed offset array or a safe fallback — the same "don't trust
 *  the file" reasoning `BodyCompiler.js`'s own `normalizedVec3()` already
 *  applies to a Being's body parts, applied here to the one field of a
 *  Blueprint object entry that would otherwise reach placement math with
 *  `undefined` in it. */
function normalizedOffset(value) {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n)) ? value : [0, 0, 0];
}

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
 *
 * **Version 3, Phase 5 ("Beyond One Building") — three starter interiors,
 * seeded by default.** "So the player can see that, by default, good
 * things can be made with the default building blocks — to give the
 * player ideas on what is capable." See `DefaultBlueprints.js` for the
 * three presets themselves. Seeded directly in the constructor (a
 * brand-new session never even reaches `load()` at all — see
 * `PersistenceSystem._loadFromStorage()`'s own early return when there's
 * no save yet) and preserved by `load()` unless the player has *any*
 * real saved blueprint data of their own, custom or otherwise — so a
 * returning player who's never touched the feature still gets the
 * starter set, while anyone who's made (or deliberately deleted) their
 * own is respected exactly as much either way.
 */
export class BlueprintStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, object>} */
    this.blueprints = { ...DEFAULT_BLUEPRINTS };
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

  /** Version 3, Phase 7 ("Sharing the Workshop") — "let creations
   *  travel... as shareable files." The same small envelope shape
   *  `ResidentProfileStore.exportProfile()`/`ExpressionSetStore
   *  .exportSet()` already established (a `type` tag so a future import
   *  can tell one Workshop export apart from another and say so plainly,
   *  rather than failing to parse silently) — deliberately not
   *  `BeingLibrary`'s own older string-in/string-out convention; this
   *  returns/accepts a plain object, the same as those two, so the UI
   *  side can use the shared `StorageUtils.downloadJSON()`/`uploadJSON()`
   *  primitives directly instead of hand-rolling file-reading. A
   *  Blueprint is already genuinely shareable as-is — its own `objects`
   *  array references construction pieces and Builder object definitions
   *  by id, which is exactly why an *imported* Blueprint referencing a
   *  Builder-authored (not Construction Library) object that doesn't
   *  exist on the receiving Workshop will simply place nothing for that
   *  one entry — the same honest "missing dependency" case
   *  `docs/ASSETS.md`'s own validation section already names, not a new
   *  problem this file needs to solve. */
  exportBlueprint(id) {
    const blueprint = this.get(id);
    if (!blueprint) return null;
    return { type: "workshop-blueprint", version: 1, exportedAt: new Date().toISOString(), blueprint: { name: blueprint.name, objects: blueprint.objects } };
  }

  /** Never trusts the file — every object entry is individually
   *  normalised, the same "a missing/malformed field gets a safe
   *  default, not a crash" standard `BodyCompiler.compileBody()` now
   *  holds itself to for the identical reason (a bad `offset` array here
   *  would otherwise reach `BuildModeSystem._confirmGhost()`'s own
   *  placement math with `undefined` in it). Always creates a genuinely
   *  new blueprint via `create()` — importing is additive, never
   *  overwrites anything by id, the same instinct every other import in
   *  this codebase already follows. */
  importBlueprint(data) {
    if (!data || typeof data !== "object") throw new Error("That file doesn't look like a Workshop Blueprint.");
    if (data.type && data.type !== "workshop-blueprint") {
      throw new Error(data.type === "workshop-backup" ? "That's a whole Workshop backup file, not a Blueprint — import it from Settings instead." : "That file doesn't look like a Workshop Blueprint.");
    }
    const source = data.blueprint ?? data; // tolerate a bare {name, objects} too, not only the wrapped envelope
    if (!source || typeof source !== "object" || !Array.isArray(source.objects)) {
      throw new Error("That file doesn't look like a Workshop Blueprint.");
    }
    const objects = source.objects
      .filter((o) => o && typeof o === "object" && typeof o.definitionId !== "undefined")
      .map((o) => ({
        definitionId: o.definitionId,
        definitionSource: o.definitionSource === "construction" ? "construction" : "library",
        offset: normalizedOffset(o.offset),
        rotationY: typeof o.rotationY === "number" && Number.isFinite(o.rotationY) ? o.rotationY : 0,
        scale: typeof o.scale === "number" && Number.isFinite(o.scale) && o.scale > 0 ? o.scale : 1,
        colorOverride: typeof o.colorOverride === "string" ? o.colorOverride : null,
      }));
    if (objects.length === 0) throw new Error("That Blueprint doesn't contain anything to place.");
    return this.create(source.name ? `${source.name} (imported)` : "Imported Blueprint", objects);
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
    if (!data) return; // no envelope reached this far at all — the constructor's own seeded defaults stand exactly as they are
    const saved = data.blueprints ?? {};
    // Any real saved blueprint data — the player's own, or a previous
    // session's already-saved copy of the starter set — is respected
    // exactly as-is, including if every default was deliberately
    // deleted. Genuinely zero saved blueprints (an old save that
    // predates this feature, or a fresh provider entry) re-seeds the
    // starter set rather than leaving a returning player with nothing.
    this.blueprints = Object.keys(saved).length > 0 ? saved : { ...DEFAULT_BLUEPRINTS };
    this.events.emit("blueprints:changed");
  }
}
