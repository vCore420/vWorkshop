import { mountToolsPanel } from "./shared/toolsPanelView.js";

/**
 * createToolStorageOverlay
 * -------------------------
 * Workshop Tools phase — "Tool Storage should now become one of the
 * Workshop's core systems... rather than functioning like an inventory,
 * Tool Storage should behave like a workshop toolbox." This is the
 * physical entry point into that toolbox — `mountToolsPanel()` is the
 * one shared implementation, also used by the computer's own Tools app
 * (`ToolsApp.js`), the same "one shared view, two physical entry points"
 * shape `Wardrobe.js` already established for the Wardrobe app.
 */
export function createToolStorageOverlay({ toolsStore, projectsStore, audioSystem, workbenchSystem }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      return mountToolsPanel(panelEl, {
        toolsStore,
        projectsStore,
        audioSystem,
        activeProjectId: workbenchSystem?.currentProjectId ?? null,
      });
    },
  };
}
