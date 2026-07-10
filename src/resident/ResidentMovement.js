import * as THREE from "three";

/**
 * ResidentMovement
 * ------------------
 * "The resident should gently float. Movement should be slow.
 * Comfortable. Relaxed... most of the time the resident should simply
 * remain where it is. Every so often it may decide to slowly move
 * elsewhere." Two entirely separate kinds of motion live here, on
 * purpose:
 *
 *   1. **Idle-location travel** — a slow (many-second) ease from one
 *      named spot to another, chosen infrequently and at random (see
 *      `maybePickNewLocation()`), never while a conversation is active.
 *   2. **Procedural idle motion** — bobbing, slight rotation, and a tiny
 *      squash/stretch while "thinking" — small, continuous, layered on
 *      top of wherever idle travel currently has the resident, so it
 *      never looks frozen even at rest.
 *
 * Positions are hand-placed relative to `FURNITURE_LAYOUT`'s own real
 * coordinates (`src/data/layoutDefault.js`) — "beside the computer,"
 * "above the workbench," and so on are genuine offsets from where that
 * furniture actually is, not arbitrary points that happen to share a
 * name with something nearby.
 */

export const IDLE_LOCATIONS = [
  { id: "besideComputer", label: "beside the computer", position: new THREE.Vector3(2.35, 1.5, -2.0), lookAt: new THREE.Vector3(3.15, 1.4, -2.35) },
  { id: "aboveWorkbench", label: "above the workbench", position: new THREE.Vector3(-3.0, 1.65, -0.6), lookAt: new THREE.Vector3(-3.35, 1.0, -0.6) },
  { id: "nearBookshelf", label: "near the bookshelf", position: new THREE.Vector3(3.25, 1.35, -0.9), lookAt: new THREE.Vector3(3.8, 1.3, -0.8) },
  { id: "byMusicPlayer", label: "by the music player", position: new THREE.Vector3(2.95, 1.25, 2.0), lookAt: new THREE.Vector3(3.5, 1.1, 2.15) },
  { id: "besideQuietCorner", label: "beside the quiet corner", position: new THREE.Vector3(1.75, 1.3, 1.15), lookAt: new THREE.Vector3(2.3, 1.0, 0.9) },
  { id: "lookingOutWindow", label: "looking out the window", position: new THREE.Vector3(-2.0, 1.55, -2.55), lookAt: new THREE.Vector3(-2.0, 1.55, -3.5) },
];

const TRAVEL_DURATION = 7; // seconds — slow and comfortable, never a dash across the room
const MIN_REST_SECONDS = 90;
const MAX_REST_SECONDS = 240; // "movement should be infrequent... the Workshop should never feel busy"

export function getIdleLocation(id) {
  return IDLE_LOCATIONS.find((loc) => loc.id === id) ?? IDLE_LOCATIONS[0];
}

export function randomIdleLocationId(excludingId) {
  const choices = IDLE_LOCATIONS.filter((loc) => loc.id !== excludingId);
  const pool = choices.length ? choices : IDLE_LOCATIONS;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export class ResidentMovement {
  constructor(startLocationId) {
    const start = getIdleLocation(startLocationId);
    this.currentPosition = start.position.clone();
    this.currentLookAt = start.lookAt.clone();
    this._fromPosition = start.position.clone();
    this._toPosition = start.position.clone();
    this._fromLookAt = start.lookAt.clone();
    this._toLookAt = start.lookAt.clone();
    this._travelT = 1; // 1 = arrived, not travelling
    this._restTimer = this._randomRestDuration();
    this._bobPhase = Math.random() * Math.PI * 2; // desynchronised, not every resident bobbing in lockstep if this ever supports more than one
  }

  get isTravelling() {
    return this._travelT < 1;
  }

  _randomRestDuration() {
    return MIN_REST_SECONDS + Math.random() * (MAX_REST_SECONDS - MIN_REST_SECONDS);
  }

  /** Begins a slow ease toward a new idle location. Interrupts any travel
   *  already in progress cleanly (starts the new ease from the resident's
   *  actual current position, not the old target) rather than snapping. */
  travelTo(locationId) {
    const target = getIdleLocation(locationId);
    this._fromPosition.copy(this.currentPosition);
    this._fromLookAt.copy(this.currentLookAt);
    this._toPosition.copy(target.position);
    this._toLookAt.copy(target.lookAt);
    this._travelT = 0;
  }

  /** Called every frame while idle (not conversing, not otherwise
   *  overridden) — counts down to the next infrequent move and starts one
   *  when it's time. Returns the new location id if it just started
   *  moving, otherwise `null`, so `ResidentController.js` can persist the
   *  new destination via `ResidentState.setIdleLocation()`. */
  maybePickNewLocation(dt, currentLocationId) {
    if (this.isTravelling) return null;
    this._restTimer -= dt;
    if (this._restTimer > 0) return null;
    this._restTimer = this._randomRestDuration();
    const nextId = randomIdleLocationId(currentLocationId);
    this.travelTo(nextId);
    return nextId;
  }

  /** Advances travel easing and procedural idle motion. `thinking` (0-1)
   *  drives the tiny squash/stretch pulse; `dt` in seconds. Returns the
   *  resident's current position/lookAt/scale for `ResidentRenderer.js`
   *  to apply — this class never touches a `THREE.Object3D` directly,
   *  keeping the motion math testable and renderer-agnostic. */
  update(dt, { thinking = false } = {}) {
    if (this._travelT < 1) {
      this._travelT = Math.min(1, this._travelT + dt / TRAVEL_DURATION);
      const eased = easeInOutCubic(this._travelT);
      this.currentPosition.lerpVectors(this._fromPosition, this._toPosition, eased);
      this.currentLookAt.lerpVectors(this._fromLookAt, this._toLookAt, eased);
    }

    this._bobPhase += dt;
    const bobOffset = Math.sin(this._bobPhase * 0.6) * 0.045; // slow, small — comfortable, not bouncy
    const swayOffset = Math.sin(this._bobPhase * 0.37) * 0.02;
    const rotationY = Math.sin(this._bobPhase * 0.22) * 0.12; // a slight, slow rotation, never a spin

    let scaleX = 1;
    let scaleY = 1;
    if (thinking) {
      const pulse = Math.sin(this._bobPhase * 2.2) * 0.04;
      scaleX = 1 + pulse;
      scaleY = 1 - pulse;
    }

    return {
      position: new THREE.Vector3(this.currentPosition.x + swayOffset, this.currentPosition.y + bobOffset, this.currentPosition.z),
      lookAt: this.currentLookAt,
      idleRotationY: rotationY,
      scale: new THREE.Vector3(scaleX, scaleY, scaleX),
    };
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
