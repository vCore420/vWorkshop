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
  }

  create(entity) {
    this.entities.set(entity.id, entity);
    return entity;
  }

  destroy(entityOrId) {
    const id = typeof entityOrId === "number" ? entityOrId : entityOrId.id;
    const entity = this.entities.get(id);
    if (!entity) return;
    entity.dispose();
    this.entities.delete(id);
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

  update(dt) {
    for (const entity of this.entities.values()) entity.update(dt);
  }
}
