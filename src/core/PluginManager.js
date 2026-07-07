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
 * citizens, not a restricted sandbox — see docs/PLUGIN_GUIDE.md.
 */
export class PluginManager {
  constructor(engine) {
    this.engine = engine;
    /** @type {Map<string, object>} */
    this.plugins = new Map();
  }

  register(plugin) {
    if (!plugin?.id) throw new Error("Plugins must have a unique `id`.");
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] "${plugin.id}" is already registered — skipping.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    plugin.init?.(this.engine);
  }

  unregister(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    plugin.dispose?.();
    this.plugins.delete(id);
  }

  update(dt) {
    for (const plugin of this.plugins.values()) plugin.update?.(dt);
  }

  /** Collect save data from every plugin that wants to persist state. */
  save() {
    const out = {};
    for (const [id, plugin] of this.plugins) {
      if (plugin.save) out[id] = plugin.save();
    }
    return out;
  }

  load(data = {}) {
    for (const [id, plugin] of this.plugins) {
      if (plugin.load && data[id] !== undefined) plugin.load(data[id]);
    }
  }
}
