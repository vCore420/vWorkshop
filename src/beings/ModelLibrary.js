import { EventBus } from "../core/EventBus.js";

/**
 * ModelLibrary
 * --------------
 * "Models should not belong only to Beings. Instead, imported models
 * become Workshop assets that can later be reused by: Beings, Builder,
 * Player, Future systems." The same "index is never the same store as
 * the actual bytes" split every binary asset in this project already
 * uses (see `ImageLibraryStore.js`'s own comment) — this stays ordinary
 * JSON through the normal `PersistenceSystem` path, small regardless of
 * how large the models themselves are; `ModelAssetStore.js` holds the
 * real file data.
 *
 * Deliberately knows nothing about Beings specifically — `format`
 * (`"glb"` | `"gltf"`) is the only thing beyond a plain name this index
 * needs, since *how* a model gets used (as a Being's body, a Builder
 * shape, a future player accessory) is entirely up to whichever system
 * resolves it through `ModelLoader.js`, not something this library
 * itself should know or care about.
 *
 * **`skeletonMap`, new in the Advanced Animation phase.** A plain
 * `{jointId: boneName}` object — Workshop joint ids (see
 * `WorkshopSkeleton.js`) mapped to *names* of bones in this model's own
 * rig, not live `THREE.Bone` references. Bone objects are recreated
 * fresh every time `ModelLoader.load()` clones the model (a new
 * `THREE.Object3D` graph each time, by design — see that file's own
 * comment), so there's nothing stable about a bone object itself to
 * persist; its own *name*, resolved back against whichever fresh clone
 * is actually in the scene, is what's stable. `BeingController.js` is
 * what actually resolves this map into live bone references (and
 * captures their own rest quaternions fresh) each time a model loads —
 * see its own comment. `null` means "never auto-mapped, or mapping
 * wasn't usable" — see `WorkshopSkeleton.isSkeletonMapUsable()`.
 */
export class ModelLibrary {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, {id:string, name:string, format:string, addedAt:number, skeletonMap: Record<string,string>|null, yawOffset:number}>} */
    this.models = {};
  }

  add(name, format) {
    const id = `model-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    this.models[id] = { id, name, format, addedAt: Date.now(), skeletonMap: null, yawOffset: 0 };
    this._emitChanged();
    return id;
  }

  /**
   * Version 4, Phase 12 ("Animation Orientation, End to End") — which way
   * this particular model considers "forward", in radians of yaw.
   *
   * **Why this has to exist, and why it belongs on the model rather than
   * on a Being.** The Workshop's own rigs all face **+Z** at zero
   * rotation: `BodyCompiler`-built bodies do, and so does the player's
   * (its root carries a `+π` only because the *camera's* yaw convention
   * puts forward at −Z; the rig underneath still faces +Z). Everything
   * downstream assumes it — `BeingController` sets facing with
   * `root.rotation.y = atan2(look.x, look.z)`, and every animation clip
   * is authored against it.
   *
   * An imported `.glb`/`.gltf` makes no such promise. Which way a model
   * faces is entirely up to whoever exported it, and a great many
   * character models face −Z. Until this phase the Workshop had **no
   * correction of any kind** — `ModelLoader` parses and clones, and
   * `BeingController` did `root.add(model)` with the model's own
   * orientation untouched. A −Z-facing model therefore walked backwards
   * and played every animation mirrored front-to-back, which is exactly
   * what Vi reported ("a lot of imported models play animations backwards
   * or flipped... some spawned imported model beings move backwards").
   *
   * It lives here, beside `skeletonMap`, because it is a fact about the
   * *model* in exactly the same way: correct it once and every Being
   * using that model is fixed, rather than every Being needing its own
   * copy of the same correction. Defaults to `0`, so a model that already
   * faces +Z — and every model imported before this field existed — is
   * completely unaffected.
   *
   * Deliberately **not** auto-detected. There is no reliable way to infer
   * which way a mesh "faces" (a nose is not a thing a bounding box can
   * see), and guessing wrong would be worse than not guessing: it would
   * silently break models that were previously correct. The player can
   * see the answer instantly and set it in one click.
   */
  setYawOffset(id, radians) {
    const model = this.models[id];
    if (!model) return;
    model.yawOffset = Number.isFinite(radians) ? radians : 0;
    this._emitChanged();
  }

  rename(id, name) {
    const model = this.models[id];
    if (!model) return;
    model.name = name;
    this._emitChanged();
  }

  /** Called once, the first time a model's own skeleton is successfully
   *  auto-mapped (see `BeingController.js`) — cached so every subsequent
   *  spawn of the same model resolves bone *names* straight away rather
   *  than re-running the heuristic matcher on every single clone. `map`
   *  is `{jointId: boneName}` — plain strings, not live objects (see this
   *  class's own comment). Passing `null` clears a previously-cached
   *  mapping (a manual "forget this and re-detect" action, or a
   *  currently-honest "no editing UI exists yet for fixing an
   *  individual wrong entry" — see docs/ANIMATION.md's own "Known
   *  simplifications"). */
  setSkeletonMap(id, map) {
    const model = this.models[id];
    if (!model) return;
    model.skeletonMap = map;
    this._emitChanged();
  }

  remove(id) {
    delete this.models[id];
    this._emitChanged();
  }

  get(id) {
    return this.models[id] ?? null;
  }

  all() {
    return Object.values(this.models).sort((a, b) => b.addedAt - a.addedAt);
  }

  _emitChanged() {
    this.events.emit("library:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { models: this.models };
  }

  load(data) {
    if (!data) return;
    this.models = data.models ?? {};
    for (const model of Object.values(this.models)) {
      if (model.skeletonMap === undefined) model.skeletonMap = null; // a model saved before this phase existed
      // Version 4, Phase 12 — same pattern, same reason: a model imported
      // before `yawOffset` existed defaults to 0, which is exactly the
      // uncorrected behaviour it already had. No migration needed.
      if (typeof model.yawOffset !== "number") model.yawOffset = 0;
    }
    this.events.emit("library:changed");
  }
}

/** Living Spaces phase — "extend an existing pathway before creating a
 *  new one." The Builder's own "Import Model" button
 *  (`BuildModeSystem.importModel()`) and the Being Creator's
 *  (`BeingCreatorApp.js`'s own import handler) had each grown an
 *  independent copy of the identical five steps: read the file's
 *  extension to decide `.glb` vs `.gltf`, read it as bytes or text
 *  accordingly, register a new `ModelLibrary` entry, store the raw
 *  bytes. Both already converge on the same underlying model — a
 *  `ModelLibrary` id backed by `ModelAssetStore` bytes — so the *data*
 *  was always genuinely shared; only the code that produces it wasn't.
 *  One function both callers call now. Throws on an unreadable file —
 *  each caller already has its own established way of surfacing that
 *  (`BuildModeSystem.importModel()`'s own doc comment; the Being
 *  Creator's `window.alert`), so this doesn't try to unify that part. */
export async function importModelFile(file, { modelLibrary, modelAssetStore }) {
  const isGltf = file.name.toLowerCase().endsWith(".gltf");
  const data = isGltf ? await file.text() : await file.arrayBuffer();
  const modelId = modelLibrary.add(file.name.replace(/\.(glb|gltf)$/i, ""), isGltf ? "gltf" : "glb");
  await modelAssetStore.put(modelId, data);
  return modelId;
}
