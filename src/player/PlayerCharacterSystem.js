import * as THREE from "three";
import { buildCharacter, disposeCharacter, FIRST_PERSON_HIDDEN_LAYER } from "./PlayerCharacter.js";
import { CameraSystem } from "../systems/CameraSystem.js";
import { debounce } from "../utils/debounce.js";

const REBUILD_DEBOUNCE_MS = 120; // see _scheduleRebuild
const DEFAULT_EYE_HEIGHT = 1.65; // fallback for getEyeHeight() before the very first rebuild ever finishes

/**
 * PlayerCharacterSystem
 * -----------------------
 * Owns the one live character mesh in the scene and keeps it looking like
 * whatever `PlayerAppearanceStore` currently says it should — rebuilding
 * (see `PlayerCharacter.buildCharacter`'s own comment on why a full rebuild,
 * not a patch) whenever the appearance changes, debounced so dragging a
 * proportion slider doesn't trigger an overlapping rebuild (each one needs
 * to resolve texture images from `TextureStore` first, which is async) on
 * every single input event.
 *
 * The rig silently follows the camera's position and yaw every frame,
 * full stop — no special-casing for sitting at the computer or anywhere
 * else. While focused (sitting at a desk, say), the camera simply holds
 * still, so the rig harmlessly keeps re-copying the same frozen position;
 * nothing here needs to know that's happening. "First-person... should
 * normally never see themselves" is mostly true by construction — the
 * torso/arms/legs just naturally sit at/below the camera facing the same
 * direction, the same reason you don't normally see your own face in a
 * real first-person view unless you look down. The head is the one part
 * that needed a real, deliberate fix rather than relying on that same
 * luck: standing happens to put the camera exactly inside the head mesh
 * (backface culling hides it too), but crouching moves the camera without
 * moving the rig — nothing here ever translates a pivot, only rotates
 * (see `PlayerCharacter.js`'s own `applyPose()`) — leaving the head
 * visibly floating above it. `FIRST_PERSON_HIDDEN_LAYER` (see its own
 * comment in `PlayerCharacter.js`, tagged onto the head mesh in
 * `_rebuild()` below, and toggled by `CameraSystem.js`) excludes the head
 * from the first-person camera explicitly instead, which holds at every
 * crouch depth, not just while standing.
 *
 * The Wardrobe app's live preview (see docs/PLAYER.md) is deliberately
 * *not* this system moving the main camera to look at the character — an
 * earlier version of this system tried exactly that, and ran straight
 * into the computer's screen-projected panel, which repositions itself
 * every frame on the assumption the camera is looking at the monitor;
 * looking away to view a character elsewhere would have broken that
 * projection outright. Instead, the Wardrobe renders its own small,
 * isolated preview scene — the exact same pattern the Builder app's
 * `PreviewRenderer` already uses for its live object preview — which
 * needed no changes here at all.
 */
export class PlayerCharacterSystem {
  constructor({ appearanceStore, textureStore, modelLoader }) {
    this.appearanceStore = appearanceStore;
    this.textureStore = textureStore;
    this.modelLoader = modelLoader;
    this._current = null;
    this._scheduleRebuild = debounce(() => this._rebuild(), REBUILD_DEBOUNCE_MS);
    this._rebuildInFlight = false;
    this._rebuildAgainAfter = false;
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this.appearanceStore.events.on("appearance:changed", () => this._scheduleRebuild());
  }

  /** Called once from main.js, after engine.init() resolves — same
   *  finalizeInitialState() pattern as WorkbenchSystem/MusicSystem, for the
   *  same reason: the appearance store's *loaded* data isn't there yet
   *  during init(). */
  async finalizeInitialState() {
    await this._rebuild();
  }


  async _rebuild() {
    if (this._rebuildInFlight) {
      // Another change arrived mid-rebuild — resolving textures is async,
      // so this can genuinely happen. Don't stack concurrent rebuilds;
      // just remember to run one more once this one finishes.
      this._rebuildAgainAfter = true;
      return;
    }
    this._rebuildInFlight = true;

    // "Allow imported Workshop models to become optional player models
    // through the Wardrobe system." An honest, contained addition rather
    // than a deep rework of this system: an imported model has no reason
    // to share the procedural rig's own named pivots
    // (upperLegLeft/torso/etc), so it renders as itself — correctly
    // positioned, correctly eye-heighted from its own real bounding box —
    // but `pivots: {}` means PlayerAnimationSystem's own applyPose() calls
    // simply have nothing to iterate, a safe no-op rather than a crash or
    // a silently-wrong pose.
    const importedModelId = this.appearanceStore.importedModelId;
    let next = importedModelId && this.modelLoader ? await this._buildImportedModelRig(importedModelId) : null;
    if (!next) {
      const textureImages = await resolveTextureImages(this.appearanceStore.appearance, this.textureStore);
      next = buildCharacter(this.appearanceStore.appearance, this.appearanceStore.bodyModelId, textureImages);
    }
    // See FIRST_PERSON_HIDDEN_LAYER's own comment in PlayerCharacter.js —
    // safe no-op for an imported-model rig, which has no `meshes.head`.
    next.meshes?.head?.layers.set(FIRST_PERSON_HIDDEN_LAYER);
    this._attachHeadShadowProxy(next);

    if (this._current) {
      this.engine.scene.remove(this._current.root);
      this._disposeHeadShadowProxy(this._current); // before disposeCharacter — it shares the head's geometry
      disposeCharacter(this._current);
    }
    this._current = next;
    this.engine.scene.add(this._current.root);

    this._rebuildInFlight = false;
    if (this._rebuildAgainAfter) {
      this._rebuildAgainAfter = false;
      this._rebuild();
    }
  }

  /**
   * Version 4, Phase 11 ("The Player's Own Body") — "no player head in
   * shadow... maybe we rework this system?"
   *
   * **Root cause, and it means the previous fix never worked at all.**
   * Version 3 Phase 3b added `sun.shadow.camera.layers.enable(
   * FIRST_PERSON_HIDDEN_LAYER)` in `LightingSystem.js` for exactly this
   * symptom, and the name of that property makes it read as though it
   * should work. It is a **no-op for this purpose**. Three.js's shadow
   * pass tests each object against the *scene* camera's layers, not the
   * shadow camera's — verified by reading r164's own source rather than
   * from memory:
   *
   * ```js
   * function renderObject( object, camera, shadowCamera, light, type ) {
   *   if ( object.visible === false ) return;
   *   const visible = object.layers.test( camera.layers );
   * ```
   *
   * `camera` there is the camera passed to `WebGLShadowMap.render()` —
   * the one actually rendering the frame. So while the player is in first
   * person, `CameraSystem` disables `FIRST_PERSON_HIDDEN_LAYER` on the
   * main camera to hide the head from the view, and that same disable
   * silently removes the head from the shadow map too. The head was never
   * going to cast a shadow in first person, whatever the shadow camera's
   * own layers said.
   *
   * **The fix: a shadow-only proxy.** A second mesh sharing the real
   * head's geometry, parented to the same pivot so it follows every
   * animation and head-turn for free, which:
   *
   *   - stays on the **default layer**, so the main camera's layer test
   *     passes and the shadow pass therefore includes it;
   *   - draws nothing in any ordinary render pass (`colorWrite: false`,
   *     `depthWrite: false`), so it is invisible to the first-person
   *     camera, the mirror, and the third-person view alike;
   *   - is the only head caster — the real head mesh has `castShadow`
   *     turned off here, so the two can never both write to the shadow
   *     map and fight over the same depth.
   *
   * Shadow rendering substitutes its own depth material for the object's,
   * so `colorWrite`/`depthWrite` being off on this one never reaches the
   * shadow pass — which is precisely what makes an invisible caster
   * possible at all.
   *
   * The real head keeps its own layer assignment unchanged, so it remains
   * visible in the mirror and in third person exactly as before. Nothing
   * about `PlayerCharacter.buildCharacter()` changed either: the Wardrobe
   * preview and Animation Editor build the same rig and simply never get
   * a proxy, since neither casts a sun shadow.
   */
  _attachHeadShadowProxy(rig) {
    const head = rig.meshes?.head;
    if (!head) return; // imported-model rigs have no `meshes.head` — see above
    head.castShadow = false;

    const proxy = new THREE.Mesh(
      head.geometry, // shared deliberately — disposed once, by the real head, via disposeCharacter()
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    proxy.name = "head-shadow-proxy";
    proxy.position.copy(head.position);
    proxy.rotation.copy(head.rotation);
    proxy.scale.copy(head.scale);
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    head.parent.add(proxy);
    // Tracked so `_disposeHeadShadowProxy()` can free the one thing here
    // that `disposeCharacter()` doesn't know about: this material. The
    // geometry is the head's own and must NOT be disposed twice.
    rig.headShadowProxy = proxy;
  }

  /** Frees the proxy's own material. Its geometry belongs to the real head
   *  mesh and is disposed by `disposeCharacter()` — disposing it here too
   *  would be a double free. */
  _disposeHeadShadowProxy(rig) {
    const proxy = rig?.headShadowProxy;
    if (!proxy) return;
    proxy.parent?.remove(proxy);
    proxy.material.dispose();
    rig.headShadowProxy = null;
  }

  async _buildImportedModelRig(modelId) {
    const model = await this.modelLoader.load(modelId);
    if (!model) return null;
    // Version 4, Phase 12 — the same per-model forward-axis correction
    // `BeingController` applies, for the identical reason: an imported
    // model faces whichever way its exporter chose, and the Workshop's own
    // rigs all face +Z. Without this an imported *player* model walks
    // backwards exactly as an imported Being does. Read through
    // `modelLoader`, which already holds the library as a public field, so
    // this needs no change to `main.js`'s wiring.
    //
    // Set before the bounding box is measured below: yaw rotation about
    // the model's own origin can change its world-space X/Z extents, and
    // the `box.min.y` used for foot-planting must be measured on the
    // orientation actually being used.
    model.rotation.y = this.modelLoader.modelLibrary?.get(modelId)?.yawOffset ?? 0;
    const box = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    const root = new THREE.Group();
    model.position.y -= box.min.y; // feet at the group's own origin, matching the procedural rig's own convention
    root.add(model);
    return { root, pivots: {}, eyeHeight: height > 0 ? height * 0.93 : DEFAULT_EYE_HEIGHT, meshes: {} };
  }

  /** The live rig's pivots — `PlayerAnimationSystem` reads this every
   *  frame to apply whatever pose the current clip calls for. Always the
   *  *current* rig's pivots, never a cached reference: a proportion
   *  change or a body-model switch rebuilds the whole rig from scratch
   *  (see PlayerCharacter.js's own comment on why), producing entirely
   *  new pivot objects — this always reflects whichever rebuild most
   *  recently finished. */
  getPivots() {
    return this._current?.pivots ?? null;
  }

  /** The live rig's actual current eye height — `CameraSystem` reads this
   *  as the *target* its own standing eye-height eases toward (see its
   *  own "Player Height" comment), rather than assuming a fixed number.
   *  A taller or shorter character genuinely needs a different eye
   *  height; treating 1.65m as universal is what let a taller character
   *  end up with their feet below the floor in the first place — this
   *  system already computed the right number for the rig itself, it
   *  just wasn't being asked. Falls back to a reasonable default before
   *  the very first rebuild ever finishes. */
  getEyeHeight() {
    return this._current?.eyeHeight ?? DEFAULT_EYE_HEIGHT;
  }

  update(_dt) {
    if (!this._current) return;
    const cam = this._cameraSystem;
    if (!cam) return;
    // Workshop Reliability phase — "first-person crouching allows the
    // player's head/model to clip into the camera." Root cause: this
    // line used to subtract the rig's own *standing* eye height
    // unconditionally, even while crouched — but `cam.position.y` itself
    // already reflects the camera's live, crouch-*reduced* height (see
    // CameraSystem's own `_currentEyeHeight`). Subtracting the bigger
    // (standing) number from the smaller (crouched) camera height left
    // the rig's own root sitting below the player's actual feet by
    // however much the crouch had reduced it — the exact same "feet
    // pushed below the floor" class of bug `_getStandingEyeHeight()`'s
    // own comment already documents fixing once, for the spawn/load
    // case specifically; this was the same mistake surfacing again for
    // the crouch case. With the root sitting too low, the crouch pose's
    // own forward torso lean (see AnimationClips.js's own CROUCH_CLIP)
    // then swung the chest/head up and into the camera instead of
    // staying behind it. Using the *live* eye height keeps the root
    // exactly at the real foot position regardless of crouch state, the
    // same way it already always has while standing.
    this._current.root.position.set(cam.position.x, cam.position.y - cam.getCurrentEyeHeight(), cam.position.z);
    // "The player model is currently facing the wrong direction" — root
    // cause: an unrotated rig's own local +Z (the plain, ordinary "front"
    // a symmetric box-built rig naturally has, with no explicit face or
    // asymmetry to override it) rotates, under a bare `rotation.y = yaw`,
    // toward world (sin(yaw), 0, cos(yaw)) — the exact opposite of this
    // project's own established forward convention,
    // (-sin(yaw), 0, -cos(yaw)), used everywhere else: CameraSystem's own
    // movement code, and its third-person camera positioning (which
    // places the camera *behind* the player using that same convention).
    // The +π here corrects it. See PlayerCharacter.js's own applyPose()
    // for the other half of this fix — rotating the whole rig by 180°
    // also rotates every animated pose along with it, which would
    // otherwise flip each clip's own forward/backward alignment with
    // actual movement; applyPose() compensates by negating each pose's
    // own X/Z components, keeping every clip looking exactly as it
    // always did, now correctly oriented.
    this._current.root.rotation.y = cam.yaw + Math.PI;
  }
}

/** Shared by PlayerCharacterSystem's main rig and the Wardrobe's preview
 *  rig — both need the same "resolve every part's textureId to an actual
 *  image" step before calling buildCharacter(). */
export async function resolveTextureImages(appearance, textureStore) {
  const images = {};
  await Promise.all(
    Object.entries(appearance.parts).map(async ([partId, part]) => {
      if (!part.textureId) return;
      try {
        const img = await textureStore.getAsImage(part.textureId);
        if (img) images[partId] = img;
      } catch (err) {
        console.warn(`[PlayerCharacter] couldn't load texture for "${partId}":`, err);
      }
    })
  );
  return images;
}
