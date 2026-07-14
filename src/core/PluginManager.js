/**
 * PluginManager
 * -------------
 * The workshop is designed to grow for years. Rather than editing core
 * systems every time a new idea shows up (a GitHub-integration panel, a
 * local AI companion, a workshop calculator...), those ideas should be able
 * to arrive as *plugins*: self-contained objects registered here, with no
 * other system needing to know they exist.
 *
 * A plugin is a plain object with this shape (see /src/plugins/examples for
 * a real one):
 *
 *   {
 *     id: "unique-plugin-id",
 *     init(engine)   -> called once when the plugin is registered
 *     update(dt)     -> optional, called every frame
 *     dispose()      -> optional, called if the plugin is removed
 *     save()         -> optional, return JSON-serializable state
 *     load(data)      -> optional, restore from previously saved state
 *   }
 *
 * Plugins can do anything a core system can: read the EventBus, add
 * entities via the EntityManager, register an overlay with OverlayManager,
 * or add an interactable to a piece of furniture. They are first-class
 * citizens, not a restricted sandbox — see docs/PLUGIN_SDK.md.
 *
 * **Plugin SDK phase: "the Workshop should remain stable even if a plugin
 * fails."** Every call into a plugin's own code — `init`, `update`,
 * `dispose`, `save`, `load` — now funnels through `_safeCall()`, which
 * catches whatever the plugin throws, logs it clearly, and marks that one
 * plugin `"error"` rather than letting the exception propagate up into
 * `engine.init()` or the frame loop, where it would take down every other
 * system. This is the one behavioural change to an otherwise-unchanged
 * contract — `src/plugins/examples/dustMotesPlugin.js` and every other
 * existing plugin work exactly as they did before, just protected now.
 *
 * **Real enable/disable/reload**, on top of the same `init`/`dispose`
 * pair every plugin already implements — "disable" is just calling
 * `dispose()` and remembering not to call `update()` any more; "enable"
 * is calling `init()` again. A plugin that's careful to fully undo
 * whatever `init()` set up inside its own `dispose()` (the SDK's own
 * `Workshop.registerPage()` and `Workshop.events.on()` already do this
 * automatically — see `WorkshopSDK.js`) genuinely reloads cleanly;
 * one that isn't may leave something behind, the same honest limitation
 * any `init`/`dispose` pair has always had.
 */
export class PluginManager {
  constructor(engine) {
    this.engine = engine;
    /** @type {Map<string, object>} */
    this.plugins = new Map();
    /** @type {Map<string, {state: "active"|"disabled"|"error", error: string|null}>} */
    this._status = new Map();
  }

  register(plugin) {
    if (!plugin?.id) throw new Error("Plugins must have a unique `id`.");
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] "${plugin.id}" is already registered — skipping.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    this._status.set(plugin.id, { state: "active", error: null });
    this._safeCall(plugin.id, () => plugin.init?.(this.engine));
  }

  unregister(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    this._safeCall(id, () => plugin.dispose?.());
    this.plugins.delete(id);
    this._status.delete(id);
  }

  /** Stops calling `update()`/counts as inactive, without forgetting the
   *  plugin exists — the Plugin Manager (`host://plugins`) can still
   *  list it and offer "Enable" again. A plugin already `"error"` can
   *  also be disabled, in case its own `dispose()` is still worth
   *  running to clean up whatever `init()` managed before it failed. */
  disable(id) {
    const plugin = this.plugins.get(id);
    const status = this._status.get(id);
    if (!plugin || !status || status.state === "disabled") return;
    this._safeCall(id, () => plugin.dispose?.());
    this._status.set(id, { state: "disabled", error: null });
  }

  enable(id) {
    const plugin = this.plugins.get(id);
    const status = this._status.get(id);
    if (!plugin || !status || status.state !== "disabled") return;
    this._status.set(id, { state: "active", error: null });
    this._safeCall(id, () => plugin.init?.(this.engine));
  }

  /** Disable then enable — see this class's own top comment for what
   *  "cleanly" depends on. */
  reload(id) {
    this.disable(id);
    this.enable(id);
  }

  getStatus(id) {
    return this._status.get(id) ?? null;
  }

  /** Every currently-registered plugin, with its live status — the one
   *  place `PluginService.js` (and, through it, `host://plugins`) reads
   *  to show real state rather than assuming everything that registered
   *  successfully stayed that way. */
  list() {
    return [...this.plugins.values()].map((plugin) => ({
      id: plugin.id,
      name: plugin.name ?? plugin.id,
      manifest: plugin.manifest ?? null,
      pages: plugin.pages ?? [],
      assetKinds: plugin.assetKinds ?? [],
      ...(this._status.get(plugin.id) ?? { state: "active", error: null }),
    }));
  }

  /** Every call into a plugin's own code goes through here — see this
   *  class's own top comment. Returns whatever `fn()` returned, or
   *  `undefined` if it threw (the caller — `save()` below, mainly —
   *  already treats a missing value as "nothing to persist this round,"
   *  the same as if the plugin had no `save()` at all). */
  _safeCall(id, fn) {
    try {
      return fn();
    } catch (err) {
      console.error(`[PluginManager] "${id}" failed:`, err);
      this._status.set(id, { state: "error", error: err?.message ?? String(err) });
      return undefined;
    }
  }

  update(dt) {
    for (const plugin of this.plugins.values()) {
      if (this._status.get(plugin.id)?.state !== "active") continue;
      this._safeCall(plugin.id, () => plugin.update?.(dt));
    }
  }

  /** Collect save data from every plugin that wants to persist state. */
  save() {
    const out = {};
    for (const [id, plugin] of this.plugins) {
      if (plugin.save) {
        const data = this._safeCall(id, () => plugin.save());
        if (data !== undefined) out[id] = data;
      }
    }
    return out;
  }

  load(data = {}) {
    for (const [id, plugin] of this.plugins) {
      if (plugin.load && data[id] !== undefined) this._safeCall(id, () => plugin.load(data[id]));
    }
  }
}
