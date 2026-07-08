import { WorkbenchDefinition } from "./Workbench.js";
import { ComputerDeskDefinition } from "./ComputerDesk.js";
import { ShelvingDefinition } from "./Shelving.js";
import { ToolStorageDefinition } from "./ToolStorage.js";
import { PinboardDefinition } from "./Pinboard.js";
import { SittingAreaDefinition } from "./SittingArea.js";
import { MusicCabinetDefinition } from "./MusicCabinet.js";
import { NotebookDefinition } from "./Notebook.js";

/**
 * FURNITURE_REGISTRY
 * -------------------
 * Every piece of furniture in the room, in one list. Adding a new piece
 * later (or a plugin registering one at runtime — see PluginManager) means
 * writing a definition file like the ones in this folder and pushing it in
 * here, or calling `registerFurniture()` below. Nothing else needs to change.
 *
 * A definition has the shape:
 *   {
 *     id: string,                    // must match a key in layoutDefault.FURNITURE_LAYOUT
 *     label: string,
 *     footprint: { width, depth },   // metres, used for simple collision
 *     build(): THREE.Object3D,       // placeholder geometry, local space, feet at y=0
 *     interaction: {
 *       prompt: string,
 *       radius: number,
 *       focusPoseLocal?: { position:[x,y,z], lookAt:[x,y,z] },
 *       // one of the following two:
 *       overlayId?: string,          // opens a full-screen overlay via OverlayManager (most furniture)
 *       onInteract?: (ctx) => void,  // custom handler instead — see ComputerDesk.js. Pair with
 *       onExit?: (ctx) => void,      // onExit if standing up/leaving needs its own cleanup event.
 *     },
 *   }
 */
export const FURNITURE_REGISTRY = [
  WorkbenchDefinition,
  ComputerDeskDefinition,
  ShelvingDefinition,
  ToolStorageDefinition,
  PinboardDefinition,
  SittingAreaDefinition,
  MusicCabinetDefinition,
  NotebookDefinition,
];

export function registerFurniture(definition) {
  if (FURNITURE_REGISTRY.some((d) => d.id === definition.id)) {
    console.warn(`[FurnitureRegistry] "${definition.id}" already registered — skipping.`);
    return;
  }
  FURNITURE_REGISTRY.push(definition);
}
