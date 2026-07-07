/**
 * Component
 * ---------
 * Base class every component extends. Components hold data and behaviour
 * that can be attached to an Entity. Override only what you need:
 *
 *   init()      - called once, right after the component is attached
 *   update(dt)  - called every frame while the entity is alive
 *   dispose()   - called when the entity is destroyed; free GPU resources etc.
 *
 * Components that should be saved/restored can additionally implement
 * serialize()/deserialize() — see PersistableComponent for the convention.
 */
export class Component {
  constructor() {
    /** @type {import('./Entity').Entity|null} */
    this.entity = null;
  }
  init() {}
  update(_dt) {}
  dispose() {}
}
