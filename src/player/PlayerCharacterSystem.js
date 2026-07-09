import { buildCharacter, disposeCharacter } from "./PlayerCharacter.js";
import { CameraSystem } from "../systems/CameraSystem.js";

const REBUILD_DEBOUNCE_MS = 120; // see _scheduleRebuild

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
 * normally never see themselves" is true by construction: nothing hides
 * the mesh, it just naturally sits at/below the camera facing the same
 * direction, the same reason you don't normally see your own face in a
 * real first-person view unless you look down.
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
  constructor({ appearanceStore, textureStore }) {
    this.appearanceStore = appearanceStore;
    this.textureStore = textureStore;
    this._current = null;
    this._rebuildTimer = null;
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

  _scheduleRebuild() {
    if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
    this._rebuildTimer = setTimeout(() => {
      this._rebuildTimer = null;
      this._rebuild();
    }, REBUILD_DEBOUNCE_MS);
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

    const textureImages = await resolveTextureImages(this.appearanceStore.appearance, this.textureStore);
    const next = buildCharacter(this.appearanceStore.appearance, this.appearanceStore.bodyModelId, textureImages);

    if (this._current) {
      this.engine.scene.remove(this._current.root);
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

  update(_dt) {
    if (!this._current) return;
    const cam = this._cameraSystem;
    if (!cam) return;
    this._current.root.position.set(cam.position.x, cam.position.y - this._current.eyeHeight, cam.position.z);
    this._current.root.rotation.y = cam.yaw;
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
