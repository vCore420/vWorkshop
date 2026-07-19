import { mountToolsPanel } from "../../ui/overlays/shared/toolsPanelView.js";
import { WorkbenchSystem } from "../../workbench/WorkbenchSystem.js";

/**
 * createToolsApp
 * --------------
 * Workshop Tools phase — "the Workbench should become the natural home
 * for Workshop tools," and the computer is where a project's full detail
 * already lives (see ProjectsApp.js). This is the desk's own entry point
 * into the exact same toolbox `ToolStorageOverlay.js` opens physically at
 * the tool cabinet — one implementation (`mountToolsPanel`), two places
 * to reach it, the same shape Wardrobe.js already established.
 *
 * `WorkbenchSystem` is looked up here, not taken as a constructor
 * dependency — `ComputerSystem`'s own deps object is built before
 * `WorkbenchSystem` exists yet (see main.js's own registration order),
 * but nobody opens the Tools app that early, so a lookup at mount time
 * is simpler than reordering construction for one convenience (pre-
 * selecting the current bench project in "Save to project").
 */
export function createToolsApp({ toolsStore, projectsStore, audioSystem }) {
  return {
    id: "tools",
    label: "Tools",
    glyph: "tools",
    mount(container, { engine }) {
      const workbenchSystem = engine.getSystem(WorkbenchSystem);
      return mountToolsPanel(container, {
        toolsStore,
        projectsStore,
        audioSystem,
        activeProjectId: workbenchSystem?.currentProjectId ?? null,
      });
    },
  };
}
