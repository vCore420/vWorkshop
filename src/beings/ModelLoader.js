import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * ModelLoader
 * -------------
 * The third piece of the model asset split, alongside `ModelLibrary.js`
 * (metadata) and `ModelAssetStore.js` (raw bytes): turning a model id
 * into an actual, usable `THREE.Object3D`. Deliberately its own file
 * rather than a method on either of those — neither the metadata index
 * nor the IndexedDB wrapper has any business knowing what a
 * `GLTFLoader` is, and a future "additional formats" phase (the brief's
 * own words) only ever touches this file.
 *
 * Parsed results are cached by model id — `GLTFLoader.parse()` is real,
 * non-trivial work, and "reused by Beings, Builder, Player, future
 * systems" means the same model is very likely to be requested more than
 * once in a session. Every caller gets back a *clone* of the cached
 * scene graph (plain `.clone(true)`, not `SkeletonUtils.clone` — correct
 * for simple, unanimated Beings, the common case for a first pass; a
 * skinned/animated rig sharing its skeleton across clones is a real
 * limitation worth knowing about rather than silently getting wrong —
 * see this file's own "Known limitations" note in docs/BEINGS.md), so
 * placing the same model twice never means one instance secretly moving
 * the other's own mesh around.
 */
export class ModelLoader {
  constructor(modelLibrary, modelAssetStore) {
    this.modelLibrary = modelLibrary;
    this.modelAssetStore = modelAssetStore;
    this._gltfLoader = new GLTFLoader();
    this._cache = new Map(); // modelId -> Promise<THREE.Object3D> (the parsed, un-cloned original)
  }

  /** Resolves to a fresh clone of the model's scene graph, or `null` if
   *  the model doesn't exist or fails to parse — callers (Being
   *  rendering, the Creator's own preview) are expected to fall back to
   *  a placeholder shape rather than leaving nothing visible at all. */
  async load(modelId) {
    if (!modelId) return null;
    if (!this._cache.has(modelId)) this._cache.set(modelId, this._parse(modelId));
    try {
      const original = await this._cache.get(modelId);
      return original ? original.clone(true) : null;
    } catch {
      this._cache.delete(modelId); // don't let one failed parse permanently poison the cache — a re-import under the same id should get a fresh attempt
      return null;
    }
  }

  async _parse(modelId) {
    const meta = this.modelLibrary.get(modelId);
    const data = await this.modelAssetStore.get(modelId);
    if (!meta || !data) return null;

    // GLTFLoader.parse() accepts both an ArrayBuffer (.glb) and a JSON
    // string (.gltf) uniformly — the format distinction only mattered for
    // *storage* (ModelAssetStore.js), not for parsing itself. Plain-text
    // .gltf only works here when self-contained (embedded base64 data
    // URIs for buffers/textures, no external .bin/image references) — the
    // honest limit of "clean import architecture... additional formats
    // can be added in future phases" for this one.
    return new Promise((resolve, reject) => {
      this._gltfLoader.parse(data, "", (gltf) => resolve(gltf.scene), reject);
    });
  }

  /** A small, honest placeholder — "no built-in content is required,"
   *  but a Being with no model chosen yet (or one whose model failed to
   *  load) still needs *something* visible rather than nothing at all.
   *  Deliberately plain — a soft capsule, not trying to look like a
   *  finished creature — so it reads clearly as "not yet given a model"
   *  rather than as a real, intentional design choice. */
  buildPlaceholder() {
    const group = new THREE.Group();
    const geometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: "#8fa89c", roughness: 0.7, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.55;
    group.add(mesh);
    return group;
  }
}
