import * as THREE from "three";

const _scratchPos = new THREE.Vector3();

/**
 * LadderSystem
 * --------------
 * "Ladders should integrate into the existing Builder behaviour system so
 * future Builder-created ladders automatically become climbable." The
 * entire capability is one function, `registerLadder(object3D, options)`
 * — the same "one small, generic thing multiple independent callers use"
 * shape `ReflectionSystem.registerSurface()` already established for
 * reflective surfaces. `LadderBehaviour.js` (Builder objects) calls it
 * directly; nothing here knows or cares that it's the only caller today,
 * or that a future hand-built ladder furniture piece could call it too.
 *
 * A ladder is just a `THREE.Box3` zone, computed once from the object's
 * own world bounds (like `WorldObjectsSystem`'s own footprints) and kept
 * fresh only when the object's transform actually changes — the same
 * "cheap to check every frame, only recompute on genuine change" pattern
 * `ReflectionSystem`'s fixed camera transform already uses, for the same
 * reason: a Builder-placed ladder repositioned in Build Mode shouldn't
 * leave its climbable zone behind where it used to be.
 *
 * `CameraSystem` is the only consumer — `getZoneAt(x, y, z)` returns
 * whichever ladder zone (if any) contains that point, which is all
 * movement needs to decide whether to switch into climbing mode. This
 * system has no opinion on what climbing *does*; see CameraSystem.js's
 * own ladder-movement handling for that.
 */
export class LadderSystem {
  constructor() {
    /** @type {Array<{ object3D: THREE.Object3D, box: THREE.Box3, lastPosition: THREE.Vector3 }>} */
    this._ladders = [];
  }

  init(engine) {
    this.engine = engine;
  }

  /** Marks `object3D` as climbable — its current world-space bounding box
   *  becomes the zone a player standing inside switches into ladder-climb
   *  movement within. Returns a disposer; call it if the ladder is ever
   *  removed from the scene. */
  registerLadder(object3D) {
    const entry = { object3D, box: new THREE.Box3(), lastPosition: new THREE.Vector3(NaN, NaN, NaN) };
    this._updateZone(entry);
    this._ladders.push(entry);
    return () => this.unregisterLadder(object3D);
  }

  unregisterLadder(object3D) {
    this._ladders = this._ladders.filter((l) => l.object3D !== object3D);
  }

  _updateZone(entry) {
    entry.object3D.updateWorldMatrix(true, false);
    const currentPosition = _scratchPos.setFromMatrixPosition(entry.object3D.matrixWorld);
    if (currentPosition.distanceToSquared(entry.lastPosition) < 0.0005) return; // hasn't moved — nothing to recompute
    entry.lastPosition.copy(currentPosition);
    entry.box.setFromObject(entry.object3D);
  }

  /** The ladder zone (if any) containing this point — CameraSystem calls
   *  this every frame with the player's own foot position. Also keeps
   *  every zone's own transform fresh first (cheap — see _updateZone),
   *  so a Builder-moved ladder is never stale here either. */
  getZoneAt(x, y, z) {
    for (const entry of this._ladders) {
      this._updateZone(entry);
      const box = entry.box;
      if (x >= box.min.x && x <= box.max.x && y >= box.min.y && y <= box.max.y && z >= box.min.z && z <= box.max.z) {
        return box;
      }
    }
    return null;
  }
}
