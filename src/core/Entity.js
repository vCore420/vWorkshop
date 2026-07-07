/**
 * Entity
 * ------
 * A lightweight entity in the workshop's ECS-lite architecture. An entity is
 * just an identity plus a bag of components — it doesn't know how to render
 * or interact by itself. A piece of furniture, a notebook, a light fixture,
 * even the player, are all entities with different components attached.
 *
 * This is intentionally minimal (no archetype tables, no query caching) —
 * the workshop will never have thousands of entities, so simplicity and
 * readability matter far more here than raw performance.
 */
let _nextId = 1;

export class Entity {
  constructor(name = "entity") {
    this.id = _nextId++;
    this.name = name;
    this.tags = new Set();
    this.components = new Map();
    /** @type {import('three').Object3D|null} set by MeshComponent, if any */
    this.object3D = null;
    this.userData = {};
  }

  addComponent(component) {
    component.entity = this;
    this.components.set(component.constructor, component);
    component.init?.();
    return component;
  }

  getComponent(ComponentClass) {
    return this.components.get(ComponentClass) ?? null;
  }

  hasComponent(ComponentClass) {
    return this.components.has(ComponentClass);
  }

  tag(...tags) {
    tags.forEach((t) => this.tags.add(t));
    return this;
  }

  hasTag(tag) {
    return this.tags.has(tag);
  }

  update(dt) {
    for (const component of this.components.values()) component.update?.(dt);
  }

  dispose() {
    for (const component of this.components.values()) component.dispose?.();
    this.components.clear();
  }
}
