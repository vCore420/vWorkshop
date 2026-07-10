import { EventBus } from "../core/EventBus.js";

/**
 * ModelRegistry
 * ---------------
 * "Refresh Models, Current Model, Model Information where available."
 * Deliberately separate from `AIConnectionManager` — this owns *what
 * models exist and what's known about them*, not whether Ollama is
 * currently reachable. `AIApp.js` is the only thing that ever calls
 * `AIConnectionManager.checkConnection()` and hands the raw result here
 * via `setModels()`; this file has never made a network request itself
 * and never will.
 *
 * Turns Ollama's own raw `/api/tags` shape (`{name, model, size, digest,
 * details: {family, parameter_size, quantization_level}, modified_at}`)
 * into the plain fields `AIApp.js`'s own model list actually displays —
 * so the UI never needs to know Ollama's own field-naming conventions,
 * and a future switch to a different local-model server only ever needs
 * a different translation here, not changes anywhere else.
 */
export class ModelRegistry {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{name:string, sizeBytes:number|null, family:string|null, parameterSize:string|null, quantization:string|null, modifiedAt:string|null}>} */
    this.models = [];
    this.lastRefreshedAt = null;
  }

  setModels(rawModels) {
    this.models = (rawModels ?? []).map((m) => ({
      name: m.name ?? m.model ?? "unknown",
      sizeBytes: typeof m.size === "number" ? m.size : null,
      family: m.details?.family ?? null,
      parameterSize: m.details?.parameter_size ?? null,
      quantization: m.details?.quantization_level ?? null,
      modifiedAt: m.modified_at ?? null,
    }));
    this.lastRefreshedAt = Date.now();
    this.events.emit("models:changed");
  }

  clear() {
    this.models = [];
    this.lastRefreshedAt = null;
    this.events.emit("models:changed");
  }

  get(name) {
    return this.models.find((m) => m.name === name) ?? null;
  }

  all() {
    return this.models;
  }
}
