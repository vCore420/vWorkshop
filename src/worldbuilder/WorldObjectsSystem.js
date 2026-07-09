import * as THREE from "three";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { compileDefinition } from "./ObjectCompiler.js";
import { applyBehaviour, disposeBehaviour } from "./behaviours/index.js";
import { CURRENT_ROOM_ID } from "./WorldObjectsStore.js";
import { getConstructionPiece } from "./ConstructionLibrary.js";
import { COLLISION_HEIGHT_LIMIT } from "../entities/room/WorkshopRoom.js";

/**
 * WorldObjectsSystem
 * -------------------
 * Turns WorldObjectsStore's placed instances into real, always-present
 * entities — visible and interactive during ordinary exploration, not just
 * while Build Mode is open. BuildModeSystem is the only thing that mutates
 * WorldObjectsStore; this system is the only thing that turns those
 * mutations into scene changes. Neither needs to know how the other works
 * beyond that split.
 *
 * Like WorkbenchSystem, this can't safely spawn anything inside its own
 * `init()` — WorldObjectsStore and ObjectLibraryStore are providers, loaded
 * synchronously during the `engine:ready` event, which fires *after* every
 * system's `init()` has already run. `main.js` calls `spawnAll()`
 * explicitly, once, right after `await engine.init()` resolves — see the
 * same reasoning documented on WorkbenchSystem.finalizeInitialState().
 *
 * **Collision** (see docs/WORLDBUILDER.md): every placed instance gets a
 * cached `THREE.Box3`, computed with `Box3.setFromObject()` on its actual
 * compiled geometry rather than a hand-authored footprint — Builder
 * objects can be any shape at all, so there's no fixed width/depth to
 * declare the way furniture has. `CameraSystem` collides against these
 * exactly the way it already collides against furniture footprints and
 * wall segments — three flavours of "boxes the player can't walk through",
 * not three different collision systems. A box entirely above
 * `COLLISION_HEIGHT_LIMIT` (a decorative ceiling piece, say) is skipped
 * entirely, matching the same "a header above head height is real
 * geometry but never an obstacle" rule `WorkshopRoom.js`'s wall segments
 * already follow.
 */
export class WorldObjectsSystem {
  constructor({ objectLibraryStore, worldObjectsStore }) {
    this.objectLibraryStore = objectLibraryStore;
    this.worldObjectsStore = worldObjectsStore;
    /** @type {Map<number, {entity: import('../core/Entity').Entity}>} */
    this.liveInstances = new Map();
    /** @type {Map<number, THREE.Box3>} instanceId -> cached collision box, skipped from the map entirely if the object sits entirely above head height */
    this.footprints = new Map();
  }

  init(engine) {
    this.engine = engine;
  }

  /** Called once from main.js after persistence has actually loaded. */
  spawnAll() {
    for (const instance of this.worldObjectsStore.byRoom(CURRENT_ROOM_ID)) {
      this._spawn(instance);
    }
  }

  spawnInstance(instance) {
    return this._spawn(instance);
  }

  removeInstance(instanceId) {
    const live = this.liveInstances.get(instanceId);
    if (!live) return;
    const instance = this.worldObjectsStore.get(instanceId);
    if (instance) this._disposeInstanceBehaviours(instance, live.entity);
    this.engine.entities.destroy(live.entity);
    this.liveInstances.delete(instanceId);
    this.footprints.delete(instanceId);
    this.worldObjectsStore.remove(instanceId);
  }

  /** Cheap path: position/rotation/scale changed, no need to rebuild geometry. */
  updateInstanceTransform(instanceId, patch) {
    const live = this.liveInstances.get(instanceId);
    const instance = this.worldObjectsStore.update(instanceId, patch);
    if (!live || !instance) return;
    live.entity.object3D.position.set(...instance.position);
    live.entity.object3D.rotation.y = instance.rotationY;
    live.entity.object3D.scale.setScalar(instance.scale);
    this._updateFootprint(instanceId, live.entity.object3D);
  }

  /** Expensive path: colour override changes which cached material every part uses. */
  updateInstanceColorOverride(instanceId, colorOverride) {
    const instance = this.worldObjectsStore.update(instanceId, { colorOverride });
    if (!instance) return;
    this._respawn(instance);
  }

  /** A library definition's parts/behaviours changed — rebuild every live copy of it. */
  refreshInstancesOfDefinition(definitionId) {
    for (const instance of this.worldObjectsStore.byDefinition(definitionId)) {
      if (this.liveInstances.has(instance.id)) this._respawn(instance);
    }
  }

  getLiveEntity(instanceId) {
    return this.liveInstances.get(instanceId)?.entity ?? null;
  }

  /** All root Object3Ds currently placed — used by BuildModeSystem for selection raycasting. */
  getAllLiveObjects() {
    return [...this.liveInstances.values()].map((v) => v.entity.object3D);
  }

  /** THREE.Box3 list for CameraSystem's walk-collision — cached per
   *  instance, recomputed only on spawn/respawn/transform-change/removal,
   *  not on every call. Read every single frame while walking. */
  getFootprints() {
    return [...this.footprints.values()];
  }

  _updateFootprint(instanceId, object3D) {
    object3D.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3D);
    if (box.min.y >= COLLISION_HEIGHT_LIMIT) {
      this.footprints.delete(instanceId); // entirely above head height — not an obstacle, same rule wall headers already follow
    } else {
      this.footprints.set(instanceId, box);
    }
  }

  _respawn(instance) {
    const live = this.liveInstances.get(instance.id);
    if (live) {
      this._disposeInstanceBehaviours(instance, live.entity);
      this.engine.entities.destroy(live.entity);
      this.liveInstances.delete(instance.id);
    }
    this._spawn(instance);
  }

  _disposeInstanceBehaviours(instance, entity) {
    const definition = this._resolveDefinition(instance);
    if (!definition) return;
    for (const behaviour of definition.behaviours ?? []) {
      disposeBehaviour(behaviour.type, {
        entity,
        object3D: entity.object3D,
        properties: behaviour.properties ?? {},
        engine: this.engine,
        instance,
        definition,
      });
    }
  }

  _resolveDefinition(instance) {
    if (instance.definitionSource === "construction") return getConstructionPiece(instance.definitionId);
    return this.objectLibraryStore.get(instance.definitionId);
  }

  _spawn(instance) {
    const definition = this._resolveDefinition(instance);
    if (!definition) {
      console.warn(`[WorldObjectsSystem] instance ${instance.id} references missing definition ${instance.definitionId} (${instance.definitionSource}) — skipping.`);
      return null;
    }

    const object3D = compileDefinition(definition, { colorOverride: instance.colorOverride });
    object3D.position.set(...instance.position);
    object3D.rotation.y = instance.rotationY ?? 0;
    object3D.scale.setScalar(instance.scale ?? 1);

    const entity = new Entity(`worldObject-${instance.id}`).tag("worldObject");
    entity.userData.instanceId = instance.id;
    entity.userData.definitionId = definition.id;
    entity.addComponent(new MeshComponent(object3D, this.engine.scene));

    for (const behaviour of definition.behaviours ?? []) {
      applyBehaviour(behaviour.type, {
        entity,
        object3D,
        properties: behaviour.properties ?? {},
        engine: this.engine,
        instance,
        definition,
      });
    }

    this.engine.entities.create(entity);
    this.liveInstances.set(instance.id, { entity });
    this._updateFootprint(instance.id, object3D);
    return entity;
  }

  update(_dt) {}
}
