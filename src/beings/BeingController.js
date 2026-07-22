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
import { ResidentMovement, getIdleLocation, randomIdleLocationId, MIN_REST_SECONDS } from "../resident/ResidentMovement.js";
import { getPersonalityModifiers } from "../resident/ResidentContext.js";
import { currentTimeBucket, currentWeatherId, isRainingNow, isGoldenHourNow } from "../resident/ResidentWorldSignals.js";
import { FURNITURE_LAYOUT } from "../data/layoutDefault.js";
import { ResidentRenderer } from "../resident/ResidentRenderer.js";
import { defaultEmbodimentConfig } from "../ai/EmbodimentConfiguration.js";
import { EXPRESSIONS } from "../resident/ResidentBehaviour.js";

const SAVE_SYNC_INTERVAL = 2; // seconds — how often a moving Being's live position is written back to BeingInstanceStore, not every frame (see this file's own comment)
const MIN_CONTINUITY_SECONDS = 30; // a Being reasonably notices and moves on within this short a gap; below it, nothing visibly changes on reload, matching "nothing should feel scripted"
const AWARENESS_RADIUS = 3.5;
const AWARENESS_FULL_RADIUS = 1.8;
// Version 4, Phase 7 — the "quiet familiarity" half of the old
// ResidentController.js, reconstructed from docs/RESIDENT.md's own
// documented behaviour (the original file's exact source didn't survive
// its own deletion this phase — see this file's own "Resident life" comment
// below for the full account). MOOD_DRIFT bounds match "every
// two-to-five minutes" exactly as documented; PATTERN_SAMPLE_INTERVAL's
// precise original value wasn't recorded anywhere and is a reasonable
// reconstruction, not a recovered constant.
const MOOD_DRIFT_MIN_SECONDS = 120;
const MOOD_DRIFT_MAX_SECONDS = 300;
const PATTERN_SAMPLE_INTERVAL = 30;
const RELATIONSHIP_AWARENESS_RADIUS = 3;
// "content"/"curious"/"happy" per docs/RESIDENT.md's own "Mood, Emotion,
// and Personality" section — but the real ExpressionTypes.js id for that
// first one is "neutral" ("content" was its name before the Workshop
// Personality phase's own rename; the doc's prose never caught up).
// Found and fixed, Version 4 Phase 7b, the moment mood was first actually
// rendered as a face rather than only ever read back as a plain string.
const MOOD_CANDIDATES = ["neutral", "curious", "happy"];
// Version 4, Phase 7a — the idle-location weighting half of the old
// ResidentController._windowWatchWeights(), same reconstruction caveat as
// above: the exact original multiplier values didn't survive the file's
// own deletion, these are reasonable values matching the documented
// *behaviour*, not recovered originals. Matches PlayerPatternMemory.js's
// own workbench/computer-desk zone radius (2.4) for "watching the player
// work" — the same real furniture positions, deliberately not a second,
// slightly-different radius.
const CLOCK_WATCH_MINUTES = 6;
const WORKBENCH_WATCH_RADIUS = 2.4;

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
  constructor({
    beingLibrary,
    beingInstanceStore,
    modelLoader,
    modelLibrary,
    animationLibraryStore,
    beingResidentStateStore = null,
    residentProfileStore = null,
    environmentSystem = null,
    timeOfDaySystem = null,
    musicSystem = null,
    projectsStore = null,
    residentConnection = null,
    expressionSetStore = null,
  }) {
    this.beingLibrary = beingLibrary;
    this.beingInstanceStore = beingInstanceStore;
    this.modelLoader = modelLoader;
    this.modelLibrary = modelLibrary;
    this.animationLibraryStore = animationLibraryStore;
    this.beingResidentStateStore = beingResidentStateStore; // Version 4, Phase 7 — resident-capable Beings only, see _updateResidentTravel()/_updateResidentLife()
    this.residentProfileStore = residentProfileStore; // Version 4, Phase 7 — trait/dial modifiers for mood drift, see _driftMood()
    this.environmentSystem = environmentSystem; // Version 4, Phase 7 — weather signal for pattern sampling, see _updateResidentLife()
    this.timeOfDaySystem = timeOfDaySystem; // Version 4, Phase 7 — time-of-day signal for pattern sampling, see _updateResidentLife()
    this.musicSystem = musicSystem; // Version 4, Phase 7 — "listening to music" activity sampling, see _samplePatterns()
    this.projectsStore = projectsStore; // Version 4, Phase 7a — "an active project pulls toward the workbench," see _residentLocationWeights()
    this.residentConnection = residentConnection; // Version 4, Phase 7b — offline -> "sleeping" expression override, see _updateResidentTravel()
    this.expressionSetStore = expressionSetStore; // Version 4, Phase 7b — a resident-embodiment Being's own custom pixel-art face, see _spawnRuntime()
    this._runtime = new Map(); // instanceId -> { root, entity, wanderTarget, patrolRoute, patrolIndex, restTimer, bobPhase, awarenessBlend, syncTimer, modelMesh, skeleton: {map, rest} | null, clipPlayer, activeClipId, residentMovement: ResidentMovement | null, moodDriftTimer, patternSampleTimer }
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
    // Version 4, Phase 7b — restores ResidentController.js's own old
    // dual use of "isThinking" (the squash/stretch pulse and the
    // "thinking" expression override), now per-instance.
    // ResidentConversation.js emits this at the exact same
    // setThinking(true)/setThinking(false) call sites Phase 7a already
    // instrumented once for the thinking-sound cue.
    engine.events.on("resident:thinkingChanged", ({ beingInstanceId, thinking }) => {
      const runtime = this._runtime.get(beingInstanceId);
      if (runtime) runtime.residentThinking = thinking;
    });
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

      if (definition.movementStyle === "residentTravel") {
        this._applyResidentContinuity(instance, definition, runtime, cappedElapsedSeconds);
        continue;
      }

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

  /** Version 4, Phase 7a — Bubble's own bespoke continuity, restored.
   *  `ResidentController._applyContinuity()`'s original answer: has enough
   *  time passed that she'd plausibly have moved on from exactly where she
   *  was left? Below `MIN_REST_SECONDS` (90s — the shortest she'd ever
   *  actually rest somewhere, the same real constant `ResidentMovement.js`
   *  uses for its own ordinary wandering), no — the outer loop's own,
   *  looser 30s `MIN_CONTINUITY_SECONDS` gate already got her here, but
   *  this stricter, resident-specific threshold is what actually decides
   *  whether she moves. Past it: a genuinely new named location (weighted
   *  the same way an ordinary autonomous pick would be — see
   *  `_residentLocationWeights()` — `playerPos: null` since nobody's in
   *  the room yet to be "watched"), arrived at directly via
   *  `setDraggedPosition()`/`setDraggedLookAt()`, no travel ease — the
   *  same primitives Bubble's own drag-to-reposition already uses,
   *  docs/PERSISTENCE.md's own "Bubble Continuity" section. */
  _applyResidentContinuity(instance, definition, runtime, cappedElapsedSeconds) {
    if (cappedElapsedSeconds < MIN_REST_SECONDS) return;
    const bundle = this.beingResidentStateStore?.getOrCreate(instance.id);
    const residentState = bundle?.residentState;
    if (!residentState) return;

    const currentId = residentState.idleLocationId;
    const weights = this._residentLocationWeights(definition, bundle, null);
    const nextId = randomIdleLocationId(currentId, weights);
    const nextLocation = getIdleLocation(nextId);

    if (!runtime.residentMovement) {
      runtime.residentMovement = new ResidentMovement(nextId, nextLocation.position);
    } else {
      runtime.residentMovement.setDraggedPosition(nextLocation.position);
      runtime.residentMovement.setDraggedLookAt(nextLocation.lookAt);
    }
    runtime.root.position.copy(nextLocation.position);
    residentState.setIdleLocation(nextId);
    residentState.currentPosition = { x: nextLocation.position.x, y: nextLocation.position.y, z: nextLocation.position.z };
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

    // Version 4, Phase 7b — a resident-embodiment Being (Bubble, the
    // Workshop's own built-in resident — never a player design) uses
    // `ResidentRenderer.js`'s own real, unmodified visual directly as
    // its entity root, rather than a wrapping THREE.Group holding a
    // compiled body or an imported model — `ResidentRenderer.update()`
    // already sets its own `root.position`/`rotation.y` every frame (see
    // `_updateResidentTravel()`), which would conflict with a second
    // wrapper group interpreting the same values as a local transform.
    const residentRenderer = definition.bodySource === "residentEmbodiment" ? this._buildResidentRenderer(definition) : null;
    const root = residentRenderer ? residentRenderer.root : new THREE.Group();
    root.name = `being-${instance.id}`;
    root.position.set(instance.position[0], instance.position[1], instance.position[2]);
    root.rotation.y = instance.rotationY ?? 0;
    root.scale.setScalar(definition.scale ?? 1);

    const placeholder = residentRenderer ? null : this.modelLoader.buildPlaceholder();
    if (placeholder) root.add(placeholder);

    const entity = new Entity(`being-${instance.id}`);
    entity.addComponent(new MeshComponent(root, this.engine.scene));
    if (definition.interactionBehaviour !== "none") {
      entity.addComponent(
        new InteractableComponent({
          prompt: { talk: "Talk", wave: "Say hello", inspect: "Inspect", aiResident: "Talk" }[definition.interactionBehaviour] ?? "Interact",
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
      residentMovement: null, // Version 4, Phase 7 — lazily built only for movementStyle "residentTravel", see _updateResidentTravel()
      residentPlayerCommand: null, // null | "stay" | "follow" | "goto" — see setResidentCommand()/sendResidentTo()
      residentGoToTarget: null, // THREE.Vector3 | null — only meaningful while residentPlayerCommand === "goto"
      residentRenderer, // Version 4, Phase 7b — ResidentRenderer | null, see _buildResidentRenderer()/_updateResidentTravel()
      residentExpressionSetId: undefined, // Version 4, Phase 7b — last-applied expressionSetId (or null for "default"), see _updateResidentTravel()'s own change-guard
      residentThinking: false, // Version 4, Phase 7b — set by the resident:thinkingChanged listener in init()
      // Version 4, Phase 7 — "quiet familiarity" timers, only ever decremented for a resident-capable instance (see _updateResidentLife()); staggered the same way syncTimer already is above.
      moodDriftTimer: MOOD_DRIFT_MIN_SECONDS + Math.random() * (MOOD_DRIFT_MAX_SECONDS - MOOD_DRIFT_MIN_SECONDS),
      patternSampleTimer: Math.random() * PATTERN_SAMPLE_INTERVAL,
    };
    this._runtime.set(instance.id, runtime);

    if (residentRenderer) {
      // Body is already fully built above — nothing more to do.
    } else if (definition.bodySource === "primitives" && definition.bodyParts?.length) {
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

  /** Version 4, Phase 7b — resolves the resident-embodiment Being's own
   *  profile for its embodiment/expression-set config, and constructs a
   *  real `ResidentRenderer.js` instance — the exact same class the
   *  deleted `ResidentEntity.js` always used, genuinely unmodified. A
   *  profile that doesn't resolve (deleted, or not yet linked) still
   *  gets a real body via `defaultEmbodimentConfig()`, the same "never a
   *  blank/broken visual" standard every other missing-reference case in
   *  this codebase already holds itself to. */
  _buildResidentRenderer(definition) {
    const profile = this._residentProfile(definition);
    const renderer = new ResidentRenderer(profile?.embodiment ?? defaultEmbodimentConfig());
    const expressionSetId = this._resolveExpressionSetId(profile);
    if (expressionSetId) renderer.setExpressionSet(this.expressionSetStore?.get(expressionSetId) ?? null);
    return renderer;
  }

  /** `"default"` is the reserved sentinel for "no custom set, use the
   *  built-in procedural drawing" — normalized to `null` here once so
   *  both the initial build above and every frame's own live-change
   *  check in `_updateResidentTravel()` compare against the same shape. */
  _resolveExpressionSetId(profile) {
    return profile?.expressionSetId && profile.expressionSetId !== "default" ? profile.expressionSetId : null;
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
    runtime.residentRenderer?.dispose(); // Version 4, Phase 7b — releases the face canvas texture/etc.; entity.destroy() only removes root from the scene, it doesn't know this class holds its own extra GPU resources
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
    // "Quiet familiarity" — mood drift and preference/pattern/relationship
    // sampling apply to any resident-capable instance regardless of its
    // own movement style (resident-ness is interactionBehaviour +
    // residentProfileId, an orthogonal question to how it moves), so this
    // runs ahead of the movement-style branch below rather than being
    // folded into _updateResidentTravel() specifically.
    if (this.beingResidentStateStore?.isResidentCapable(instance)) {
      this._updateResidentLife(dt, instance, definition, runtime);
    }

    const home = new THREE.Vector3(instance.homePosition[0], instance.homePosition[1], instance.homePosition[2]);

    // --- Movement style ---
    if (definition.movementStyle === "residentTravel") {
      // Owns position, Y-bob, and facing completely (ResidentMovement's
      // own update() already computes all three) — skip the generic
      // idle-bob/awareness blocks below entirely for this style, the same
      // way "static" already skips movement, so the two systems never
      // fight over the same transform. Still shares animation playback
      // with every other Being below; persistence sync happens inside
      // _updateResidentTravel() itself, since it needs syncY: true unlike
      // the generic path just below.
      this._updateResidentTravel(dt, instance, definition, runtime, playerPos);
      if (runtime.skeleton) this._updateAnimation(dt, instance, definition, runtime);
      return;
    }
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

    this._syncPeriodically(instance, runtime, dt);

    // --- Animation playback (see this class's own "Animation playback" comment) ---
    if (runtime.skeleton) this._updateAnimation(dt, instance, definition, runtime);
  }

  /** Periodic persistence sync (see this file's own top comment on why
   *  not every frame) — factored out since `residentTravel` shares it too
   *  (Version 4, Phase 7). `syncY` defaults off: for every ordinary
   *  movement style, Y is a purely cosmetic idle-bob offset around a
   *  fixed base height, deliberately never baked into the saved position.
   *  `residentTravel` passes it on, since its own Y genuinely differs
   *  between idle locations (a chair versus standing), not a bob. */
  _syncPeriodically(instance, runtime, dt, { syncY = false } = {}) {
    runtime.syncTimer -= dt;
    if (runtime.syncTimer <= 0) {
      runtime.syncTimer = SAVE_SYNC_INTERVAL;
      instance.position = [runtime.root.position.x, syncY ? runtime.root.position.y : instance.position[1], runtime.root.position.z];
      instance.rotationY = runtime.root.rotation.y;
    }
  }

  /** Version 4, Phase 7 — Bubble's own bespoke idle-location travel,
   *  reused wholesale via `ResidentMovement.js` rather than reimplemented
   *  as a wander variant (decided with Vi, to preserve her exact
   *  movement feel rather than switch her to a generic style). Owns
   *  position, Y, and facing completely — see this method's own call
   *  site in `_updateOne()` for why the generic idle-bob/awareness blocks
   *  are skipped for this style.
   *
   *  **Version 4, Phase 7a — two of Phase 7's own three named
   *  simplifications, restored.** Preference-weighted spot selection is
   *  now real (`_residentLocationWeights()`, passed as
   *  `maybePickNewLocation()`'s own `weights` argument), and personality
   *  trait/dial modifiers now genuinely reach `ResidentMovement`'s own
   *  `setRestDurationMultiplier()`/`setMovementSpeedMultiplier()`/
   *  `setMotionDamping()`, resolved fresh each frame via
   *  `getPersonalityModifiers()` — cheap and pure, so no separate
   *  "profile changed" tracking is needed. The third — autonomous travel
   *  not pausing during a conversation, since `BeingController` still has
   *  no reach into the conversation overlay's own lifecycle — remains,
   *  honestly, unresolved. */
  _updateResidentTravel(dt, instance, definition, runtime, playerPos) {
    const bundle = this.beingResidentStateStore?.getOrCreate(instance.id);
    const residentState = bundle?.residentState ?? null;

    if (!runtime.residentMovement) {
      runtime.residentMovement = new ResidentMovement(residentState?.idleLocationId ?? null, residentState?.currentPosition ?? null);
      if (residentState && !residentState.idleLocationId) residentState.setIdleLocation(getIdleLocation(null).id);
    }

    const profile = this._residentProfile(definition);
    const modifiers = getPersonalityModifiers(profile);
    runtime.residentMovement.setRestDurationMultiplier(modifiers.restDurationMultiplier);
    runtime.residentMovement.setMovementSpeedMultiplier(modifiers.movementSpeedMultiplier);
    runtime.residentMovement.setMotionDamping(modifiers.motionDamping);

    // Player commands — Stay Here / Follow Me / Return Home / a one-time
    // Goto — the same shape `ResidentController.js`'s own `playerCommand`
    // field already drove, now per-instance via `setResidentCommand()`/
    // `sendResidentTo()` below rather than one shared field. "Return Home"
    // is a one-shot `travelTo()` handled directly in that method, not a
    // standing mode, so it isn't checked here.
    if (runtime.residentPlayerCommand === "goto" && runtime.residentGoToTarget) {
      const dx = runtime.residentGoToTarget.x - runtime.residentMovement.currentPosition.x;
      const dz = runtime.residentGoToTarget.z - runtime.residentMovement.currentPosition.z;
      if (Math.hypot(dx, dz) < 0.15) {
        runtime.residentPlayerCommand = null;
        runtime.residentGoToTarget = null;
      } else {
        runtime.residentMovement.stepToward(runtime.residentGoToTarget, dt);
      }
    } else if (runtime.residentPlayerCommand === "follow" && playerPos) {
      runtime.residentMovement.stepToward(playerPos, dt);
    } else if (runtime.residentPlayerCommand !== "stay") {
      const currentId = residentState?.idleLocationId ?? null;
      const weights = this._residentLocationWeights(definition, bundle, playerPos);
      const newId = runtime.residentMovement.maybePickNewLocation(dt, currentId, weights);
      if (newId && residentState) {
        residentState.setIdleLocation(newId);
        // "Bumped a little at a time... arriving somewhere" (docs/RESIDENT.md's
        // own Preferences section) — the arrival-triggered half of pattern
        // sampling; the slow periodic half (weather/time/activities/
        // relationships) lives in _samplePatterns() below.
        bundle?.residentPreferences?.bump("locations", newId);
      }
    }
    // "stay" — no autonomous travel pick, matching ResidentController's
    // own gate; awareness/look-at below still applies regardless.

    const before = runtime.root.position.clone();
    const motion = runtime.residentMovement.update(dt, {
      thinking: runtime.residentThinking,
      idleBehaviour: profile?.embodiment?.idleBehaviour ?? "gentleFloat",
    });

    // The same "blend the idle look-at toward the player when close"
    // ResidentController.js already does, reusing this class's own
    // existing awareness-blend calculation rather than inventing a
    // second one. Version 4, Phase 7a — the radii themselves now scale
    // with the Independence/Talkativeness dials' own
    // `awarenessRadiusMultiplier`, computed above.
    const lookTarget = motion.lookAt.clone();
    const awarenessRadius = AWARENESS_RADIUS * modifiers.awarenessRadiusMultiplier;
    const awarenessFullRadius = AWARENESS_FULL_RADIUS * modifiers.awarenessRadiusMultiplier;
    const referencePos = runtime.residentRenderer ? motion.position : runtime.root.position;
    if (definition.awarenessMode !== "ignorePlayer" && playerPos) {
      const dist = referencePos.distanceTo(playerPos);
      let target = 0;
      if (dist <= awarenessFullRadius) target = 1;
      else if (dist <= awarenessRadius) target = 1 - (dist - awarenessFullRadius) / (awarenessRadius - awarenessFullRadius);
      runtime.awarenessBlend += (target - runtime.awarenessBlend) * Math.min(1, dt * 3);
      if (runtime.awarenessBlend > 0.01) lookTarget.lerp(playerPos, runtime.awarenessBlend);
    }

    // Version 4, Phase 7b — a resident-embodiment Being hands position,
    // rotation, scale, and the look-at itself entirely to
    // ResidentRenderer.update(), which already owns its own face-turn
    // easing internally (see that class's own comment) — no separate
    // whole-body yaw-toward-player the way a skeleton body needs, since
    // the original design only ever turned Bubble's *face*, not her
    // whole body, toward the player.
    if (runtime.residentRenderer) {
      runtime.residentRenderer.setEmbodiment(profile?.embodiment ?? defaultEmbodimentConfig());
      // Resolved fresh each frame, same as embodiment above, but only
      // actually applied on a real change — setExpressionSet() redraws the
      // face canvas immediately when one's already showing (see that
      // method's own comment), and doing that unconditionally 60 times a
      // second would be exactly the wasted work "redrawn only when the
      // expression actually changes" already rules out for ordinary
      // expression changes.
      const expressionSetId = this._resolveExpressionSetId(profile);
      if (expressionSetId !== runtime.residentExpressionSetId) {
        runtime.residentExpressionSetId = expressionSetId;
        runtime.residentRenderer.setExpressionSet(expressionSetId ? this.expressionSetStore?.get(expressionSetId) ?? null : null);
      }
      runtime.residentRenderer.update(dt, { position: motion.position, idleRotationY: motion.idleRotationY, scale: motion.scale, lookTarget });
      runtime.residentRenderer.setAwake(!this.residentConnection || this.residentConnection.isAwake);
      runtime.residentRenderer.setExpression(this._residentExpression(residentState, runtime));
      instance.currentState = before.distanceTo(motion.position) > 0.001 ? "moving" : "idle";
      if (residentState) residentState.currentPosition = { x: motion.position.x, y: motion.position.y, z: motion.position.z };
      this._syncPeriodically(instance, runtime, dt, { syncY: true });
      return;
    }

    runtime.root.position.copy(motion.position);
    const toLook = new THREE.Vector3().subVectors(lookTarget, runtime.root.position);
    if (toLook.lengthSq() > 0.0001) {
      runtime.root.rotation.y = lerpAngle(runtime.root.rotation.y, Math.atan2(toLook.x, toLook.z), Math.min(1, dt * 4));
    }

    // ResidentMovement doesn't expose a clean "am I currently
    // translating" flag — comparing real frame-to-frame movement is an
    // honest, robust substitute for driving walk/idle animation state.
    instance.currentState = before.distanceTo(runtime.root.position) > 0.001 ? "moving" : "idle";

    if (residentState) residentState.currentPosition = { x: motion.position.x, y: motion.position.y, z: motion.position.z };

    this._syncPeriodically(instance, runtime, dt, { syncY: true });
  }

  /** Version 4, Phase 7b — the same short-overrides-medium-overrides-
   *  baseline priority `ResidentBehaviour.computeExpression()` always
   *  used (`sleeping` > `thinking` > mood), reconstructed here since that
   *  class is now ephemeral, scoped to one open conversation, with no
   *  standing per-instance state left for this to read. Deliberately
   *  drops the fourth, shortest tier — the brief per-conversation
   *  "emotion" blip `triggerEmotion()` used to layer on top — a small,
   *  honestly-named gap, not silently reconstructed halfway; see this
   *  file's own header comment. */
  _residentExpression(residentState, runtime) {
    if (this.residentConnection && !this.residentConnection.isAwake) return "sleeping";
    if (runtime.residentThinking) return "thinking";
    const mood = residentState?.mood;
    return EXPRESSIONS.includes(mood) ? mood : "neutral";
  }

  /** Version 4, Phase 7 — "quiet familiarity," the other half of the old
   *  `ResidentController.js`'s per-frame work (mood drift, preference/
   *  pattern/relationship sampling), reconstructed from docs/RESIDENT.md's
   *  own documented behaviour rather than copied — the original file's
   *  source didn't survive its own deletion this phase, and this gap was
   *  only caught by a live check against what the docs already promised
   *  (see this phase's own account in docs/ROADMAP.md). Applies to any
   *  resident-capable instance, not just Bubble — the same "reference
   *  implementation, not a special case" standard every other resident
   *  mechanism in this codebase already holds itself to. */
  _updateResidentLife(dt, instance, definition, runtime) {
    const bundle = this.beingResidentStateStore.getOrCreate(instance.id);
    const { residentState, residentPreferences, playerPatternMemory } = bundle;
    if (!residentState) return;

    runtime.moodDriftTimer -= dt;
    if (runtime.moodDriftTimer <= 0) {
      runtime.moodDriftTimer = MOOD_DRIFT_MIN_SECONDS + Math.random() * (MOOD_DRIFT_MAX_SECONDS - MOOD_DRIFT_MIN_SECONDS);
      this._driftMood(definition, residentState, residentPreferences);
    }

    runtime.patternSampleTimer -= dt;
    if (runtime.patternSampleTimer <= 0) {
      runtime.patternSampleTimer = PATTERN_SAMPLE_INTERVAL;
      this._samplePatterns(instance, runtime, residentState, residentPreferences, playerPatternMemory);
    }
  }

  /** A weighted pick among neutral/curious/happy — the only three
   *  docs/RESIDENT.md's own "Mood, Emotion, and Personality" section
   *  documents drift ever choosing between (that section's own prose
   *  calls the first one "content," its pre-rename name — see
   *  `MOOD_CANDIDATES`'s own comment above) — biased by the resident's own
   *  selected traits/dials (`ResidentContext.getPersonalityModifiers()`,
   *  the identical merged source `ResidentConversation.js` already reads
   *  for its own system-prompt line), nudged toward `happy` when the
   *  current weather or time of day matches an already-accumulated
   *  favourite, and weighted heavily toward whatever mood it already is so
   *  it settles rather than flickers between reconsiderations. */
  _driftMood(definition, residentState, residentPreferences) {
    const modifiers = getPersonalityModifiers(this._residentProfile(definition));
    const weights = {};
    for (const mood of MOOD_CANDIDATES) {
      weights[mood] = (modifiers.expressionBias[mood] ?? 1) * (mood === residentState.mood ? 3 : 1);
    }
    const favWeather = residentPreferences?.favourite("weather");
    const favTimeOfDay = residentPreferences?.favourite("timeOfDay");
    if ((favWeather && favWeather === currentWeatherId(this.environmentSystem)) || (favTimeOfDay && favTimeOfDay === currentTimeBucket(this.timeOfDaySystem))) {
      weights.happy *= 1.5;
    }
    residentState.setMood(pickWeighted(weights, MOOD_CANDIDATES));
  }

  /** The slow-timer half of pattern sampling — weather, time of day,
   *  window/music activities, the player's own live position, and
   *  relationship affinity toward any other Being currently idled nearby.
   *  The "arriving somewhere" location bump is separate — see
   *  `_updateResidentTravel()`'s own call to `residentPreferences.bump()`
   *  right where it already calls `residentState.setIdleLocation()`. */
  _samplePatterns(instance, runtime, residentState, residentPreferences, playerPatternMemory) {
    const bucket = currentTimeBucket(this.timeOfDaySystem);
    residentPreferences?.bump("timeOfDay", bucket);
    residentPreferences?.bump("weather", currentWeatherId(this.environmentSystem));

    if (residentState.idleLocationId === "lookingOutWindow") {
      residentPreferences?.bump("activities", isRainingNow(this.environmentSystem) ? "watchingRain" : "watchingTheSky");
    }
    if (residentState.idleLocationId === "byMusicPlayer" && this.musicSystem?.isPlaying) {
      residentPreferences?.bump("activities", "listeningToMusic");
    }

    if (playerPatternMemory && this._playerPos) playerPatternMemory.sample(this._playerPos, bucket);

    for (const [otherId, otherRuntime] of this._runtime) {
      if (otherId === instance.id) continue;
      if (runtime.root.position.distanceTo(otherRuntime.root.position) <= RELATIONSHIP_AWARENESS_RADIUS) {
        residentPreferences?.bump("relationships", String(otherId));
      }
    }
  }

  /** `definition.residentProfileId` resolved against `residentProfileStore`
   *  — the one place both `_driftMood()` and `_residentLocationWeights()`
   *  need "which profile is this instance's own," factored out once a
   *  second caller needed the identical two-line resolution. */
  _residentProfile(definition) {
    return definition.residentProfileId ? this.residentProfileStore?.get(definition.residentProfileId) : null;
  }

  /** Version 4, Phase 7a — the idle-location weighting half of the old
   *  `ResidentController._windowWatchWeights()`, restored (see this file's
   *  own top comment on why the exact original multiplier values are a
   *  reconstruction, not a recovery). Every behaviour
   *  `docs/RESIDENT.md`'s own "A quiet habit" and "Resident awareness,
   *  extended" sections name, in one place: rain or a windy sky pulls
   *  toward the window; so does golden hour; a storm, or simply
   *  nightfall, pulls toward the Quiet Corner instead — sheltering, or
   *  simply quieter; a few minutes either side of the hour pulls toward
   *  the clock; an active project on the workbench, or the player
   *  genuinely standing near the workbench/computer desk, both pull
   *  toward the workbench; and a genuine, already-accumulated favourite
   *  location gets a real, if modest, boost — scaled down by the
   *  Independence dial's own `favouriteLocationPullMultiplier`, a
   *  self-possessed resident less pulled by habit than an ordinary one.
   *  `playerPos` is `null` at continuity time (see
   *  `_applyResidentContinuity()`) — nobody's in the room yet to be
   *  "watched," so that one bump simply never fires then. Never a
   *  guarantee — one more weighted option among several in the same
   *  ordinary pick that always existed. */
  _residentLocationWeights(definition, bundle, playerPos) {
    const weights = {};
    const bump = (id, multiplier) => {
      weights[id] = (weights[id] ?? 1) * multiplier;
    };

    const weatherId = currentWeatherId(this.environmentSystem);
    if (isRainingNow(this.environmentSystem) || weatherId === "windy") bump("lookingOutWindow", 1.8);
    if (isGoldenHourNow(this.timeOfDaySystem)) bump("lookingOutWindow", 1.6);
    if (weatherId === "storm") bump("besideQuietCorner", 1.8);
    if (currentTimeBucket(this.timeOfDaySystem) === "night") bump("besideQuietCorner", 1.5);

    const hour = this.timeOfDaySystem?.currentTime ?? 12;
    const minutesFromHour = Math.abs((((hour % 1) * 60 + 30) % 60) - 30); // how many minutes either side of the nearest hour mark
    if (minutesFromHour <= CLOCK_WATCH_MINUTES) bump("besideClock", 2);

    if ((this.projectsStore?.byStatus("active")?.length ?? 0) > 0) bump("aboveWorkbench", 1.4);

    if (playerPos) {
      const workbenchPos = FURNITURE_LAYOUT.workbench.position;
      if (Math.hypot(playerPos.x - workbenchPos[0], playerPos.z - workbenchPos[2]) < WORKBENCH_WATCH_RADIUS) bump("aboveWorkbench", 1.5);
      const deskPos = FURNITURE_LAYOUT.computerDesk.position;
      if (Math.hypot(playerPos.x - deskPos[0], playerPos.z - deskPos[2]) < WORKBENCH_WATCH_RADIUS) bump("besideComputer", 1.5);
    }

    const modifiers = getPersonalityModifiers(this._residentProfile(definition));
    for (const [locId, w] of Object.entries(modifiers.locationWeights)) bump(locId, w);
    const favouriteLocation = bundle?.residentPreferences?.favourite("locations");
    if (favouriteLocation) bump(favouriteLocation, 1 + 0.5 * (modifiers.favouriteLocationPullMultiplier ?? 1));

    return weights;
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

  /** Version 4, Phase 7 — Stay Here / Follow Me, and clearing back to
   *  ordinary autonomous wandering (`command: null`) — the per-instance
   *  replacement for `ResidentController.playerCommand`'s own field,
   *  called from wherever a Phone/Computer resident dashboard used to
   *  call `residentController.stayHere()`/`.followMe()`/`.resumeWandering()`.
   *  A no-op for any instance not actually using `movementStyle:
   *  "residentTravel"` — there's nothing for this to mean otherwise. */
  setResidentCommand(instanceId, command) {
    const runtime = this._runtime.get(instanceId);
    if (!runtime) return;
    runtime.residentPlayerCommand = command;
    if (command !== "goto") runtime.residentGoToTarget = null;
  }

  /** Read-only counterpart — a Phone/Computer dashboard's own "is this
   *  currently active" button state, the same thing
   *  `residentController.playerCommand` used to expose directly. */
  getResidentCommand(instanceId) {
    return this._runtime.get(instanceId)?.residentPlayerCommand ?? null;
  }

  /** A one-time errand (the `moveTo` Workshop Function's own use, and
   *  Return Home below) — clears itself back to ordinary autonomous
   *  wandering once arrived, exactly like `ResidentController`'s own
   *  "goto" branch already did. */
  sendResidentTo(instanceId, position) {
    const runtime = this._runtime.get(instanceId);
    if (!runtime) return;
    runtime.residentPlayerCommand = "goto";
    runtime.residentGoToTarget = position instanceof THREE.Vector3 ? position : new THREE.Vector3(position.x, position.y, position.z);
  }

  /** Travels directly to the first idle location — `ResidentMovement.
   *  travelTo()`'s own real journey animation, not an instant snap —
   *  then resumes ordinary autonomous wandering on arrival, the same as
   *  any other idle-location arrival. */
  returnResidentHome(instanceId) {
    const runtime = this._runtime.get(instanceId);
    if (!runtime?.residentMovement) return;
    const bundle = this.beingResidentStateStore?.get(instanceId);
    const home = getIdleLocation(null);
    runtime.residentPlayerCommand = null;
    runtime.residentGoToTarget = null;
    runtime.residentMovement.travelTo(home.id);
    if (bundle) bundle.residentState.setIdleLocation(home.id);
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

/** A plain cumulative-weight random pick — the same "roll against a running
 *  total" shape `ResidentMovement.randomIdleLocationId()`'s own optional
 *  `weights` argument already established, applied here to moods instead
 *  of idle locations since the two domains don't share a candidate list. */
function pickWeighted(weights, candidates) {
  const total = candidates.reduce((sum, c) => sum + (weights[c] ?? 1), 0);
  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= weights[c] ?? 1;
    if (roll <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

function clampToRadius(point, center, radius) {
  const offset = new THREE.Vector3().subVectors(point, center);
  offset.y = 0;
  if (offset.length() <= radius) return point;
  return center.clone().add(offset.normalize().multiplyScalar(radius));
}
