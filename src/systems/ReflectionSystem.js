import * as THREE from "three";
import { FurnitureSystem } from "./FurnitureSystem.js";

const DEFAULT_RESOLUTION = 384; // modest — a mirror doesn't need to be sharper than the room's own shadow maps
const DEFAULT_UPDATE_INTERVAL = 2; // render every Nth frame, not every frame
const MAX_ACTIVE_DISTANCE = 9; // metres — beyond this, a surface's texture just stops refreshing rather than costing a render every frame for something nobody's near
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 30;

const _scratchAhead = new THREE.Vector3();
const _scratchReflectedAhead = new THREE.Vector3();
const _scratchWorldPos = new THREE.Vector3();
const _scratchWorldNormal = new THREE.Vector3();
const _scratchToMirror = new THREE.Vector3();
const _scratchCameraForward = new THREE.Vector3();

/**
 * ReflectionSystem
 * ------------------
 * "Reflections should become another capability available to Workshop
 * objects" rather than a special mirror type — this is the entire
 * capability, and it is deliberately small: `registerSurface(mesh, options)`
 * is the only thing anything else in the codebase ever calls. A hand-built
 * furniture piece (`Wardrobe.js`) and a Builder behaviour
 * (`ReflectiveBehaviour.js`) both call this exact same function; neither
 * knows the other exists, and this system doesn't know or care which one
 * asked. That's what "avoid hard-coded special cases" means here — a
 * future NPC, a polished workbench surface, a puddle, anything at all,
 * becomes reflective by calling the same one function.
 *
 * **How it actually works**, optimised for maintainability over graphical
 * fidelity per the brief: a second camera is positioned at the mirror
 * image of the main camera across the surface's plane, and rendered into
 * a small render-target texture applied to the surface's own (cloned, so
 * the shared cached material is never mutated — see PlaceholderFactory.js)
 * material. This is *not* a per-pixel-correct planar reflection (that
 * needs a projective texture shader and oblique near-plane clipping,
 * meaningfully more code to maintain for a visual improvement that matters
 * least of anywhere in this project); it's a camera placed to show
 * whatever's in front of the mirror — which, for "can I see myself while
 * changing outfits," is exactly what's needed, without the extra
 * machinery. See docs/PLAYER.md's Reflection System section for the full
 * reasoning and the known viewing-angle limitation this trades away.
 *
 * Every surface's texture only re-renders every `updateInterval` frames,
 * and skips entirely once the camera is further than `MAX_ACTIVE_DISTANCE`
 * away — a mirror nobody's near costs nothing.
 */
export class ReflectionSystem {
  constructor() {
    /** @type {Array<{mesh: THREE.Mesh, plane: THREE.Plane, renderTarget: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera, material: THREE.Material, originalMaterial: THREE.Material|THREE.Material[], updateInterval: number, timer: number}>} */
    this._surfaces = [];
  }

  init(engine) {
    this.engine = engine;
    this._registerFurnitureMirrors();
  }

  /** Reaches into FurnitureSystem's already-built pieces looking for a
   *  `mirrorMesh` marker in userData — the same pattern LightingSystem
   *  already uses to find the workbench's lamp socket. Registration
   *  order matters: this system must be added to the Engine *after*
   *  FurnitureSystem, since it's reading geometry that system already
   *  built — see main.js.
   *
   *  Reads `mirrorAspect` from the same userData rather than deriving it
   *  from `mesh.scale` the way `ReflectiveBehaviour.js` does for Builder
   *  objects — furniture built with `box(width, height, depth, ...)`
   *  bakes its real dimensions directly into the geometry (see
   *  PlaceholderFactory.js), leaving `mesh.scale` at its default (1,1,1),
   *  unlike Builder parts, which are unit geometry stretched via
   *  `mesh.scale`. Reading `.scale` here would always give 1:1. */
  _registerFurnitureMirrors() {
    const furnitureSystem = this.engine.getSystem(FurnitureSystem);
    for (const piece of furnitureSystem?.getAllPieces() ?? []) {
      const mirrorMesh = piece.entity.object3D.userData.mirrorMesh;
      if (mirrorMesh) this.registerSurface(mirrorMesh, { aspect: piece.entity.object3D.userData.mirrorAspect ?? 1 });
    }
  }

  /**
   * Marks `mesh` as reflective. `mesh` should be roughly flat — its own
   * world-space normal (local +Z, transformed by its world matrix) is
   * used as the mirror plane's normal. Returns a disposer; call it if the
   * surface is ever removed from the scene (a deleted Builder object, a
   * despawned instance) so its render target and cloned material are
   * properly freed rather than leaking.
   */
  registerSurface(mesh, { resolution = DEFAULT_RESOLUTION, updateInterval = DEFAULT_UPDATE_INTERVAL, aspect = 1 } = {}) {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, Math.round(resolution * aspect), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    // Two real, well-documented Three.js colour-management gotchas, not
    // guesswork — see docs/PLAYER.md's own note on this for the full
    // explanation of why reflections rendered dark despite genuinely
    // rendering something:
    //   1. A render target's texture needs its own `colorSpace` set
    //      explicitly to match how it'll actually be sampled — left at
    //      its default, sampling it as a `map` applies an extra,
    //      unwanted darkening decode on data that's already correctly
    //      encoded.
    //   2. The offscreen render already has this renderer's own tone
    //      mapping baked into its pixels; displaying that texture through
    //      a normally tone-mapped material applies tone mapping a second
    //      time, compressing (and further darkening) the result again.
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(55, resolution / (resolution * aspect), CAMERA_NEAR, CAMERA_FAR);

    // Cloned, never mutated in place — the same reasoning Build Mode's own
    // ghost preview and the Builder's part-selection highlight both
    // already follow: this mesh's original material is very likely a
    // shared, cached one (see PlaceholderFactory.js), and every other
    // object using that colour must not become a mirror too.
    const originalMaterial = mesh.material;
    const material = (Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial).clone();
    material.map = renderTarget.texture;
    material.color.set("#ffffff"); // let the render show through at full, undamped colour
    material.toneMapped = false; // see gotcha 2 above — this material's colour is already a fully rendered, already-tone-mapped image, not a raw albedo needing it applied
    mesh.material = material;

    const surface = {
      mesh,
      plane: new THREE.Plane(),
      renderTarget,
      camera,
      material,
      originalMaterial,
      updateInterval,
      timer: Math.random() * updateInterval, // staggers multiple mirrors' render frames apart, not synchronised
    };
    this._surfaces.push(surface);
    return () => this.unregisterSurface(mesh);
  }

  unregisterSurface(mesh) {
    const index = this._surfaces.findIndex((s) => s.mesh === mesh);
    if (index === -1) return;
    const [surface] = this._surfaces.splice(index, 1);
    surface.renderTarget.dispose();
    surface.material.dispose();
    if (mesh.material === surface.material) mesh.material = surface.originalMaterial;
  }

  update(dt) {
    const mainCamera = this.engine.camera;
    if (!mainCamera || this._surfaces.length === 0) return;

    for (const surface of this._surfaces) {
      if (!surface.mesh.visible) continue;
      surface.timer -= dt;
      if (surface.timer > 0) continue;
      surface.timer = surface.updateInterval;

      surface.mesh.getWorldPosition(_scratchWorldPos);
      const distSq = _scratchWorldPos.distanceToSquared(mainCamera.position);
      if (distSq > MAX_ACTIVE_DISTANCE * MAX_ACTIVE_DISTANCE) continue;

      // Skip the expensive render entirely if the mirror isn't even
      // roughly in view — merely being *near* a mirror used to pay the
      // full cost of rendering the whole scene a second time, every other
      // frame, regardless of whether the player was actually looking
      // anywhere near it. A plain dot product against the camera's own
      // forward direction (deliberately simpler than a full 6-plane
      // frustum test — easier to reason about, and this only needs to be
      // roughly right, not exact) is enough: skip anything behind the
      // camera or well outside its field of view.
      if (distSq > 0.09) {
        // (skip the direction check when standing almost exactly at the
        // mirror's own position — subtracting two nearly-identical points
        // would normalize a near-zero vector)
        _scratchToMirror.subVectors(_scratchWorldPos, mainCamera.position).normalize();
        _scratchCameraForward.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
        if (_scratchToMirror.dot(_scratchCameraForward) < 0.3) continue;
      }

      surface.mesh.updateWorldMatrix(true, false);
      _scratchWorldNormal.set(0, 0, 1).transformDirection(surface.mesh.matrixWorld);
      surface.plane.setFromNormalAndCoplanarPoint(_scratchWorldNormal, _scratchWorldPos);

      this._pointMirrorCamera(surface, mainCamera);

      // Never see the mirror in its own reflection — belt-and-braces; the
      // mirror camera's position/facing should already put it behind the
      // surface's own frustum in every normal placement, but this
      // guarantees it regardless.
      surface.mesh.visible = false;
      const previousTarget = this.engine.renderer.getRenderTarget();
      this.engine.renderer.setRenderTarget(surface.renderTarget);
      this.engine.renderer.render(this.engine.scene, surface.camera);
      this.engine.renderer.setRenderTarget(previousTarget);
      surface.mesh.visible = true;
    }
  }

  /** Positions `surface.camera` at the reflection of `mainCamera`'s
   *  position across the surface's plane, looking toward the reflection
   *  of a point some distance in front of `mainCamera` — see this file's
   *  own top comment for why a `lookAt`-built orientation was chosen over
   *  reflecting the camera's basis vectors directly (guaranteed-correct
   *  winding/handedness, at the cost of exactness from every angle). */
  _pointMirrorCamera(surface, mainCamera) {
    const distance = surface.plane.distanceToPoint(mainCamera.position);
    surface.camera.position.copy(mainCamera.position).addScaledVector(surface.plane.normal, -2 * distance);

    _scratchAhead
      .set(0, 0, -1)
      .applyQuaternion(mainCamera.quaternion)
      .multiplyScalar(2.2)
      .add(mainCamera.position);
    const aheadDistance = surface.plane.distanceToPoint(_scratchAhead);
    _scratchReflectedAhead.copy(_scratchAhead).addScaledVector(surface.plane.normal, -2 * aheadDistance);

    surface.camera.up.set(0, 1, 0);
    surface.camera.lookAt(_scratchReflectedAhead);
  }
}
