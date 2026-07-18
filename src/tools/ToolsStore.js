import { EventBus } from "../core/EventBus.js";

const CURRENT_VERSION = 1;
const RECENT_LIMIT = 15; // the same cap the source application's own calculator history used

let _nextId = 1;

/**
 * ToolsStore
 * ----------
 * Workshop Tools phase. Three things live here, all scoped to the
 * Workshop's own Tool Storage/Workbench tool system rather than any one
 * object:
 *
 *   - **Custom calculators** — built through the Calculator Builder,
 *     stored the exact same way `ObjectLibraryStore` already stores
 *     Builder-made objects: a plain data definition (id, category, tags,
 *     version, timestamps), never compiled code. "Calculators should
 *     become first-class Workshop assets" is this, following the one
 *     precedent already established for what a Workshop asset store
 *     looks like, rather than inventing a second shape for it.
 *   - **Pinned tools** — a plain array of tool ids (native or custom
 *     alike; this store doesn't care which), "the Workshop should
 *     increasingly reflect the way its owner naturally works."
 *   - **Recent runs** — a rolling history of calculations actually
 *     performed, capped at 15 (the same limit the source application's
 *     own per-calculator history used), for "quickly reopening previous
 *     calculations." Distinct from a project's own *saved* calculations
 *     (see `ProjectsStore.addCalculation()`) the same way the original
 *     application distinguished an ephemeral rolling history from a
 *     deliberate "attach this to the job" action — this is the rolling
 *     log, that is the permanent record.
 */
export class ToolsStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} */
    this.customCalculators = [];
    /** @type {string[]} */
    this.pinnedIds = [];
    /** @type {Array<{id:string, toolId:string, toolTitle:string, inputs:object, result:string, createdAt:string}>} */
    this.recent = [];
  }

  // ---- custom calculators (the Calculator Builder's own output) ----

  createCustomCalculator({ title, description = "", category = "custom", tags = [], icon = "\u2728", inputs = [], outputs = [] }) {
    const definition = {
      id: `custom-${_nextId++}`,
      custom: true,
      title: title?.trim() || "Untitled calculator",
      description,
      category,
      tags,
      icon,
      inputs,
      outputs,
      version: CURRENT_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.customCalculators.push(definition);
    this.events.emit("tools:changed");
    return definition;
  }

  updateCustomCalculator(id, patch) {
    const def = this.customCalculators.find((d) => d.id === id);
    if (!def) return null;
    Object.assign(def, patch, { updatedAt: new Date().toISOString() });
    this.events.emit("tools:changed");
    return def;
  }

  duplicateCustomCalculator(id) {
    const source = this.customCalculators.find((d) => d.id === id);
    if (!source) return null;
    return this.createCustomCalculator({
      ...source,
      title: `${source.title} copy`,
      inputs: source.inputs.map((i) => ({ ...i })),
      outputs: source.outputs.map((o) => ({ ...o })),
    });
  }

  removeCustomCalculator(id) {
    this.customCalculators = this.customCalculators.filter((d) => d.id !== id);
    this.pinnedIds = this.pinnedIds.filter((pinId) => pinId !== id);
    this.events.emit("tools:changed");
  }

  getCustomCalculator(id) {
    return this.customCalculators.find((d) => d.id === id) ?? null;
  }

  allCustomCalculators() {
    return [...this.customCalculators];
  }

  // ---- export/import (Version 3, Phase 7 — "Sharing the Workshop") ----

  /** Same small envelope shape `ResidentProfileStore.exportProfile()`/
   *  `BlueprintStore.exportBlueprint()` already use — a `type` tag, a
   *  plain object (not a JSON string, so the UI side uses the shared
   *  `StorageUtils.downloadJSON()`/`uploadJSON()` primitives directly).
   *  A custom calculator's own formula (`ToolFormula.js`'s hand-rolled
   *  tokenizer/evaluator — no `eval()`, nothing it can do beyond
   *  arithmetic on the inputs it's given) is safe to carry verbatim; the
   *  only real risk on import is malformed *structure*, not a dangerous
   *  formula string. */
  exportCustomCalculator(id) {
    const def = this.getCustomCalculator(id);
    if (!def) return null;
    return {
      type: "workshop-calculator",
      version: 1,
      exportedAt: new Date().toISOString(),
      calculator: { title: def.title, description: def.description, category: def.category, tags: def.tags, icon: def.icon, inputs: def.inputs, outputs: def.outputs },
    };
  }

  /** Never trusts the file — `inputs`/`outputs` are each filtered down to
   *  well-formed entries (a genuine `id` and `label` at minimum) rather
   *  than crashing the Calculator Builder's own rendering on a malformed
   *  one, the same standard `BlueprintStore.importBlueprint()` and
   *  `BodyCompiler.compileBody()` now both hold themselves to. Always
   *  creates a genuinely new calculator via `createCustomCalculator()` —
   *  importing is additive, never overwrites anything by id. */
  importCustomCalculator(data) {
    if (!data || typeof data !== "object") throw new Error("That file doesn't look like a Workshop Calculator.");
    if (data.type && data.type !== "workshop-calculator") {
      throw new Error(data.type === "workshop-backup" ? "That's a whole Workshop backup file, not a Calculator — import it from Settings instead." : "That file doesn't look like a Workshop Calculator.");
    }
    const source = data.calculator ?? data;
    if (!source || typeof source !== "object" || !Array.isArray(source.outputs)) {
      throw new Error("That file doesn't look like a Workshop Calculator.");
    }
    const inputs = (Array.isArray(source.inputs) ? source.inputs : [])
      .filter((i) => i && typeof i.id === "string" && i.id && typeof i.label === "string")
      .map((i) => ({ id: i.id, label: i.label, type: "number", default: typeof i.default === "number" && Number.isFinite(i.default) ? i.default : 0 }));
    const outputs = source.outputs
      .filter((o) => o && typeof o.id === "string" && o.id && typeof o.label === "string" && typeof o.formula === "string")
      .map((o) => ({ id: o.id, label: o.label, formula: o.formula, unit: typeof o.unit === "string" ? o.unit : "" }));
    if (outputs.length === 0) throw new Error("That Calculator doesn't define anything to calculate.");
    return this.createCustomCalculator({
      title: source.title ? `${source.title} (imported)` : "Imported Calculator",
      description: typeof source.description === "string" ? source.description : "",
      category: typeof source.category === "string" ? source.category : "custom",
      tags: Array.isArray(source.tags) ? source.tags : [],
      icon: typeof source.icon === "string" ? source.icon : "✨",
      inputs,
      outputs,
    });
  }

  // ---- pinning (Personal Workspace) ----

  togglePin(toolId) {
    if (this.pinnedIds.includes(toolId)) {
      this.pinnedIds = this.pinnedIds.filter((id) => id !== toolId);
    } else {
      this.pinnedIds = [toolId, ...this.pinnedIds];
    }
    this.events.emit("tools:changed");
  }

  isPinned(toolId) {
    return this.pinnedIds.includes(toolId);
  }

  // ---- recent runs (rolling history, not a permanent project record) ----

  recordRun(toolId, toolTitle, inputs, result) {
    const entry = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      toolId,
      toolTitle,
      inputs,
      result,
      createdAt: new Date().toISOString(),
    };
    this.recent = [entry, ...this.recent].slice(0, RECENT_LIMIT);
    this.events.emit("tools:changed");
  }

  getRecent(limit = RECENT_LIMIT) {
    return this.recent.slice(0, limit);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { customCalculators: this.customCalculators, pinnedIds: this.pinnedIds, recent: this.recent };
  }

  load(data) {
    if (!data) return;
    if (Array.isArray(data.customCalculators)) {
      // Safe versioning — the same defensive default-filling pattern
      // ObjectLibraryStore already uses, so a future schema change to
      // custom calculators doesn't break an existing save.
      this.customCalculators = data.customCalculators.map((d) => ({
        description: "", category: "custom", tags: [], icon: "\u2728",
        inputs: [], outputs: [], version: CURRENT_VERSION, ...d,
      }));
      const maxNum = this.customCalculators.reduce((m, d) => {
        const match = /^custom-(\d+)$/.exec(d.id ?? "");
        return match ? Math.max(m, parseInt(match[1], 10)) : m;
      }, 0);
      _nextId = maxNum + 1;
    }
    if (Array.isArray(data.pinnedIds)) this.pinnedIds = data.pinnedIds;
    if (Array.isArray(data.recent)) this.recent = data.recent;
    this.events.emit("tools:changed");
  }
}
