import { EventBus } from "../core/EventBus.js";

/**
 * WorldObjectsStore
 * -------------------
 * Every *placed* copy of a library object, anywhere in the (currently
 * singular) world:
 *
 *   { id, definitionId, definitionSource, roomId, position:[x,y,z], rotationY, scale, colorOverride, groupId, groupName }
 *
 * `definitionSource` is `"library"` (a user-authored `ObjectLibraryStore`
 * definition, the default) or `"construction"` (a permanent
 * `ConstructionLibrary` piece — see that file). `WorldObjectsSystem` uses it
 * to know which store to resolve `definitionId` against. Construction
 * pieces use string ids specifically so the two can never collide even if
 * something forgets to check the source, but checking it is still the
 * correct, explicit thing to do.
 *
 * This is deliberately a thin, dumb record — it doesn't know how to build
 * geometry (ObjectCompiler.js does that) or how it got there (BuildModeSystem
 * does that). `roomId` exists from day one even though there is exactly one
 * room today ("workshop") — see CURRENT_ROOM_ID below — specifically so that
 * "additional rooms" later is a matter of spawning instances with a
 * different `roomId` and filtering by it, not a schema change. This is the
 * literal implementation of the brief's "without requiring architectural
 * changes" requirement.
 */
export const CURRENT_ROOM_ID = "workshop";

let _nextId = 1;

export class WorldObjectsStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} */
    this.instances = [];
  }

  create({ definitionId, definitionSource = "library", roomId = CURRENT_ROOM_ID, position, rotationY = 0, rotationX = 0, rotationZ = 0, scale = 1, colorOverride = null, groupId = null, groupName = null }) {
    const instance = {
      id: _nextId++,
      definitionId,
      definitionSource,
      roomId,
      position,
      rotationY,
      // "Expand rotation controls to allow for rotation on multiple
      // axis." Optional and defaulted to 0 — an ordinary object placed
      // the ordinary way (yaw only) never sets these at all, so nothing
      // about the existing schema or any existing save changes shape.
      rotationX,
      rotationZ,
      scale,
      colorOverride,
      // "Introduce object grouping." A group is nothing more than this
      // value shared redundantly across every member's own record — see
      // BuildModeSystem.js's own "Grouping" section for why that's
      // simpler and more robust than a separate group registry.
      groupId,
      groupName,
      createdAt: new Date().toISOString(),
    };
    this.instances.push(instance);
    this.events.emit("instances:changed", this.instances);
    return instance;
  }

  update(id, patch) {
    const instance = this.instances.find((i) => i.id === id);
    if (!instance) return null;
    Object.assign(instance, patch);
    this.events.emit("instances:changed", this.instances);
    return instance;
  }

  remove(id) {
    this.instances = this.instances.filter((i) => i.id !== id);
    this.events.emit("instances:changed", this.instances);
  }

  /** "The Builder should give players confidence to experiment" —
   *  undoing a deletion needs the exact instance back, same id and all,
   *  not a fresh `create()` (which would mint a new one and could
   *  outlive whatever briefly referenced the old one, a sibling's own
   *  `groupId` membership included, if this ever raced with something
   *  else reading the store mid-undo). Only ever called by
   *  `BuildModeSystem.js`'s own undo entries — an ordinary "add a new
   *  object" always goes through `create()` instead. */
  restore(instance) {
    this.instances.push(instance);
    this.events.emit("instances:changed", this.instances);
  }

  get(id) {
    return this.instances.find((i) => i.id === id) ?? null;
  }

  byRoom(roomId = CURRENT_ROOM_ID) {
    return this.instances.filter((i) => i.roomId === roomId);
  }

  byDefinition(definitionId) {
    return this.instances.filter((i) => i.definitionId === definitionId);
  }

  all() {
    return [...this.instances];
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { instances: this.instances };
  }

  load(data) {
    if (!data?.instances) return;
    this.instances = data.instances.map((i) => ({ definitionSource: "library", roomId: CURRENT_ROOM_ID, rotationY: 0, scale: 1, colorOverride: null, groupId: null, groupName: null, ...i }));
    const maxId = this.instances.reduce((m, i) => Math.max(m, i.id), 0);
    _nextId = maxId + 1;
    this.events.emit("instances:changed", this.instances);
  }
}
