import { EventBus } from "../core/EventBus.js";
import { normalizeMovementStyle, normalizeIdleBehaviour, normalizeAwarenessMode, normalizeInteractionBehaviour, normalizeBeingType } from "./BeingBehaviours.js";

const DEFINITION_VERSION = 1; // bumped if the shape below ever changes in a way import() needs to know about

/**
 * BeingLibrary
 * --------------
 * "Beings should also become Workshop assets. Players should create
 * Beings in exactly the same way they already create Builder objects,
 * animations and player appearances." This is that library — the same
 * "definitions live here, separate from wherever they're placed" split
 * `ObjectLibraryStore`/`WorldObjectsStore` already established for
 * Builder objects, and `AnimationLibraryStore` already established for
 * clips. `BeingInstanceStore.js` is this phase's own `WorldObjectsStore`
 * equivalent — a placed Being is a thin reference to one of these
 * definitions plus its own position/state, never a copy of the
 * definition itself.
 *
 * "Creating a Being should not automatically place it into the world.
 * Saving and placing should remain separate actions" — this file has no
 * concept of "the world" at all; nothing here ever touches a scene,
 * position, or instance. `BeingSpawnerSystem.js` is the only place that
 * turns a definition into something actually standing in the Workshop.
 *
 * **`bodySource`/`bodyParts`, new in the Being Creator phase.** "The
 * Workshop should allow creators to build life from nothing. Not just
 * import it." A Being's own body now comes from one of two genuinely
 * different places — `bodySource: "model"` (an imported `.glb`/`.gltf`,
 * `modelId` pointing into `ModelLibrary`, unchanged from earlier phases)
 * or `bodySource: "primitives"` (`bodyParts`, a flat array of primitive
 * shapes with their own parent-child relationships — see
 * `BodyCompiler.js` for how that becomes a real, riggable
 * `THREE.Object3D`). Both are equally real Workshop Assets; neither is a
 * fallback for the other. `bodyParts` is plain, portable JSON — unlike
 * `modelId`, which points at binary data local to this Workshop's own
 * `ModelAssetStore`, a primitive-built Being's own body genuinely
 * survives `exportDefinition()`/`importDefinition()` intact, carried over
 * exactly like every other plain field.
 */
export class BeingLibrary {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, object>} */
    this.beings = {};
  }

  _buildDefinition(name) {
    const id = `being-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const now = new Date().toISOString();
    return {
      id,
      name: name?.trim() || "Untitled Being",
      description: "",
      beingType: "custom",
      tags: [],
      modelId: null,
      bodySource: "model", // "model" | "primitives" — see this class's own comment
      bodyParts: [], // populated only when bodySource === "primitives" — see BodyCompiler.js
      scale: 1,
      movementStyle: "static",
      idleBehaviour: "stand",
      walkSpeed: 1.2,
      turnSpeed: 2.5,
      homeRadius: 2.5,
      awarenessMode: "ignorePlayer",
      interactionBehaviour: "none",
      idleAnimationClipId: null, // references AnimationLibraryStore — see docs/BEINGS.md's own "Animation Integration" section
      walkAnimationClipId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  create(name) {
    const being = this._buildDefinition(name);
    this.beings[being.id] = being;
    this._emitChanged();
    return being;
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = this._buildDefinition(`${source.name} (copy)`);
    Object.assign(copy, structuredClone(source), { id: copy.id, name: copy.name, createdAt: copy.createdAt, updatedAt: copy.updatedAt });
    this.beings[copy.id] = copy;
    this._emitChanged();
    return copy;
  }

  rename(id, name) {
    const being = this.get(id);
    if (!being) return;
    being.name = name?.trim() || being.name;
    being.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  remove(id) {
    delete this.beings[id];
    this._emitChanged();
  }

  update(id, patch) {
    const being = this.get(id);
    if (!being) return;
    Object.assign(being, patch);
    being.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  get(id) {
    return this.beings[id] ?? null;
  }

  all() {
    return Object.values(this.beings).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** A plain JSON string — "Export... Import" from the brief's own
   *  Being Library section. Deliberately excludes `id`/timestamps
   *  (`import()` always mints a fresh id, exactly like pasting a
   *  duplicate) so importing the same exported file twice, or sharing it
   *  with someone else's Workshop, never collides with an id that
   *  already means something different there. */
  exportDefinition(id) {
    const being = this.get(id);
    if (!being) return null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...portable } = being;
    return JSON.stringify({ version: DEFINITION_VERSION, being: portable }, null, 2);
  }

  /** Accepts exactly what `exportDefinition()` produces. Normalizes every
   *  enum field through `BeingBehaviours.js`'s own `normalize*()`
   *  functions rather than trusting the file — an export from a future
   *  version of the Workshop with a behaviour id this version doesn't
   *  recognise falls back to a safe default instead of silently carrying
   *  an unknown value into `BeingController.js`'s own switch statements. */
  importDefinition(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("That doesn't look like a valid Being file.");
    }
    const portable = parsed?.being;
    if (!portable || typeof portable !== "object") throw new Error("That file doesn't contain a Being definition.");

    const being = this._buildDefinition(portable.name);
    Object.assign(being, portable, {
      id: being.id,
      createdAt: being.createdAt,
      updatedAt: being.updatedAt,
      beingType: normalizeBeingType(portable.beingType),
      movementStyle: normalizeMovementStyle(portable.movementStyle),
      idleBehaviour: normalizeIdleBehaviour(portable.idleBehaviour),
      awarenessMode: normalizeAwarenessMode(portable.awarenessMode),
      interactionBehaviour: normalizeInteractionBehaviour(portable.interactionBehaviour),
      tags: Array.isArray(portable.tags) ? portable.tags : [],
      // "Not just import it" — a primitive-built body is plain, portable
      // JSON with no dependency on this Workshop's own local files, so it
      // survives import/export intact, unlike modelId below.
      bodySource: portable.bodySource === "primitives" ? "primitives" : "model",
      bodyParts: Array.isArray(portable.bodyParts) ? portable.bodyParts : [],
      // modelId deliberately NOT carried over — the model it references
      // lives in this Workshop's own ModelLibrary/ModelAssetStore, which
      // an imported JSON file has no access to at all. Left null rather
      // than pointing at a model id that doesn't exist here; the Being
      // Creator's own placeholder (ModelLoader.buildPlaceholder()) covers
      // the gap until a real model is chosen.
      modelId: null,
    });
    this.beings[being.id] = being;
    this._emitChanged();
    return being;
  }

  _emitChanged() {
    this.events.emit("beings:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { beings: this.beings };
  }

  load(data) {
    if (!data) return;
    this.beings = data.beings ?? {};
    for (const being of Object.values(this.beings)) {
      if (being.bodySource !== "primitives") being.bodySource = "model"; // a Being saved before this phase existed
      if (!Array.isArray(being.bodyParts)) being.bodyParts = [];
    }
    this.events.emit("beings:changed");
  }
}
