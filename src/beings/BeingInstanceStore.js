import { EventBus } from "../core/EventBus.js";

/**
 * BeingInstanceStore
 * --------------------
 * Every *placed* Being, anywhere in the (currently singular) Workshop
 * world — the exact same "thin, dumb record, definitions live elsewhere"
 * shape `WorldObjectsStore.js` already established for Builder objects:
 *
 *   { id, definitionId, position:[x,y,z], rotationY,
 *     homePosition:[x,y,z], homeRadius, currentAnimationClipId,
 *     currentState, despawned }
 *
 * This file doesn't know how to build geometry (`BeingRenderer.js` does
 * that), how it got there (`BeingSpawnerSystem.js` does that), or how it
 * moves (`BeingMovementSystem.js`/`BeingController.js` do that) — it only
 * ever remembers that it exists and where.
 *
 * `homeRadius` is copied from the Being's own definition at spawn time,
 * then lives independently per instance from then on — the same
 * "colorOverride" pattern `WorldObjectsStore.js` already uses for a
 * per-instance value that starts from a definition's own default but can
 * diverge afterwards (the Being Manager's own "Move" action naturally
 * wants to update *this* copy's home, not silently change every other
 * instance of the same definition too).
 *
 * `despawned` (not deleted) is what `BeingManager`'s own Despawn/Respawn
 * actions toggle — "Despawn" temporarily removes a Being from the active
 * world without forgetting it ever existed, distinct from "Remove," which
 * genuinely deletes the instance for good.
 */
let _nextId = 1;

export class BeingInstanceStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} */
    this.instances = [];
  }

  create({ definitionId, position, rotationY = 0, homePosition = null, homeRadius = 2.5 }) {
    const instance = {
      id: _nextId++,
      definitionId,
      name: null, // optional per-instance override — see this file's own top comment; null means "just use the definition's own name"
      position,
      rotationY,
      homePosition: homePosition ?? position,
      homeRadius,
      currentAnimationClipId: null,
      currentState: "idle", // a plain label BeingController.js reads/writes — "idle" | "moving" | "interacting"
      despawned: false,
      createdAt: new Date().toISOString(),
    };
    this.instances.push(instance);
    this._emitChanged();
    return instance;
  }

  update(id, patch) {
    const instance = this.instances.find((i) => i.id === id);
    if (!instance) return null;
    Object.assign(instance, patch);
    this._emitChanged();
    return instance;
  }

  remove(id) {
    this.instances = this.instances.filter((i) => i.id !== id);
    this._emitChanged();
  }

  setDespawned(id, despawned) {
    this.update(id, { despawned });
  }

  get(id) {
    return this.instances.find((i) => i.id === id) ?? null;
  }

  all() {
    return this.instances;
  }

  active() {
    return this.instances.filter((i) => !i.despawned);
  }

  /** Every currently-placed instance of one definition — used by the
   *  Being Manager's own "which of these exist right now" view, and by
   *  `BeingSpawnerSystem.js`'s "Replace Template" action to know what
   *  needs re-rendering after a definition itself changes. */
  byDefinition(definitionId) {
    return this.instances.filter((i) => i.definitionId === definitionId);
  }

  _emitChanged() {
    this.events.emit("instances:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { instances: this.instances, nextId: _nextId };
  }

  load(data) {
    if (!data) return;
    this.instances = data.instances ?? [];
    _nextId = data.nextId ?? this.instances.length + 1;
    this.events.emit("instances:changed");
  }
}
