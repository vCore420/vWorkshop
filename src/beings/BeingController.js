import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { RoomLayoutSystem } from "../systems/RoomLayoutSystem.js";
import { FurnitureSystem } from "../systems/FurnitureSystem.js";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { pickWanderTarget, buildPatrolRoute, avoidObstacles, randomRestDuration, idleMotionOffset } from "./BeingMovementSystem.js";
import { autoMapSkeleton, isSkeletonMapUsable } from "../player/WorkshopSkeleton.js";
import { applyPoseToMappedSkeleton } from "../player/AnimationRetargeting.js";
import { ClipPlayer } from "../player/AnimationPlayback.js";
import { compileBody } from "./BodyCompiler.js";

const SAVE_SYNC_INTERVAL = 2; // seconds — how often a moving Being's live position is written back to BeingInstanceStore, not every frame (see this file's own comment)
const MIN_CONTINUITY_SECONDS = 30; // a Being reasonably notices and moves on within this short a gap; below it, nothing visibly changes on reload, matching "nothing should feel scripted"
const AWARENESS_RADIUS = 3.5;
const AWARENESS_FULL_RADIUS = 1.8;

/**
 * BeingController
 * -----------------
 * "Avoid tightly coupling these systems together." This is the one place
 * that *does* know about all of them at once — `BeingLibrary` (what a
 * Being is), `BeingInstanceStore` (which ones are placed and where),
 * `ModelLoader` (what they look like), `BeingMovementSystem` (how they
 * move) — the same "one small system reads several stores, none of the
 * stores know about each other" shape `ResidentController.js` already
 * established for the Workshop's first resident. Each placed instance
 * gets exactly one ECS `Entity` (`MeshComponent` for its rendered root,
 * `InteractableComponent` for its own Interaction behaviour) — the same
 * pipeline furniture and the resident already use, not a parallel one.
 *
 * Runtime state (a wander/patrol target, a rest timer, a bob phase) lives
 * entirely in this file's own `_runtime` map, keyed by instance id —
 * never persisted, since none of it means anything the moment the
 * Workshop reloads; `BeingInstanceStore.js`'s own comment covers what
 * *is* persisted and why position/rotation sync back only periodically
 * rather than every frame.
 *
 * **Animation playback, real since the Advanced Animation phase; two
 * ways to get a rigged body, since the Being Creator phase.** "Beings
 * should simply reference Workshop animation assets" was already true of
 * the *data* (`idleAnimationClipId`/`walkAnimationClipId` on a Being's
 * own definition); the Advanced Animation phase made it true of
 * *playback* for imported models — the moment a model finishes loading,
 * its skeleton is mapped onto the shared Workshop vocabulary
 * (`WorkshopSkeleton.autoMapSkeleton()`, cached on `ModelLibrary` so it
 * only runs once per model, not once per spawned instance). The Being
 * Creator phase added a second, simpler path: a primitive-built body
 * (`definition.bodySource === "primitives"`) is compiled directly via
 * `BodyCompiler.compileBody()`, which derives an *exact* skeleton map
 * from the creator's own explicit joint assignments — no heuristic
 * bone-name matching needed at all. Either way, once a usable mapping
 * exists (`isSkeletonMapUsable()`, for the imported path — a primitive
 * body's own map is trusted outright, since it was never a guess), the
 * same `ClipPlayer` (see `AnimationPlayback.js`) picks
 * `walkAnimationClipId`/`idleAnimationClipId` based on
 * `instance.currentState` and applies the result through
 * `AnimationRetargeting.applyPoseToMappedSkeleton()` every frame — one
 * animation system, genuinely shared, regardless of how a Being's own
 * body came to exist. A Being with an unmapped model, no model at all, or
 * an empty primitive body simply doesn't animate, honestly, rather than
 * animating nothing convincingly.
 */
export class BeingController {
  constructor({ beingLibrary, beingInstanceStore, modelLoader, modelLibrary, animationLibraryStore }) {
    this.beingLibrary = beingLibrary;
    this.beingInstanceStore = beingInstanceStore;
    this.modelLoader = modelLoader;
    this.modelLibrary = modelLibrary;
    this.animationLibraryStore = animationLibraryStore;
    this._runtime = new Map(); // instanceId -> { root, entity, wanderTarget, patrolRoute, patrolIndex, restTimer, bobPhase, awarenessBlend, syncTimer, modelMesh, skeleton: {map, rest} | null, clipPlayer, activeClipId }
    this._playerPos = new THREE.Vector3();
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._roomLayoutSystem = engine.getSystem(RoomLayoutSystem);
    this._furnitureSystem = engine.getSystem(FurnitureSystem);

    for (const instance of this.beingInstanceStore.active()) this._spawnRuntime(instance);

    this._offInstances = this.beingInstanceStore.events.on("instances:changed", () => this._reconcile());
    // "Beings should also begin participating in world continuity...
    // continue simple movement routines... resume believable positions.
    // This does not require advanced AI. Simple continuity is
    // sufficient." See _applyContinuity()'s own comment.
    engine.events.on("world:continuity", (continuity) => this._applyContinuity(continuity));
  }

  /** The same "pick one new plausible spot, don't animate the journey"
   *  answer Bubble's own continuity uses (`ResidentController.js`) —
   *  simpler here even than that, since a Being's own wander/patrol
   *  target is already just a point within its home radius, not a named
   *  location to choose between. A `movementStyle: "static"` Being never
   *  moves regardless of elapsed time, matching what it would actually do
   *  if the player had stayed and watched the whole time. */
  _applyContinuity({ cappedElapsedSeconds, isFirstSession }) {
    if (isFirstSession || cappedElapsedSeconds < MIN_CONTINUITY_SECONDS) return;
    const colliders = this._colliders();
    for (const [id, runtime] of this._runtime) {
      const instance = this.beingInstanceStore.get(id);
      const definition = instance && this.beingLibrary.get(instance.definitionId);
      if (!instance || !definition || definition.movementStyle === "static" || instance.despawned) continue;

      const home = new THREE.Vector3(instance.homePosition[0], instance.homePosition[1], instance.homePosition[2]);
      const target = pickWanderTarget(home, instance.homeRadius, colliders);
      runtime.root.position.copy(target);
      runtime.wanderTarget = null; // next ordinary wander pick starts fresh from here, not toward a now-irrelevant old target
      runtime.patrolRoute = null; // patrol resumes its own loop from wherever continuity just placed it, not from a stale route built around the old position
      runtime.patrolIndex = 0;
      runtime.restTimer = randomRestDuration();
      this.beingInstanceStore.update(id, { position: [target.x, target.y, target.z] });
    }
  }

  _colliders() {
    return [...(this._roomLayoutSystem?.getWallColliders() ?? []), ...(this._furnitureSystem?.getFootprints() ?? [])];
  }

  _reconcile() {
    const activeIds = new Set(this.beingInstanceStore.active().map((i) => i.id));
    for (const [id, runtime] of this._runtime) {
      if (!activeIds.has(id)) this._despawnRuntime(id, runtime);
    }
    for (const instance of this.beingInstanceStore.active()) {
      if (!this._runtime.has(instance.id)) this._spawnRuntime(instance);
    }
  }

  _spawnRuntime(instance) {
    const definition = this.beingLibrary.get(instance.definitionId);
    if (!definition) return; // its own definition was deleted from the library — nothing sensible to render

    const root = new THREE.Group();
    root.name = `being-${instance.id}`;
    root.position.set(instance.position[0], instance.position[1], instance.position[2]);
    root.rotation.y = instance.rotationY ?? 0;
    root.scale.setScalar(definition.scale ?? 1);

    const placeholder = this.modelLoader.buildPlaceholder();
    root.add(placeholder);

    const entity = new Entity(`being-${instance.id}`);
    entity.addComponent(new MeshComponent(root, this.engine.scene));
    if (definition.interactionBehaviour !== "none") {
      entity.addComponent(
        new InteractableComponent({
          prompt: { talk: "Talk", wave: "Say hello", inspect: "Inspect" }[definition.interactionBehaviour] ?? "Interact",
          radius: 1.8,
          onInteract: () => this.engine.events.emit("being:interact", { instanceId: instance.id, definitionId: definition.id }),
        })
      );
    }
    this.engine.entities.create(entity);

    const runtime = {
      root,
      entity,
      modelMesh: placeholder,
      wanderTarget: null,
      patrolRoute: null,
      patrolIndex: 0,
      restTimer: randomRestDuration(),
      bobPhase: Math.random() * Math.PI * 2,
      awarenessBlend: 0,
      syncTimer: Math.random() * SAVE_SYNC_INTERVAL, // desynchronised so many Beings don't all write-back on the same frame
      skeleton: null, // {map: {jointId: THREE.Object3D}, rest: {jointId: THREE.Quaternion}} once a usable mapping exists — see this file's own "Animation playback" comment
      clipPlayer: new ClipPlayer(),
      activeClipId: null,
    };
    this._runtime.set(instance.id, runtime);

    if (definition.bodySource === "primitives" && definition.bodyParts?.length) {
      // "The Workshop should treat imported beings exactly the same as
      // internally created beings" — the *result* (a real Object3D plus
      // a skeleton this same class already knows how to animate) is
      // identical either way; only how it's obtained differs. A
      // primitive body is built synchronously, directly from data
      // already in memory — no `.then()` needed, and no heuristic
      // skeleton detection either, since every joint was explicitly
      // assigned by the creator (see `BodyCompiler.js`'s own comment).
      root.remove(runtime.modelMesh);
      const { root: bodyRoot, skeletonMap, skeletonRest } = compileBody(definition.bodyParts);
      root.add(bodyRoot);
      runtime.modelMesh = bodyRoot;
      runtime.skeleton = Object.keys(skeletonMap).length > 0 ? { map: skeletonMap, rest: skeletonRest } : null;
    } else if (definition.modelId) {
      this.modelLoader.load(definition.modelId).then((model) => {
        if (!model || this._runtime.get(instance.id) !== runtime) return; // superseded (despawned, or a Replace Template already swapped it) before this resolved
        root.remove(runtime.modelMesh);
        root.add(model);
        runtime.modelMesh = model;
        runtime.skeleton = this._resolveSkeleton(definition.modelId, model);
      });
    }
  }

  /** Resolves (or, the first time, computes and caches) `modelId`'s own
   *  skeleton mapping against `model` — the *live* clone actually in the
   *  scene right now, since bone objects themselves are never stable
   *  across separate `ModelLoader.load()` calls (see `ModelLibrary.js`'s
   *  own comment on why only bone *names* are cached, not object
   *  references). Rest quaternions are always captured fresh here, from
   *  this specific clone's own current bind pose, never reused from a
   *  previous spawn. Returns `null` if no usable mapping exists — a
   *  model with fewer than half the Workshop skeleton's own joints
   *  recognised (see `WorkshopSkeleton.isSkeletonMapUsable()`) simply
   *  isn't animated, honestly, rather than animating a handful of limbs
   *  while the rest of the rig sits frozen. */
  _resolveSkeleton(modelId, model) {
    const cached = this.modelLibrary?.get(modelId)?.skeletonMap;
    if (cached) {
      const map = {};
      const rest = {};
      model.traverse((node) => {
        for (const [jointId, boneName] of Object.entries(cached)) {
          if (node.name === boneName && !map[jointId]) {
            map[jointId] = node;
            rest[jointId] = node.quaternion.clone();
          }
        }
      });
      return isSkeletonMapUsable(map) ? { map, rest } : null;
    }

    const { map, rest } = autoMapSkeleton(model);
    if (!isSkeletonMapUsable(map)) return null; // honestly not animated — see this method's own comment
    // Cache bone *names* (not the live objects above) so the next spawn
    // of this same model resolves them straight away instead of
    // re-running the heuristic matcher on every single clone.
    const nameMap = Object.fromEntries(Object.entries(map).map(([jointId, bone]) => [jointId, bone.name]));
    this.modelLibrary?.setSkeletonMap(modelId, nameMap);
    return { map, rest };
  }

  /** "Replace Template" (Being Manager) — swaps which definition an
   *  already-placed instance renders as, without despawning and
   *  respawning it (which would lose its own current position/state for
   *  no reason). */
  replaceTemplate(instanceId, newDefinitionId) {
    const instance = this.beingInstanceStore.get(instanceId);
    if (!instance) return;
    this.beingInstanceStore.update(instanceId, { definitionId: newDefinitionId });
    const runtime = this._runtime.get(instanceId);
    if (runtime) this._despawnRuntime(instanceId, runtime);
    this._spawnRuntime(this.beingInstanceStore.get(instanceId));
  }

  _despawnRuntime(id, runtime) {
    this.engine.entities.destroy(runtime.entity);
    this._runtime.delete(id);
  }

  update(dt) {
    if (!this.engine) return;
    const colliders = this._colliders();
    const playerPos = this._cameraSystem?.position ?? null;
    if (playerPos) this._playerPos.copy(playerPos);
    const otherPositions = this._collectPositions();

    for (const [id, runtime] of this._runtime) {
      const instance = this.beingInstanceStore.get(id);
      const definition = instance && this.beingLibrary.get(instance.definitionId);
      if (!instance || !definition) continue;
      this._updateOne(dt, instance, definition, runtime, colliders, otherPositions, playerPos);
    }
  }

  _collectPositions() {
    const positions = [];
    for (const runtime of this._runtime.values()) positions.push(runtime.root.position);
    return positions;
  }

  _updateOne(dt, instance, definition, runtime, colliders, otherPositions, playerPos) {
    const home = new THREE.Vector3(instance.homePosition[0], instance.homePosition[1], instance.homePosition[2]);

    // --- Movement style ---
    if (definition.movementStyle === "wander" || definition.movementStyle === "stayNearHome") {
      this._updateWander(dt, instance, definition, runtime, home, colliders);
    } else if (definition.movementStyle === "patrol") {
      this._updatePatrol(dt, instance, definition, runtime, home, colliders);
    } else if (definition.movementStyle === "follow" && playerPos) {
      this._updateFollow(dt, instance, definition, runtime, home, playerPos, colliders);
    }
    // "static" — no movement at all, the default and simplest case.

    // --- Obstacle/other-Being avoidance nudge, applied regardless of movement style ---
    const avoidPush = avoidObstacles(runtime.root.position, colliders, otherPositions.filter((p) => p !== runtime.root.position));
    if (avoidPush.lengthSq() > 0) runtime.root.position.add(avoidPush.multiplyScalar(dt * 1.5));

    // --- Idle procedural motion ---
    runtime.bobPhase += dt;
    const idleOffset = idleMotionOffset(definition.idleBehaviour, runtime.bobPhase);
    runtime.root.position.y = instance.position[1] + idleOffset.y;

    // --- Awareness ---
    if (definition.awarenessMode !== "ignorePlayer" && playerPos) {
      const dist = runtime.root.position.distanceTo(playerPos);
      let target = 0;
      if (dist <= AWARENESS_FULL_RADIUS) target = 1;
      else if (dist <= AWARENESS_RADIUS) target = 1 - (dist - AWARENESS_FULL_RADIUS) / (AWARENESS_RADIUS - AWARENESS_FULL_RADIUS);
      runtime.awarenessBlend += (target - runtime.awarenessBlend) * Math.min(1, dt * 3);
      if (runtime.awarenessBlend > 0.01) {
        const toPlayer = new THREE.Vector3().subVectors(playerPos, runtime.root.position);
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        runtime.root.rotation.y = lerpAngle(runtime.root.rotation.y, targetYaw, runtime.awarenessBlend * Math.min(1, dt * 3));
      } else {
        runtime.root.rotation.y += idleOffset.rotationY * dt * 0.5;
      }
    } else {
      runtime.root.rotation.y += idleOffset.rotationY * dt * 0.5;
    }

    // --- Periodic persistence sync (see this file's own top comment on why not every frame) ---
    runtime.syncTimer -= dt;
    if (runtime.syncTimer <= 0) {
      runtime.syncTimer = SAVE_SYNC_INTERVAL;
      instance.position = [runtime.root.position.x, instance.position[1], runtime.root.position.z];
      instance.rotationY = runtime.root.rotation.y;
    }

    // --- Animation playback (see this class's own "Animation playback" comment) ---
    if (runtime.skeleton) this._updateAnimation(dt, instance, definition, runtime);
  }

  _updateAnimation(dt, instance, definition, runtime) {
    const clipId = instance.currentState === "moving" ? definition.walkAnimationClipId : definition.idleAnimationClipId;
    const clip = clipId ? this.animationLibraryStore?.getClip(clipId) : null;
    if (runtime.activeClipId !== clipId) {
      runtime.clipPlayer.setClip(clip);
      runtime.activeClipId = clipId;
    }
    if (!clip) return; // no clip assigned for this state — the model simply holds its bind pose, honestly, rather than animating toward nothing
    const { pose, events } = runtime.clipPlayer.advance(dt);
    for (const event of events) this.engine?.events.emit("animation:event", { source: "being", instanceId: instance.id, clipId: clip.id, ...event });
    applyPoseToMappedSkeleton(pose, runtime.skeleton.map, runtime.skeleton.rest);
  }

  _updateWander(dt, instance, definition, runtime, home, colliders) {
    if (!runtime.wanderTarget) {
      runtime.restTimer -= dt;
      if (runtime.restTimer <= 0) {
        runtime.wanderTarget = pickWanderTarget(home, instance.homeRadius, colliders);
        instance.currentState = "moving";
      }
      return;
    }
    const arrived = this._stepToward(runtime, runtime.wanderTarget, definition.walkSpeed, definition.turnSpeed, dt);
    if (arrived) {
      runtime.wanderTarget = null;
      runtime.restTimer = randomRestDuration();
      instance.currentState = "idle";
    }
  }

  _updatePatrol(dt, instance, definition, runtime, home, colliders) {
    if (!runtime.patrolRoute) runtime.patrolRoute = buildPatrolRoute(home, instance.homeRadius, colliders);
    const target = runtime.patrolRoute[runtime.patrolIndex];
    instance.currentState = "moving";
    const arrived = this._stepToward(runtime, target, definition.walkSpeed, definition.turnSpeed, dt);
    if (arrived) runtime.patrolIndex = (runtime.patrolIndex + 1) % runtime.patrolRoute.length;
  }

  _updateFollow(dt, instance, definition, runtime, home, playerPos, colliders) {
    const distToPlayer = runtime.root.position.distanceTo(playerPos);
    const distHomeToPlayer = home.distanceTo(playerPos);
    // Only actually chases if the player is somewhere the Being's own
    // home radius would still reach — "stays near the player, within its
    // home radius," not "follows anywhere at all."
    if (distHomeToPlayer > instance.homeRadius + 1 || distToPlayer < 1.2) {
      instance.currentState = "idle";
      return;
    }
    instance.currentState = "moving";
    const target = clampToRadius(playerPos, home, instance.homeRadius);
    this._stepToward(runtime, target, definition.walkSpeed, definition.turnSpeed, dt);
  }

  /** Moves `runtime.root` a step toward `target` at `speed`, turning at
   *  `turnSpeed` — returns true once close enough to consider arrived. */
  _stepToward(runtime, target, speed, turnSpeed, dt) {
    const toTarget = new THREE.Vector3().subVectors(target, runtime.root.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist < 0.1) return true;
    toTarget.normalize();
    const targetYaw = Math.atan2(toTarget.x, toTarget.z);
    runtime.root.rotation.y = lerpAngle(runtime.root.rotation.y, targetYaw, Math.min(1, turnSpeed * dt));
    const step = Math.min(dist, speed * dt);
    runtime.root.position.addScaledVector(toTarget, step);
    return false;
  }

  dispose() {
    this._offInstances?.();
  }
}

function lerpAngle(from, to, t) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function clampToRadius(point, center, radius) {
  const offset = new THREE.Vector3().subVectors(point, center);
  offset.y = 0;
  if (offset.length() <= radius) return point;
  return center.clone().add(offset.normalize().multiplyScalar(radius));
}
