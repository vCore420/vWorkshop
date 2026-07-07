import { box, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * Notebook
 * --------
 * "Physical notebooks become notes." A small prop resting on the workbench.
 * Its id doubles as the key into NotesStore, so adding a second notebook
 * elsewhere in the room later is just another furniture definition with a
 * different id — no changes needed to NotesStore, the overlay, or
 * PersistenceSystem.
 */
export const NotebookDefinition = {
  id: "notebook",
  label: "Notebook",
  footprint: { width: 0.22, depth: 0.28 },
  notebookId: "workbench-notebook",

  build() {
    const g = group();
    const cover = box(0.18, 0.02, 0.24, Materials.matte("#3c5a53"));
    cover.position.set(0, 0.9, 0);
    g.add(cover);
    const pages = box(0.17, 0.015, 0.23, Materials.paper());
    pages.position.set(0, 0.912, 0);
    g.add(pages);
    const band = box(0.02, 0.022, 0.24, Materials.matte("#2a231d"));
    band.position.set(0.06, 0.9, 0);
    g.add(band);
    return g;
  },

  interaction: {
    prompt: "Open the notebook",
    radius: 2.0, // small object — see docs/WORLD.md's interaction-distance pass
    overlayId: "notebook",
  },
};
