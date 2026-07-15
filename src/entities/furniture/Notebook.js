import { box, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Notebook
 * --------
 * "Physical notebooks become notes." A small prop resting on the workbench.
 * Its id doubles as the key into NotesStore, so adding a second notebook
 * elsewhere in the room later is just another furniture definition with a
 * different id — no changes needed to NotesStore, the overlay, or
 * PersistenceSystem.
 *
 * The group's own origin (`layoutDefault.js`'s `notebook` entry) sits at
 * y=0.9 — the notebook's actual resting height on the workbench — not
 * ground level the way most other furniture's does. That used to be a
 * real bug: `InteractableComponent`'s proximity check uses the entity's
 * `object3D` position directly, and this group's origin previously sat at
 * y=0 while every part inside it was offset up to y≈0.9 to actually be
 * drawn there — meaning the interaction anchor was a full 0.9m below
 * where the notebook visually was. Combined with the small "tight, it's a
 * small object" radius, that made the notebook's own interaction distance
 * calculation quietly wrong (measuring from the wrong point entirely, not
 * genuinely conflicting with the workbench's own, correctly-anchored
 * radius) — which looked exactly like "the notebook and workbench
 * interaction volumes overlap" from the outside, even though the real
 * cause was the notebook's own anchor being in the wrong place, not an
 * actual conflict between the two. Parts below are positioned relative to
 * this corrected origin (offsets from 0, not from 0.9).
 */
export const NotebookDefinition = {
  id: "notebook",
  label: "Notebook",
  footprint: { width: 0.22, depth: 0.28 },
  notebookId: "workbench-notebook",

  build() {
    const g = group();
    // Workbench phase — "Workshop Objects... Notebook... material
    // quality... investigate whether each object... looks intentional."
    // A cloth-bound cover and an elastic closure band are both real,
    // specific materials — `fabric()`/`rubber()` — not the same generic
    // `matte()` a metal switch plate would also use.
    const cover = box(0.18, 0.02, 0.24, Materials.fabric("#3c5a53"));
    cover.position.set(0, 0, 0);
    g.add(cover);
    const pages = box(0.17, 0.015, 0.23, Materials.paper());
    pages.position.set(0, 0.012, 0);
    g.add(pages);
    const band = box(0.02, 0.022, 0.24, Materials.rubber("#2a231d"));
    band.position.set(0.06, 0, 0);
    g.add(band);
    return g;
  },

  interaction: {
    prompt: "Open the notebook",
    radius: 1.1, // a small book on the bench — deliberately tighter than the standard "small object" 2.0m tier; see docs/REFINEMENT.md. Safe now that the anchor itself is correct — see this file's own top comment.
    overlayId: "notebook",
  },
};
