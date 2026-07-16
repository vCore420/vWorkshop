import { EventBus } from "../core/EventBus.js";

const MAX_KEY_LENGTH = 200;
const MAX_VALUE_LENGTH = 500000; // ~500KB of JSON text per value — generous for settings/small data sets, not a general file store

/**
 * PluginStorage
 * ---------------
 * "Provide isolated plugin storage. Plugins should maintain their own
 * data safely without interfering with Workshop data. Support future
 * migration and version upgrades." One plain store, namespaced by
 * plugin id internally (`{ [pluginId]: { [key]: value } }`) so two
 * plugins can both use the key `"settings"` without collision, and a
 * plugin can never read or write another plugin's own data — the scoped
 * handle `WorkshopSDK.js` hands out (`Workshop.storage`) only ever
 * exposes the one plugin's own namespace, never this store directly, the
 * same "no scene/camera concerns, no reference back" boundary every
 * other plain store already respects.
 *
 * Registered once as a `PersistenceSystem` provider — a plugin's data
 * survives a reload exactly like everything else in the Workshop, with
 * no plugin-specific persistence code of its own to write. "Future
 * migration and version upgrades" has a real, if simple, seam already:
 * a plugin's own `manifest.version` (already available to it) is enough
 * for a plugin's own `setup()` to detect and migrate its own stored
 * shape on load — this store doesn't need to know or care what's inside
 * a plugin's own values, the same "JSON-serializable, opaque to the
 * store itself" contract `save()`/`load()` already use throughout this
 * project.
 */
export class PluginStorage {
  constructor() {
    this.events = new EventBus();
    /** @type {Record<string, Record<string, any>>} */
    this._data = {};
  }

  get(pluginId, key) {
    return this._data[pluginId]?.[key];
  }

  set(pluginId, key, value) {
    if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new Error(`Workshop.storage: key must be a non-empty string under ${MAX_KEY_LENGTH} characters.`);
    }
    let serializedLength = 0;
    try {
      serializedLength = JSON.stringify(value)?.length ?? 0;
    } catch {
      throw new Error("Workshop.storage: value must be JSON-serialisable.");
    }
    if (serializedLength > MAX_VALUE_LENGTH) {
      throw new Error(`Workshop.storage: value for "${key}" is too large (${serializedLength} characters once serialised — the limit is ${MAX_VALUE_LENGTH}).`);
    }
    if (!this._data[pluginId]) this._data[pluginId] = {};
    this._data[pluginId][key] = value;
    this.events.emit("persistence:saveRequested");
  }

  remove(pluginId, key) {
    if (!this._data[pluginId]) return;
    delete this._data[pluginId][key];
    this.events.emit("persistence:saveRequested");
  }

  keys(pluginId) {
    return Object.keys(this._data[pluginId] ?? {});
  }

  /** Every key at once — genuinely removing a plugin (not merely
   *  disabling it), rather than leaving its data behind indefinitely. */
  clear(pluginId) {
    delete this._data[pluginId];
    this.events.emit("persistence:saveRequested");
  }

  getStatus() {
    const pluginCount = Object.keys(this._data).length;
    return { available: true, summary: pluginCount > 0 ? `${pluginCount} plugin${pluginCount === 1 ? "" : "s"} with saved data.` : "No plugin has saved any data yet." };
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { data: this._data };
  }

  load(data) {
    if (!data?.data) return;
    this._data = data.data;
  }
}
