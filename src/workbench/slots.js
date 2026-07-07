/**
 * slots.js
 * --------
 * Named positions on the workbench's own surface where a project's
 * physical presence items can be placed. These are hand-placed to avoid
 * the bench's permanent fixtures — see `Workbench.js` for the vice
 * (~x 0.55–0.8), the tool tray (~x -0.42–-0.7), the lamp (~x 0.75), and the
 * clipboard (x 0.05, z 0.34) — and the standalone notebook prop that sits
 * nearby in the room (roughly bench-local x -0.45, z 0.4).
 *
 * Each slot has a `size` category. `WorkbenchSystem` assigns presence
 * items to slots by matching size first, falling back to progressively
 * larger/smaller free slots if its preferred category is already taken —
 * see `assignSlots()`. A project's presence array can be shorter or longer
 * than the slot count; extra items beyond 6 are simply not placed (a full
 * bench is a believable bench, not an overflowing one).
 *
 * Coordinates are in the workbench's own local space (same space
 * `Workbench.js` builds its permanent geometry in) — y is handled
 * separately via `surfaceY` (see `Workbench.js`'s `userData.surfaceY`).
 */
export const WORKBENCH_SLOTS = [
  { id: "large-1", position: [0.0, -0.18], rotationY: 0, size: "large" },
  { id: "large-2", position: [0.15, 0.2], rotationY: -0.08, size: "large" },
  { id: "medium-1", position: [-0.12, 0.02], rotationY: 0.05, size: "medium" },
  { id: "medium-2", position: [0.42, -0.1], rotationY: -0.1, size: "medium" },
  { id: "small-1", position: [0.3, 0.28], rotationY: 0.15, size: "small" },
  { id: "small-2", position: [-0.15, -0.32], rotationY: -0.2, size: "small" },
];

const SIZE_FALLBACK_ORDER = {
  large: ["large", "medium", "small"],
  medium: ["medium", "large", "small"],
  small: ["small", "medium", "large"],
};

/**
 * Greedily assigns presence items (each `{ ...descriptor, size }`) to free
 * slots, preferring a slot matching the item's size and falling back to the
 * next-closest size if that category is full. Items beyond the number of
 * available slots are dropped (with a console note, not a crash).
 *
 * @returns {Array<{ item: object, slot: object }>}
 */
export function assignSlots(items) {
  const freeSlots = new Set(WORKBENCH_SLOTS);
  const assignments = [];

  for (const item of items) {
    const order = SIZE_FALLBACK_ORDER[item.size] ?? SIZE_FALLBACK_ORDER.medium;
    let chosen = null;
    for (const size of order) {
      chosen = [...freeSlots].find((s) => s.size === size);
      if (chosen) break;
    }
    if (!chosen) {
      console.warn(`[Workbench] no free slot for presence item "${item.type}" — the bench is full.`);
      continue;
    }
    freeSlots.delete(chosen);
    assignments.push({ item, slot: chosen });
  }

  return assignments;
}
