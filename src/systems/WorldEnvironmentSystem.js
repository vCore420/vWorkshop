import * as THREE from "three";
import { Materials } from "../utils/PlaceholderFactory.js";
import { CameraSystem } from "./CameraSystem.js";

const GROUND_SIZE = 400; // metres — one tile of the "effectively infinite" ground
const RECENTER_THRESHOLD = 120; // recentre once the camera is this far from the tile's own centre
const RECENTER_GRID = 20; // snap recentring to this grid so the texture never visibly "swims"

/**
 * WorldEnvironmentSystem
 * -------------------------
 * Everything about the world *outside* any one building: the ground, and
 * the sky/fog. Deliberately not part of `RoomLayoutSystem` — the workshop
 * is going to be "Building One" of an eventually much larger world (see
 * docs/WORLD.md), and the ground/sky are shared by every future building
 * the same way, rather than belonging to any single one of them.
 *
 * Two things happen here, both intentionally minimal per the brief's
 * "empty with purpose" instruction — no terrain, no décor, nothing that
 * would quietly remove a choice from someone building here later:
 *
 *   1. **The ground** is one large, flat, textured plane that silently
 *      re-centres on the camera whenever the camera gets close to its
 *      edge (snapped to a grid so the texture doesn't visibly jump) — an
 *      "effectively infinite" plane without ever needing to be *actually*
 *      infinite. It sits a few centimetres below y = 0 (the interior
 *      floor's exact surface height) purely to avoid z-fighting where the
 *      building's floor slab meets it; from a standing height that's
 *      imperceptible.
 *   2. **The sky and fog** are driven by the exact same `timeofday:changed`
 *      event `LightingSystem` already listens to — this system just also
 *      applies `skyColor` to `scene.background` and `scene.fog`, so the sky
 *      you see through a window, through the open door, and standing
 *      outside is always the same single value, updated in one place.
 *      (Before the outdoor world existed, `TimeOfDaySystem` tinted the
 *      window panes directly to fake this; that hack is gone now that
 *      there's a real sky to show instead — see WorkshopRoom.js.)
 */
export class WorldEnvironmentSystem {
  constructor() {
    this._lastRecenter = new THREE.Vector2(0, 0);
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem); // resolved once — see CameraSystem.js's own init() comment on why this is safe regardless of registration order

    const groundMat = Materials.ground();
    const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    this.groundMesh = new THREE.Mesh(geometry, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(0, -0.03, 0); // just under the interior floor's surface — avoids z-fighting at the threshold
    this.groundMesh.receiveShadow = true;
    engine.scene.add(this.groundMesh);

    engine.scene.fog = new THREE.Fog("#bfe6ff", 18, 160);

    engine.events.on("timeofday:changed", ({ skyColor }) => {
      engine.scene.background = new THREE.Color(skyColor);
      if (engine.scene.fog) engine.scene.fog.color.set(skyColor);
    });
  }

  /** Used by BuildModeSystem so outdoor placement works the same way indoor placement does. */
  getGroundMesh() {
    return this.groundMesh;
  }

  /** Driven by the Settings app's "Render Distance" — scales both the
   *  camera's far plane and the fog's far distance together, so the world
   *  fades into the sky at roughly the same point it actually stops being
   *  drawn, rather than either popping visibly or fading well before the
   *  cutoff. See docs/PERFORMANCE.md. */
  setRenderDistance(metres) {
    this.engine.camera.far = metres;
    this.engine.camera.updateProjectionMatrix();
    if (this.engine.scene.fog) {
      this.engine.scene.fog.far = metres;
      this.engine.scene.fog.near = Math.min(18, metres * 0.2);
    }
  }

  update(_dt) {
    const camera = this._cameraSystem;
    if (!camera) return;
    const dx = camera.position.x - this.groundMesh.position.x;
    const dz = camera.position.z - this.groundMesh.position.z;
    if (dx * dx + dz * dz > RECENTER_THRESHOLD * RECENTER_THRESHOLD) {
      this.groundMesh.position.x = Math.round(camera.position.x / RECENTER_GRID) * RECENTER_GRID;
      this.groundMesh.position.z = Math.round(camera.position.z / RECENTER_GRID) * RECENTER_GRID;
    }
  }
}
