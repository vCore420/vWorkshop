import * as THREE from "three";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { compileDefinition } from "./ObjectCompiler.js";
import { applyBehaviour, disposeBehaviour } from "./behaviours/index.js";
import { CURRENT_ROOM_ID } from "./WorldObjectsStore.js";
import { getConstructionPiece } from "./ConstructionLibrary.js";
import { COLLISION_HEIGHT_LIMIT } from "../entities/room/WorkshopRoom.js";
import { EnvironmentSystem } from "../systems/EnvironmentSystem.js";

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
  constructor({ objectLibraryStore, worldObjectsStore, modelLibrary, modelLoader }) {
    this.objectLibraryStore = objectLibraryStore;
    this.worldObjectsStore = worldObjectsStore;
    this.modelLibrary = modelLibrary;
    this.modelLoader = modelLoader;
    /** @type {Map<number, {entity: import('../core/Entity').Entity}>} */
    this.liveInstances = new Map();
    /** @type {Map<number, THREE.Box3>} instanceId -> cached collision box, skipped from the map entirely if the object sits entirely above head height */
    this.footprints = new Map();
    /** @type {Array<{instanceId:number, mesh:THREE.Object3D}>} every currently-live mesh tagged `swaysInWind` — see `_registerSwayParts()`/`update()`. */
    this._swayParts = [];
    this._swayTime = 0;
  }

  init(engine) {
    this.engine = engine;
    this._environmentSystem = engine.getSystem(EnvironmentSystem); // resolved once — see WorldEnvironmentSystem.js's own init() comment on why this is safe regardless of registration order
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
    this._swayParts = this._swayParts.filter((p) => p.instanceId !== instanceId);
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
    this._updateFootprint(instanceId, live.entity.object3D, this._resolveDefinition(instance));
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

  /** A single instance's own cached collision box, or `null` if it has
   *  none (entirely above head height — see `_updateFootprint()`'s own
   *  comment — or simply not currently live). "Object dimensions" reuses
   *  this real, already-computed box rather than a second, parallel
   *  measurement — see `BuildModeSystem._measureSelection()`. */
  getFootprint(instanceId) {
    return this.footprints.get(instanceId) ?? null;
  }

  /** `definition` is optional (every real call site has it on hand already
   *  — see each one's own comment) purely so a future caller that
   *  genuinely doesn't have it yet can't crash; without it, a ladder would
   *  just be treated as solid until the next real update.
   *
   *  Version 3, Phase 3b (refinement) — "ladders still don't work." A
   *  Builder-placed ladder was getting *two* independent things at once:
   *  `LadderSystem`'s own generously-padded climbable zone, and this
   *  system's ordinary solid walk-collision box, with nothing exempting
   *  one from the other. `CameraSystem._resolveCollisions()` pushed the
   *  player out of the solid box before they could ever walk far enough
   *  forward to actually enter the padded zone, which is barely bigger
   *  than the box itself — stopped at the ladder's own edge, from every
   *  side, with the climbing code never getting a chance to run. A ladder
   *  carrying the `"ladder"` behaviour (checked here the same way
   *  `_spawn()`/`_disposeInstanceBehaviours()` already read
   *  `definition.behaviours` for applying/disposing it) now gets no walk-
   *  collision footprint at all — climbable everywhere within its own
   *  zone, not just the small sliver of it a player could actually reach.
   *  Two small, honest tradeoffs: a ladder can no longer be stood on top
   *  of like a platform (never a real use case for one), and a player
   *  could technically walk through the rails at a steep angle without
   *  climbing — real per-shape collision would prevent that but is a much
   *  bigger, more fragile change than this bug justifies. */
  _updateFootprint(instanceId, object3D, definition) {
    object3D.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3D);
    const isClimbable = definition?.behaviours?.some((b) => b.type === "ladder");
    if (isClimbable || box.min.y >= COLLISION_HEIGHT_LIMIT) {
      this.footprints.delete(instanceId); // climbable (no solid collision at all — see above), or entirely above head height, same rule wall headers already follow
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
      this._swayParts = this._swayParts.filter((p) => p.instanceId !== instance.id); // otherwise _spawn()'s own _registerSwayParts() below would append fresh entries on top of stale references to the just-destroyed mesh
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
    if (instance.definitionSource === "importedModel") return this.modelLibrary?.get(instance.definitionId) ?? null;
    return this.objectLibraryStore.get(instance.definitionId);
  }

  /** "The Builder should treat imported models similarly to any other
   *  available shape." For an ordinary definition, this is just
   *  `compileDefinition()`. For an imported model, `ObjectCompiler`'s own
   *  synchronous geometry building doesn't apply at all — a wrapping
   *  group holds `ModelLoader`'s own honest placeholder immediately,
   *  swapped out for the real model the moment loading resolves, the
   *  same pattern `BeingController.js`/`BuildModeSystem.js`'s own ghost
   *  ing already use. The group itself is what `MeshComponent` gets, so
   *  its own identity (and this entity's transform) never changes
   *  regardless of which child is inside it at any given moment. */
  _buildObject3D(instance, definition) {
    if (instance.definitionSource !== "importedModel") {
      return compileDefinition(definition, { colorOverride: instance.colorOverride });
    }
    const group = new THREE.Group();
    const placeholder = this.modelLoader?.buildPlaceholder() ?? new THREE.Group();
    group.add(placeholder);
    this.modelLoader?.load(instance.definitionId).then((model) => {
      if (!model || !group.children.includes(placeholder)) return; // despawned/replaced before this resolved
      group.remove(placeholder);
      group.add(model);
      // Living Spaces phase — "imported Builder objects should behave as
      // first-class Workshop objects." _spawn() computed this instance's
      // footprint the moment it returned this group, when it still only
      // contained the small placeholder capsule above — every walk-
      // collision box for a freshly-placed or freshly-reloaded imported
      // model was sized to that capsule, not the model. Recomputing now,
      // against the real geometry that just arrived, closes the same gap
      // updateInstanceTransform() already closes whenever the object is
      // moved. Guarded on liveInstances rather than trusting the
      // placeholder check above alone: removeInstance() disposes this
      // group's contents but doesn't necessarily empty its children list,
      // so an instance despawned while its model was still loading must
      // not have a footprint silently reintroduced here after the fact.
      if (this.liveInstances.has(instance.id)) this._updateFootprint(instance.id, group, definition);
    });
    return group;
  }

  _spawn(instance) {
    const definition = this._resolveDefinition(instance);
    if (!definition) {
      console.warn(`[WorldObjectsSystem] instance ${instance.id} references missing definition ${instance.definitionId} (${instance.definitionSource}) — skipping.`);
      return null;
    }

    const object3D = this._buildObject3D(instance, definition);
    object3D.position.set(...instance.position);
    object3D.rotation.y = instance.rotationY ?? 0;
    object3D.rotation.x = instance.rotationX ?? 0;
    object3D.rotation.z = instance.rotationZ ?? 0;
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
    this._updateFootprint(instance.id, object3D, definition);
    this._registerSwayParts(instance.id, object3D);
    return entity;
  }

  /** "Wind influencing vegetation" — collected once per spawn (a
   *  one-time `traverse()`, not a per-frame search), so `update()` below
   *  only ever iterates a flat, already-known list of the meshes that
   *  actually asked for this (`ObjectCompiler.js`'s own `swaysInWind`
   *  flag), never every mesh in the scene. */
  _registerSwayParts(instanceId, object3D) {
    object3D.traverse((child) => {
      if (child.userData?.swaysInWind) this._swayParts.push({ instanceId, mesh: child });
    });
  }

  /** "Wind influencing vegetation" — a small, cheap sinusoidal rotation
   *  offset applied on top of each swaying part's own authored rest
   *  rotation (captured once, in `ObjectCompiler.js`), not a real cloth/
   *  soft-body simulation. Reads `EnvironmentSystem.windSpeed`/
   *  `windDirectionRad` directly (both already real, already computed —
   *  see that file's own comment) — genuinely tying into the existing
   *  weather system rather than a second, parallel wind value invented
   *  for this. Amplitude scales with `windSpeed`, so a still day is
   *  visibly still and a storm visibly tosses the branches, the same
   *  "fades in proportion to the condition driving it" instinct
   *  `WorldEnvironmentSystem.js`'s own clouds already follow. */
  update(dt) {
    if (this._swayParts.length === 0) return;
    this._swayTime += dt;
    const windSpeed = this._environmentSystem?.windSpeed ?? 0;
    const windDirectionRad = this._environmentSystem?.windDirectionRad ?? 0;
    const amplitude = 0.03 + windSpeed * 0.12; // radians — subtle even in a strong wind, never a violent thrash
    const speed = 1.2 + windSpeed * 2.2;
    for (const { mesh } of this._swayParts) {
      const rest = mesh.userData.restRotation;
      if (!rest) continue;
      const sway = Math.sin(this._swayTime * speed + mesh.userData.swayPhase) * amplitude;
      mesh.rotation.x = rest.x + sway * Math.sin(windDirectionRad);
      mesh.rotation.z = rest.z + sway * Math.cos(windDirectionRad);
    }
  }
}
