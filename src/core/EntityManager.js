/**
 * EntityManager
 * -------------
 * Owns the authoritative list of every entity in the workshop and provides
 * simple query helpers. Systems ask the EntityManager for the entities they
 * care about instead of holding their own private lists — that way a new
 * system can query for `tag "interactable"` on day one without any other
 * system needing to know it exists.
 */
export class EntityManager {
  constructor() {
    /** @type {Map<number, import('./Entity').Entity>} */
    this.entities = new Map();
    // Bumped on every create()/destroy() — byComponent() below uses this to
    // know when its cached result is stale, rather than rebuilding on every
    // call regardless of whether anything actually changed.
    this._version = 0;
    this._componentCache = new Map(); // ComponentClass -> { version, list }
  }

  create(entity) {
    this.entities.set(entity.id, entity);
    this._version++;
    return entity;
  }

  destroy(entityOrId) {
    const id = typeof entityOrId === "number" ? entityOrId : entityOrId.id;
    const entity = this.entities.get(id);
    if (!entity) return;
    entity.dispose();
    this.entities.delete(id);
    this._version++;
  }

  byTag(tag) {
    return [...this.entities.values()].filter((e) => e.hasTag(tag));
  }

  byName(name) {
    return [...this.entities.values()].find((e) => e.name === name) ?? null;
  }

  getById(id) {
    return this.entities.get(id) ?? null;
  }

  all() {
    return [...this.entities.values()];
  }

  /**
   * Every entity that currently has an instance of `ComponentClass`,
   * cached and only rebuilt when an entity has actually been created or
   * destroyed since the last call. This is what a per-frame query (like
   * InteractionSystem's proximity scan) should use instead of `all()` —
   * `all()` allocates a fresh array on every single call, and combined
   * with a `.getComponent()` check on every entity, that scan used to
   * redo full-room work 60 times a second regardless of whether the room
   * had changed at all. See docs/PERFORMANCE.md.
   *
   * Relies on the codebase's existing convention of always attaching an
   * entity's components *before* calling `create()` on it (true of every
   * entity-creating system today — FurnitureSystem, WorldObjectsSystem,
   * RoomLayoutSystem, LightingSystem) — a component added to an
   * already-registered entity after the fact wouldn't be picked up until
   * the next unrelated create()/destroy() bumps the version. Worth
   * knowing if that convention ever needs breaking.
   */
  byComponent(ComponentClass) {
    const cached = this._componentCache.get(ComponentClass);
    if (cached && cached.version === this._version) return cached.list;
    const list = [...this.entities.values()].filter((e) => e.hasComponent(ComponentClass));
    this._componentCache.set(ComponentClass, { version: this._version, list });
    return list;
  }

  update(dt) {
    for (const entity of this.entities.values()) entity.update(dt);
  }
}
