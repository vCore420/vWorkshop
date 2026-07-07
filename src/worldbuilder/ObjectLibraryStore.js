import { EventBus } from "../core/EventBus.js";

/**
 * ObjectLibraryStore
 * -------------------
 * Every object designed in the computer's Builder app lives here as a
 * `WorkshopObjectDefinition` — a plain data description, never a live
 * Three.js object:
 *
 *   {
 *     id, name, description, category, tags: string[],
 *     defaultScale: number, defaultRotationY: number (radians),
 *     parts: [ { id, type, position:[x,y,z], rotationY, scale:[x,y,z], color, segments? } ],
 *     behaviours: [ { type, properties: {...} } ],
 *     version: 1,
 *     createdAt, updatedAt,
 *   }
 *
 * This store has no idea what a "part" looks like once built, or what a
 * "behaviour" does — see ObjectCompiler.js and behaviours/registry.js for
 * that. Keeping this store dumb is what makes definitions safe to persist
 * and safe to evolve: `load()` fills in sensible defaults for any field an
 * older save file might be missing (see the "safe versioning" comment
 * below), the same defensive pattern ProjectsStore already uses.
 *
 * A definition is shared, not copied: every placed instance
 * (WorldObjectsStore) just references a definition's `id`. Editing a
 * definition here is meant to visibly update every instance of it already
 * placed in the world — see WorldObjectsSystem.refreshInstancesOfDefinition.
 */
let _nextId = 1;
let _nextPartId = 1;

const CURRENT_VERSION = 1;

export class ObjectLibraryStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} */
    this.definitions = [];
  }

  nextPartId() {
    return `part-${_nextPartId++}`;
  }

  create({ name, description = "", category = "Other", tags = [], defaultScale = 1, defaultRotationY = 0, parts = [], behaviours = [] }) {
    const definition = {
      id: _nextId++,
      name: name?.trim() || "Untitled object",
      description,
      category,
      tags,
      defaultScale,
      defaultRotationY,
      parts,
      behaviours,
      version: CURRENT_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.definitions.push(definition);
    this.events.emit("library:changed", this.definitions);
    return definition;
  }

  update(id, patch) {
    const def = this.definitions.find((d) => d.id === id);
    if (!def) return null;
    Object.assign(def, patch, { updatedAt: new Date().toISOString() });
    this.events.emit("library:changed", this.definitions);
    this.events.emit("library:definitionUpdated", { id });
    return def;
  }

  duplicate(id) {
    const source = this.definitions.find((d) => d.id === id);
    if (!source) return null;
    const copy = this.create({
      ...source,
      name: `${source.name} copy`,
      parts: source.parts.map((p) => ({ ...p, id: this.nextPartId() })),
      behaviours: source.behaviours.map((b) => ({ ...b, properties: { ...b.properties } })),
    });
    return copy;
  }

  remove(id) {
    this.definitions = this.definitions.filter((d) => d.id !== id);
    this.events.emit("library:changed", this.definitions);
    this.events.emit("library:definitionRemoved", { id });
  }

  get(id) {
    return this.definitions.find((d) => d.id === id) ?? null;
  }

  all() {
    return [...this.definitions];
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { definitions: this.definitions };
  }

  load(data) {
    if (!data?.definitions) return;
    // Safe versioning: fill in anything a future schema change might add,
    // rather than trusting the save file to already have it.
    this.definitions = data.definitions.map((d) => ({
      description: "",
      category: "Other",
      tags: [],
      defaultScale: 1,
      defaultRotationY: 0,
      parts: [],
      behaviours: [],
      version: CURRENT_VERSION,
      ...d,
    }));
    const maxId = this.definitions.reduce((m, d) => Math.max(m, d.id), 0);
    _nextId = maxId + 1;
    let maxPartNum = 0;
    for (const def of this.definitions) {
      for (const part of def.parts) {
        const match = /^part-(\d+)$/.exec(part.id ?? "");
        if (match) maxPartNum = Math.max(maxPartNum, parseInt(match[1], 10));
      }
    }
    _nextPartId = maxPartNum + 1;
    this.events.emit("library:changed", this.definitions);
  }
}
