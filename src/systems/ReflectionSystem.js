import * as THREE from "three";
import { FurnitureSystem } from "./FurnitureSystem.js";

const DEFAULT_RESOLUTION = 320; // modest — a mirror is seen from a few metres away, not pixel-peeped
const DEFAULT_UPDATE_INTERVAL = 3; // render every Nth frame, not every frame
const MAX_ACTIVE_DISTANCE = 9; // metres — beyond this, a surface's texture just stops refreshing rather than costing a render every frame for something nobody's near
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 20;
// How far *in front of* the mirror's own surface its fixed virtual camera
// sits (a small standoff, just enough to avoid clipping into the glass
// itself) and how far further into the room it looks — see the class
// comment below for why "in front of," not "behind," matters here: a
// mirror is very often mounted close to a wall (this one specifically,
// after an earlier pass moved it closer to one), and a camera placed
// behind the glass would have nowhere real to be.
// "The current reflection appears closer than expected... aim for a more
// natural viewing distance" — 0.05 was tuned purely to avoid clipping
// into the glass, not chosen with viewing distance in mind; raised to a
// still-modest 0.25, which reads as roughly an arm's length back from
// the surface rather than standing with your nose against it. Doesn't
// reopen the earlier "camera behind a wall-mounted mirror" concern that
// comment above describes — the camera sits in front of the glass, into
// the room, so moving it further out is moving it further from any wall
// behind the mirror, not closer to one.
const MIRROR_CAMERA_OFFSET = 0.25;
const MIRROR_LOOK_DISTANCE = 2.6;
// Squared-distance / (1 - cosine) thresholds below which the mirror's own
// mesh is treated as "hasn't moved" — see _updateFixedTransform().
const TRANSFORM_EPSILON = 0.0005;

const _scratchWorldPos = new THREE.Vector3();
const _scratchWorldNormal = new THREE.Vector3();
const _scratchLookTarget = new THREE.Vector3();
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
 * asked.
 *
 * **A fixed viewpoint, not a camera chasing the player — the whole
 * architecture changed here, and this is why.** The original version
 * positioned the mirror's virtual camera at the reflection of the main
 * camera's position every single frame, recomputed from wherever the
 * player currently was. That's *closer* to a physically correct
 * reflection, but it's also exactly what made the mirror feel like a
 * second camera following the player around rather than a fixed object
 * in the room: as the player approached, the virtual camera approached
 * from the opposite side at the same rate, and because nothing bounded
 * its frustum to the mirror's own actual size, the reflected view could
 * end up looking clean through the workshop's own walls into whatever
 * was beyond them — exactly the "areas outside the Workshop become
 * visible" symptom this pass exists to fix. Chasing the player's exact
 * position and orientation was also the more *expensive* choice for no
 * benefit worth its cost: every frame it rendered, it re-derived a fresh
 * camera transform from scratch, on top of the render itself.
 *
 * The fix is simpler than what it replaces, not more complex: the mirror
 * camera's position and orientation are derived once from the mirror's
 * *own* geometry — sitting just in front of its own surface (not behind
 * it, which would need real physical depth that a wall-mounted mirror
 * often doesn't have), looking further out into the room — and never
 * move on their own. Walking closer to the mirror makes the player's own
 * reflection occupy more of the frame (their rig is simply closer to a
 * camera that isn't moving), which is exactly the desired behaviour, and
 * the reflected view can never sweep past whatever the mirror's own
 * fixed framing was set up to show. "The Workshop should always favour
 * believable over physically perfect" — a real mirror doesn't have a
 * camera in front of it either; a fixed, sensible viewpoint reads as a
 * believable reflection without needing to be a physically exact one.
 *
 * The one thing that *does* still need to track something is the mirror
 * itself moving — a future Builder-placed mirror repositioned in Build
 * Mode shouldn't leave its reflection facing where it used to be. See
 * `_updateFixedTransform()`: cheap enough to check every frame for every
 * surface (a plain position/normal comparison), so a moved mirror's
 * camera recomputes the moment it actually changes, without recomputing
 * anything at all for the common case of a mirror that never moves.
 *
 * **Performance** (see docs/PERFORMANCE.md for the fuller account): the
 * unavoidable cost here is rendering the entire scene a second time —
 * that's inherent to any real-time render-to-texture mirror, fixed
 * viewpoint or not, and no amount of camera-math cleverness removes it.
 * What actually is addressable: distance culling (skip entirely once the
 * player is far away), a view-direction check (skip if the player isn't
 * even roughly looking that way — a plain dot product, deliberately
 * simpler than a full frustum test), update throttling (every third
 * frame, not every frame — a fixed viewpoint doesn't need to track
 * anything in real time the way a chasing camera did), a modest render
 * resolution, and disabling shadow-map rendering for this one render
 * specifically (a real, meaningfully expensive per-light render pass of
 * its own, and not something a believable-not-perfect reflection needs).
 */
export class ReflectionSystem {
  constructor() {
    /** @type {Array<{mesh: THREE.Mesh, renderTarget: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera, material: THREE.Material, originalMaterial: THREE.Material|THREE.Material[], updateInterval: number, timer: number, lastMeshPosition: THREE.Vector3, lastMeshNormal: THREE.Vector3}>} */
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
   * used both as the mirror plane's normal and to place its fixed camera.
   * Returns a disposer; call it if the surface is ever removed from the
   * scene (a deleted Builder object, a despawned instance) so its render
   * target and cloned material are properly freed rather than leaking.
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
    // A real mirror preserves the viewer's own left-right orientation —
    // raise your right hand and the reflection raises its hand on the
    // same side, from your own point of view. This mirror's camera uses
    // lookAt() to build its orientation (see this class's own top
    // comment for why: it sidesteps a real winding/handedness risk a
    // truly reflected transform has), which always produces a normal,
    // unflipped camera basis — meaning the raw render is "how a camera
    // facing the player sees them" instead, the same left-right sense as
    // a video call, not a mirror. A horizontal flip of the texture here
    // is what actually turns that into a believable reflection, applied
    // once at the texture level rather than by fighting the camera math.
    renderTarget.texture.wrapS = THREE.RepeatWrapping;
    renderTarget.texture.repeat.x = -1;
    renderTarget.texture.offset.x = 1;
    const camera = new THREE.PerspectiveCamera(50, resolution / (resolution * aspect), CAMERA_NEAR, CAMERA_FAR);

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
      renderTarget,
      camera,
      material,
      originalMaterial,
      updateInterval,
      timer: Math.random() * updateInterval, // staggers multiple mirrors' render frames apart, not synchronised
      lastMeshPosition: new THREE.Vector3(NaN, NaN, NaN), // NaN guarantees the very first check below computes an initial transform
      lastMeshNormal: new THREE.Vector3(),
    };
    this._surfaces.push(surface);
    this._updateFixedTransform(surface); // establish its transform immediately, rather than waiting for the first render tick
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

  /** Recomputes this surface's fixed camera transform, but only if its
   *  mesh has actually moved (or rotated) since the last check — cheap
   *  enough to run every single frame for every surface regardless, so a
   *  Builder-moved mirror is never stale, without recomputing anything at
   *  all for the ordinary case of a mirror that never moves. */
  _updateFixedTransform(surface) {
    surface.mesh.updateWorldMatrix(true, false);
    surface.mesh.getWorldPosition(_scratchWorldPos);
    _scratchWorldNormal.set(0, 0, 1).transformDirection(surface.mesh.matrixWorld);

    const positionMoved = _scratchWorldPos.distanceToSquared(surface.lastMeshPosition) > TRANSFORM_EPSILON;
    const normalRotated = 1 - _scratchWorldNormal.dot(surface.lastMeshNormal) > TRANSFORM_EPSILON;
    if (!positionMoved && !normalRotated) return;

    surface.lastMeshPosition.copy(_scratchWorldPos);
    surface.lastMeshNormal.copy(_scratchWorldNormal);

    // A fixed viewpoint just in front of the mirror's own surface,
    // looking further out into the room — not a camera reflecting
    // wherever the player currently is, and not requiring any real space
    // behind the glass itself. See this class's own top comment for why
    // that distinction is the entire point of this file.
    surface.camera.position.copy(_scratchWorldPos).addScaledVector(_scratchWorldNormal, MIRROR_CAMERA_OFFSET);
    _scratchLookTarget.copy(_scratchWorldPos).addScaledVector(_scratchWorldNormal, MIRROR_LOOK_DISTANCE);
    surface.camera.up.set(0, 1, 0);
    surface.camera.lookAt(_scratchLookTarget);
  }

  update(dt) {
    const mainCamera = this.engine.camera;
    if (!mainCamera || this._surfaces.length === 0) return;

    for (const surface of this._surfaces) {
      // Always cheap to check, regardless of whether this surface ends up
      // rendering this frame — a moved mirror shouldn't go stale just
      // because it's currently too far away or out of view to be
      // actively rendering.
      this._updateFixedTransform(surface);

      if (!surface.mesh.visible) continue;
      surface.timer -= dt;
      if (surface.timer > 0) continue;
      surface.timer = surface.updateInterval;

      const distSq = surface.lastMeshPosition.distanceToSquared(mainCamera.position);
      if (distSq > MAX_ACTIVE_DISTANCE * MAX_ACTIVE_DISTANCE) continue;

      // Skip the expensive render entirely if the mirror isn't even
      // roughly in view — merely being *near* a mirror used to pay the
      // full cost of rendering the whole scene a second time, regardless
      // of whether the player was actually looking anywhere near it. A
      // plain dot product against the camera's own forward direction
      // (deliberately simpler than a full 6-plane frustum test — easier
      // to reason about, and this only needs to be roughly right, not
      // exact) is enough: skip anything behind the camera or well outside
      // its field of view.
      if (distSq > 0.09) {
        // (skip the direction check when standing almost exactly at the
        // mirror's own position — subtracting two nearly-identical points
        // would normalize a near-zero vector)
        _scratchToMirror.subVectors(surface.lastMeshPosition, mainCamera.position).normalize();
        _scratchCameraForward.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
        if (_scratchToMirror.dot(_scratchCameraForward) < 0.3) continue;
      }

      // Never see the mirror in its own reflection — belt-and-braces; the
      // mirror camera's fixed position/facing should already put it
      // behind the surface's own frustum in every normal placement, but
      // this guarantees it regardless.
      surface.mesh.visible = false;
      const previousTarget = this.engine.renderer.getRenderTarget();
      // A mirror's own reflection doesn't need full shadow detail to read
      // as believable, and shadow-map rendering is a genuinely expensive,
      // separate render pass per shadow-casting light — skipping it for
      // this one render is one of the larger, easy wins available here.
      const shadowsWereEnabled = this.engine.renderer.shadowMap.enabled;
      this.engine.renderer.shadowMap.enabled = false;
      this.engine.renderer.setRenderTarget(surface.renderTarget);
      this.engine.renderer.render(this.engine.scene, surface.camera);
      this.engine.renderer.setRenderTarget(previousTarget);
      this.engine.renderer.shadowMap.enabled = shadowsWereEnabled;
      surface.mesh.visible = true;
    }
  }
}
