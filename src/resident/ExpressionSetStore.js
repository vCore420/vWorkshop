import { EventBus } from "../core/EventBus.js";
import { EXPRESSION_TYPES, EXPRESSION_GRID_SIZE, isValidExpression } from "./ExpressionTypes.js";

let _nextId = 1;

/**
 * ExpressionSetStore
 * ---------------------
 * "Allow players to customise Bubble's expressions... expression
 * collections should become Workshop Assets... future residents should
 * naturally use the same architecture." A plain store, one entry per
 * named Expression Set — a small pixel drawing per expression, exactly
 * the same "id, name, plain data, save()/load()" shape every other
 * Workshop store already uses (`AnimationLibraryStore.js`, `BlueprintStore
 * .js`). Deliberately holds *only* what a resident's face actually needs
 * — nothing here knows or cares which resident, or how many residents,
 * currently use a given set.
 *
 * **No built-in sets shipped in code**, unlike `AnimationLibraryStore.js`'s
 * own default clips or `AtmosphereProfileStore.js`'s own six presets —
 * the built-in *default* here is the procedural drawing
 * `ResidentRenderer._drawProceduralFace()` already always provides, which
 * isn't representable as pixel data at all (it's drawn with curves, not
 * cells) and doesn't need to be. A resident with no custom Expression Set
 * selected (`expressionSetId: "default"` on its profile — see
 * `ResidentProfileStore.js`) simply keeps using that, exactly as it
 * always has. This store only ever holds what a player has actually
 * drawn.
 *
 * A set doesn't need every expression filled in to be usable — see
 * `ResidentRenderer._drawFace()`'s own comment on why a blank expression
 * quietly falls back to the built-in drawing for just that one
 * expression rather than the whole set being treated as incomplete.
 */
export class ExpressionSetStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, object>} */
    this.sets = {};
  }

  /** A brand new, entirely blank set — every expression starts fully
   *  transparent (falls back to the procedural drawing until something
   *  is actually drawn for it), the same "starts empty, not garbled" as
   *  a fresh canvas anywhere else in the Workshop. */
  create(name) {
    const set = this._buildSet(name);
    this.sets[set.id] = set;
    this._emitChanged();
    return set;
  }

  _buildSet(name) {
    const id = `expr-${_nextId++}`;
    const now = new Date().toISOString();
    return {
      id,
      name: name?.trim() || "Untitled Expressions",
      gridSize: EXPRESSION_GRID_SIZE,
      expressions: {}, // expressionId -> flat array of gridSize*gridSize colour strings/nulls — only ever populated for expressions someone has actually drawn
      createdAt: now,
      updatedAt: now,
    };
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = this._buildSet(`${source.name} (copy)`);
    copy.gridSize = source.gridSize;
    copy.expressions = Object.fromEntries(Object.entries(source.expressions).map(([exprId, pixels]) => [exprId, [...pixels]]));
    this.sets[copy.id] = copy;
    this._emitChanged();
    return copy;
  }

  rename(id, name) {
    const set = this.get(id);
    if (!set) return;
    set.name = name?.trim() || set.name;
    set.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    delete this.sets[id];
    this._emitChanged();
  }

  get(id) {
    return this.sets[id] ?? null;
  }

  all() {
    return Object.values(this.sets).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Replaces one expression's own pixel data wholesale — the Expression
   *  Creator's own "Save" action, called once per edit session rather
   *  than per brush stroke (a full grid is small enough, at
   *  `gridSize * gridSize` entries, that there's no real cost to
   *  treating a save the same "whole array, not a diff" way
   *  `TerrainSystem.js`'s own undo snapshots already do). `pixels` of
   *  `null` deletes the expression entirely from this set, returning it
   *  to the procedural fallback — the Expression Creator's own "Reset to
   *  Default" action. */
  setExpressionPixels(setId, expressionId, pixels) {
    const set = this.get(setId);
    if (!set || !isValidExpression(expressionId)) return;
    if (pixels) set.expressions[expressionId] = pixels;
    else delete set.expressions[expressionId];
    set.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  /** "Exporting expression packs." A whole set, as its own small,
   *  genuinely shareable file — the identical `type`-tagged envelope
   *  shape `ResidentProfileStore.exportProfile()` and `PersistenceSystem
   *  .exportBackup()` already established, so `docs/PERSISTENCE.md`'s
   *  own "Import & Export" account covers this one too, not a fourth
   *  independent shape. */
  exportSet(id) {
    const set = this.get(id);
    if (!set) return null;
    return { type: "workshop-expression-pack", version: 1, exportedAt: new Date().toISOString(), set };
  }

  /** "Importing shared expression packs." Validated the same way every
   *  other import in the Workshop is — a specific, actionable error for
   *  anything that isn't really an expression pack (including the other
   *  two export kinds, named specifically rather than a generic
   *  failure) — and always creates a *new* set with a fresh id, never
   *  overwriting anything already here, the same "additive, never
   *  destructive" rule `ResidentProfileStore.importProfile()` already
   *  follows. Unknown expression ids in an imported pack (from a future
   *  Workshop version with a ninth expression, say) are dropped rather
   *  than kept as orphaned data this version has no use for; known ones
   *  missing an entry — or the whole pixel array being the wrong length
   *  for this version's own grid size — are left for the procedural
   *  fallback exactly like any other incomplete set. */
  importSet(data) {
    if (!data || typeof data !== "object") throw new Error("That file doesn't look like a Workshop expression pack.");
    if (data.type && data.type !== "workshop-expression-pack") {
      if (data.type === "workshop-backup") throw new Error("That's a whole Workshop backup file, not an expression pack \u2014 import it from Settings instead.");
      if (data.type === "workshop-ai-profile") throw new Error("That's an AI profile export, not an expression pack \u2014 import it from AI Control instead.");
      throw new Error("That file doesn't look like a Workshop expression pack.");
    }
    const source = data.set ?? data; // tolerate a bare set object too, not only the wrapped envelope
    if (!source || typeof source !== "object" || typeof source.expressions !== "object") {
      throw new Error("That file doesn't look like a Workshop expression pack.");
    }

    const set = this._buildSet(source.name ? `${source.name} (imported)` : "Imported Expressions");
    const gridSize = Number.isInteger(source.gridSize) && source.gridSize > 0 ? source.gridSize : EXPRESSION_GRID_SIZE;
    set.gridSize = gridSize;
    for (const [exprId, pixels] of Object.entries(source.expressions ?? {})) {
      if (!isValidExpression(exprId)) continue;
      if (!Array.isArray(pixels) || pixels.length !== gridSize * gridSize) continue;
      set.expressions[exprId] = pixels;
    }

    this.sets[set.id] = set;
    this._emitChanged();
    return set;
  }

  _emitChanged() {
    this.events.emit("expressionSets:changed");
    this.events.emit("persistence:saveRequested");
  }

  getStatus() {
    const count = Object.keys(this.sets).length;
    return { available: true, summary: count > 0 ? `${count} custom expression set${count === 1 ? "" : "s"}.` : "No custom expression sets yet." };
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { sets: this.sets };
  }

  load(data) {
    if (!data?.sets) return;
    this.sets = data.sets;
    const maxId = Object.keys(this.sets).reduce((m, id) => {
      const match = /^expr-(\d+)$/.exec(id);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    _nextId = maxId + 1;
    this.events.emit("expressionSets:changed");
  }
}

export { EXPRESSION_TYPES };
