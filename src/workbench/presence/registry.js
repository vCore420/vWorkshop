/**
 * presence/registry.js
 * ----------------------
 * The mechanism that makes the Project Presence system data-driven rather
 * than hardcoded: a project's `presence` array is plain data
 * (`{ type: "blueprint", variant: "unfolded" }`), and this registry maps
 * each `type` string to a builder function that turns one such descriptor
 * into placeholder geometry. `WorkbenchSystem` never hardcodes what a
 * "blueprint" or "notebook" looks like — it just asks this registry.
 *
 * A builder has the shape:
 *   (item) => { object3D: THREE.Object3D, size: "small"|"medium"|"large" }
 *
 * `size` is the item's *preferred* slot category (see `slots.js`); a
 * project can override it explicitly via `item.size` if a particular
 * instance should claim a bigger or smaller spot than usual.
 *
 * Adding a ninth, tenth, or twentieth presence type — for a future project
 * category nobody's thought of yet — means writing one file in
 * `presence/builders/` and registering it here (or via
 * `registerPresenceType` from a plugin). Nothing in `WorkbenchSystem` or
 * `slots.js` needs to change. See docs/WORKBENCH.md and
 * docs/PLUGIN_GUIDE.md.
 */
import { buildBlueprint } from "./builders/BlueprintPresence.js";
import { buildNotebook } from "./builders/NotebookPresence.js";
import { buildMeasuringTools } from "./builders/MeasuringToolsPresence.js";
import { buildReferenceBooks } from "./builders/ReferenceBooksPresence.js";
import { buildMaterialSample } from "./builders/MaterialSamplePresence.js";
import { buildSketch } from "./builders/SketchPresence.js";
import { buildPrototype } from "./builders/PrototypePresence.js";
import { buildProjectBox } from "./builders/ProjectBoxPresence.js";
import { buildPaperwork } from "./builders/PaperworkPresence.js";

const builders = new Map([
  ["blueprint", buildBlueprint],
  ["notebook", buildNotebook],
  ["measuringTools", buildMeasuringTools],
  ["referenceBooks", buildReferenceBooks],
  ["materialSample", buildMaterialSample],
  ["sketch", buildSketch],
  ["prototype", buildPrototype],
  ["projectBox", buildProjectBox],
  ["paperwork", buildPaperwork],
]);

export function registerPresenceType(type, builder) {
  if (builders.has(type)) {
    console.warn(`[presence/registry] "${type}" is already registered — overwriting.`);
  }
  builders.set(type, builder);
}

/**
 * @param {{type: string, [key: string]: any}} item
 * @returns {{object3D: import('three').Object3D, size: string} | null}
 */
export function buildPresenceItem(item) {
  const builder = builders.get(item.type);
  if (!builder) {
    console.warn(`[presence/registry] no builder registered for presence type "${item.type}"`);
    return null;
  }
  const result = builder(item);
  return { object3D: result.object3D, size: item.size ?? result.size ?? "medium" };
}
