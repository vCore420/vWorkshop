import { EventBus } from "../core/EventBus.js";
import { bumpAffinity, leadingAffinity } from "../utils/AffinityTracker.js";
import { FURNITURE_LAYOUT } from "../data/layoutDefault.js";

const MIN_SAMPLES = 10; // this store persists across every session a resident lives through — the bar can afford to sit a little higher than ResidentPreferences' own same-session one

/** Named zones a player's position can fall inside, positioned relative
 *  to `FURNITURE_LAYOUT`'s own real coordinates — genuine offsets from
 *  where that furniture actually is, the same standard
 *  `ResidentMovement.js`'s own idle locations already hold themselves to,
 *  not arbitrary points that happen to share a name with something
 *  nearby. Radius is deliberately generous (wide enough to cover
 *  "standing at," not just "touching") — this is meant to notice a
 *  general pattern of where the player spends time, not to pinpoint
 *  their exact footing. */
const ZONES = [
  { id: "workbench", label: "the workbench", x: FURNITURE_LAYOUT.workbench.position[0], z: FURNITURE_LAYOUT.workbench.position[2], radius: 2.4 },
  { id: "computerDesk", label: "the computer desk", x: FURNITURE_LAYOUT.computerDesk.position[0], z: FURNITURE_LAYOUT.computerDesk.position[2], radius: 2.4 },
  { id: "quietCorner", label: "the Quiet Corner", x: FURNITURE_LAYOUT.sittingArea.position[0], z: FURNITURE_LAYOUT.sittingArea.position[2], radius: 2.2 },
  { id: "musicCabinet", label: "the music cabinet", x: FURNITURE_LAYOUT.musicCabinet.position[0], z: FURNITURE_LAYOUT.musicCabinet.position[2], radius: 2.2 },
];

/**
 * PlayerPatternMemory
 * ----------------------
 * "Residents should begin remembering behavioural patterns rather than
 * only conversations... the player often builds near the workbench...
 * the player usually visits in the evening... the goal is quiet
 * familiarity rather than prediction." Two plain affinity bags (see
 * `AffinityTracker.js`), bumped on a slow timer by `ResidentController.js`
 * from the player's own live position and the current time of day —
 * nothing about a conversation, nothing the player explicitly tells
 * Bubble, just where they happen to actually spend time.
 *
 * Deliberately not a location *history* (a growing list of timestamped
 * positions) — that would need to be pruned, summarised, or capped
 * eventually anyway, and the only thing anything downstream ever asks is
 * "what's the leading pattern right now," which two small counters answer
 * exactly as well as a full log would, for a fraction of the size and
 * with nothing to garbage-collect.
 */
export class PlayerPatternMemory {
  constructor() {
    this.events = new EventBus();
    this.zoneCounts = {};
    this.timeOfDayCounts = {};
    // "Usual working hours." Distinct from `timeOfDayCounts` above (which
    // tracks *any* time the player happens to be sampled, wherever they
    // are) — this only bumps when the player is *also* in a working zone
    // (the workbench or the computer desk) at that same moment, so "the
    // player usually visits in the evening" and "the player usually
    // works in the evening" can genuinely differ.
    this.workingHourCounts = {};
  }

  /** `position` is a `THREE.Vector3`-shaped object (only `.x`/`.z` are
   *  read); `timeBucket` is one of `ResidentWorldSignals.
   *  currentTimeBucket()`'s own four strings. Called on a slow interval
   *  from `ResidentController.js`, never every frame — a behavioural
   *  pattern doesn't need frame-accurate sampling, and sampling this
   *  rarely is also what keeps the counts meaningful (see `MIN_SAMPLES`)
   *  across a real, long-lived Workshop rather than saturating within a
   *  single sitting. */
  sample(position, timeBucket) {
    if (timeBucket) bumpAffinity(this.timeOfDayCounts, timeBucket);
    const zone = this._nearestZone(position);
    if (zone) {
      bumpAffinity(this.zoneCounts, zone.id);
      if (timeBucket && (zone.id === "workbench" || zone.id === "computerDesk")) bumpAffinity(this.workingHourCounts, timeBucket);
    }
  }

  _nearestZone(position) {
    let best = null;
    let bestDist = Infinity;
    for (const zone of ZONES) {
      const dx = position.x - zone.x;
      const dz = position.z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= zone.radius && dist < bestDist) {
        bestDist = dist;
        best = zone;
      }
    }
    return best;
  }

  /** The zone the player is most often found in, or `null` below
   *  `MIN_SAMPLES` — see the module comment's own "quiet familiarity
   *  rather than prediction." */
  leadingZone() {
    return leadingAffinity(this.zoneCounts, MIN_SAMPLES);
  }

  leadingTimeBucket() {
    return leadingAffinity(this.timeOfDayCounts, MIN_SAMPLES);
  }

  /** "Usual working hours" — see the constructor's own comment on how
   *  this differs from `leadingTimeBucket()`. */
  leadingWorkingHours() {
    return leadingAffinity(this.workingHourCounts, MIN_SAMPLES);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { zoneCounts: this.zoneCounts, timeOfDayCounts: this.timeOfDayCounts, workingHourCounts: this.workingHourCounts };
  }

  load(data) {
    if (!data) return;
    this.zoneCounts = data.zoneCounts ?? {};
    this.timeOfDayCounts = data.timeOfDayCounts ?? {};
    this.workingHourCounts = data.workingHourCounts ?? {};
  }
}

export function zoneLabel(id) {
  return ZONES.find((z) => z.id === id)?.label ?? id;
}
