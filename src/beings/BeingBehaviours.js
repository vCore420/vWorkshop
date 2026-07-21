/**
 * BeingBehaviours
 * -----------------
 * "Introduce a simple modular behaviour system... avoid scripting.
 * Instead, combine simple behaviours into reusable Being definitions."
 * Four independent categories, each a small closed enum — a Being
 * definition picks exactly one value from each, and the combination is
 * the entire behaviour. There is no expression language, no conditions,
 * no scripting surface anywhere in this file or in how
 * `BeingController.js`/`BeingMovementSystem.js` read these values —
 * "modular" means composable from simple parts, not user-programmable.
 *
 * Deliberately just data (ids, labels, short descriptions for the Being
 * Creator's own UI) — every category's actual runtime behaviour lives in
 * `BeingMovementSystem.js` (Movement, Idle) and `BeingController.js`
 * (Awareness, Interaction), which switch on these same ids. Keeping the
 * vocabulary itself here, separate from anything that executes it, is
 * what lets a future category or value get added without touching the
 * systems that already read the ones that exist.
 */

export const MOVEMENT_STYLES = [
  { id: "static", label: "Static", description: "Stays exactly where it's placed." },
  { id: "wander", label: "Wander", description: "Drifts around its home area at random." },
  { id: "patrol", label: "Patrol", description: "Follows a loop around its home area." },
  { id: "follow", label: "Follow", description: "Stays near the player, within its home radius." },
  { id: "stayNearHome", label: "Stay Near Home", description: "Mostly still, occasionally repositions within its home area." },
  // Version 4, Phase 7 — the resident's own bespoke idle-location travel
  // (ResidentMovement.js), reused wholesale rather than reimplemented as
  // a wander variant. Its named idle locations are fixed, real
  // Workshop-interior furniture positions, not configurable per Being —
  // this only reads as intentional for something that actually lives in
  // the Workshop's own room, not a generic "wander anywhere outdoors"
  // option. Not restricted to resident-capable Beings specifically,
  // though — a real movement style like any other here.
  { id: "residentTravel", label: "Resident Travel", description: "Eases between the Workshop's own named idle spots, the way the resident already does." },
];

export const IDLE_BEHAVIOURS = [
  { id: "stand", label: "Stand" },
  { id: "lookAround", label: "Look Around" },
  { id: "sit", label: "Sit" },
  { id: "sleep", label: "Sleep" },
  { id: "float", label: "Float" },
  { id: "read", label: "Read" },
];

export const AWARENESS_MODES = [
  { id: "ignorePlayer", label: "Ignore Player" },
  { id: "lookAtPlayer", label: "Look At Player" },
  { id: "followPlayerWithEyes", label: "Follow Player With Eyes" },
];

export const INTERACTION_BEHAVIOURS = [
  { id: "talk", label: "Talk" },
  { id: "wave", label: "Wave" },
  { id: "inspect", label: "Inspect" },
  // Version 4, Phase 7 — a real conversation, not a toast. Reuses the
  // exact same ResidentProfileStore/AIConnectionManager machinery the
  // Workshop's own resident already runs on, via `residentProfileId`
  // (see BeingLibrary.js) — see docs/BEINGS.md's own account for the
  // full architecture.
  { id: "aiResident", label: "AI Resident" },
  { id: "none", label: "None" },
];

export const BEING_TYPES = [
  { id: "resident", label: "Resident" },
  { id: "person", label: "Person" },
  { id: "animal", label: "Animal" },
  { id: "robot", label: "Robot" },
  { id: "creature", label: "Creature" },
  { id: "decoration", label: "Decoration" },
  { id: "custom", label: "Custom" },
];

function idOf(list, fallback) {
  return (value) => (list.some((item) => item.id === value) ? value : fallback);
}

export const normalizeMovementStyle = idOf(MOVEMENT_STYLES, "static");
export const normalizeIdleBehaviour = idOf(IDLE_BEHAVIOURS, "stand");
export const normalizeAwarenessMode = idOf(AWARENESS_MODES, "ignorePlayer");
export const normalizeInteractionBehaviour = idOf(INTERACTION_BEHAVIOURS, "none");
export const normalizeBeingType = idOf(BEING_TYPES, "custom");
