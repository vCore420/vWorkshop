import * as THREE from "three";
import { applyHoldPose, applyReachPose } from "../player/HandIK.js";
import { compileDefinition } from "../worldbuilder/ObjectCompiler.js";

const DROP_DISTANCE = 0.7; // metres in front of the player — close enough to feel deliberate, far enough not to overlap the player's own collision

/**
 * HandInteractionSystem
 * -----------------------
 * Version 4, Phase 8b ("The Rest of IK") — "world objects that can be
 * picked up, only allowing one item to be picked up at a time... this
 * give you something to reach for and use the hand placement." Owns the
 * two things `PickupableBehaviour.js` and `LightingSystem.js`'s own
 * light switch both hand off via an event, rather than either reaching
 * into this system directly (the same decoupled shape `main.js`'s own
 * `being:interact` listener already establishes): picking up and holding
 * a single item at a time, and playing a one-shot reach animation
 * whenever the light switch is flipped. Registered *after*
 * `PlayerAnimationSystem` in `main.js`, so this frame's own base pose has
 * already been applied before `HandIK.js`'s corrections layer on top of
 * it — the identical "correction, not replacement" contract
 * `FootIK.js`'s own callers already follow, just from a separate system
 * rather than a call `PlayerAnimationSystem` makes directly, since
 * `PlayerAnimationSystem` itself is left completely untouched this phase
 * to avoid any regression risk to its own already-verified code.
 *
 * **Right hand holds, left hand reaches** — see `HandIK.js`'s own header
 * for why that's a deliberate assignment, not an arbitrary one; the two
 * poses below never need to coordinate.
 */
export class HandInteractionSystem {
  constructor({ worldObjectsStore, worldObjectsSystem, playerCharacterSystem, cameraSystem, interactionSystem }) {
    this.worldObjectsStore = worldObjectsStore;
    this.worldObjectsSystem = worldObjectsSystem;
    this.playerCharacterSystem = playerCharacterSystem;
    this.cameraSystem = cameraSystem;
    this.interactionSystem = interactionSystem;

    this._heldDefinitionId = null;
    this._heldDefinitionSource = null;
    this._heldMesh = null; // THREE.Object3D, parented to the right-hand pivot once one exists — see update()'s own lazy-attach

    this._reachElapsed = null; // null while no reach is playing
    this._reachTargetWorld = null;
  }

  init(engine) {
    this.engine = engine;
    engine.events.on("item:pickupRequested", ({ instanceId }) => this._pickUp(instanceId));
    engine.events.on("lightSwitch:flipped", ({ position }) => this._startReach(position));
  }

  update(dt) {
    const pivots = this.playerCharacterSystem?.getPivots();

    // A held item restored from a save, before the rig existed yet to
    // attach it to (see load()'s own comment) — attached the first
    // opportunity a real rig actually exists.
    if (this._heldDefinitionId && !this._heldMesh && pivots?.handRight) {
      this._attachHeldMesh(pivots);
    }

    if (this._heldDefinitionId) {
      applyHoldPose(pivots);
      if (!this.interactionSystem?.hasNearestInteractable && this.engine.input?.wasJustPressed("interact")) {
        this._putDown();
      }
    }

    if (this._reachElapsed !== null) {
      this._reachElapsed += dt;
      const stillPlaying = applyReachPose(pivots, this._reachTargetWorld, this._reachElapsed);
      if (!stillPlaying) {
        this._reachElapsed = null;
        this._reachTargetWorld = null;
      }
    }
  }

  _pickUp(instanceId) {
    if (this._heldDefinitionId) {
      this.engine.events.emit("hud:toast", { text: "Already carrying something — put it down first." });
      return;
    }
    const instance = this.worldObjectsStore.get(instanceId);
    if (!instance) return; // already gone somehow — nothing to pick up

    const definition = this.worldObjectsSystem.resolveDefinition(instance);
    if (!definition) return;

    this._heldDefinitionId = instance.definitionId;
    this._heldDefinitionSource = instance.definitionSource;
    this.worldObjectsSystem.removeInstance(instanceId);

    const pivots = this.playerCharacterSystem?.getPivots();
    if (pivots?.handRight) this._attachHeldMesh(pivots, definition);
  }

  /** `definition` is optional — omitted on the lazy, post-load attach
   *  path (see `update()`), where it's re-resolved from the remembered
   *  `definitionId`/`definitionSource` instead, since nothing else on
   *  hand still has it at that point. */
  _attachHeldMesh(pivots, definition = null) {
    const resolved = definition ?? this.worldObjectsSystem.resolveDefinition({ definitionId: this._heldDefinitionId, definitionSource: this._heldDefinitionSource });
    if (!resolved) return; // the definition itself no longer exists (deleted from the library while held) — held state stays, just nothing visible to show
    // compileDefinition() reads `definition.parts` — real for a "library"
    // or "construction" source, absent (`?? []`, an empty group) for an
    // "importedModel" one, the same honest "nothing to visibly hold" gap
    // an imported-model Player rig already leaves for foot/hand IK alike,
    // rather than a special case here for a shape this phase doesn't
    // attempt to compile standalone.
    const mesh = compileDefinition(resolved, { colorOverride: null });
    // A small, honest local offset so the held object sits roughly in
    // front of the palm rather than centred exactly on the wrist pivot's
    // own origin — not a precise hand-contact fit (a later phase's own
    // concern if this ever needs one), just enough that it doesn't read
    // as floating through the hand.
    mesh.position.set(0, -0.05, 0.05);
    pivots.handRight.add(mesh);
    this._heldMesh = mesh;
  }

  _putDown() {
    if (!this._heldDefinitionId) return;
    if (this._heldMesh) {
      this._heldMesh.parent?.remove(this._heldMesh);
      this._heldMesh = null;
    }

    const dropPosition = this._computeDropPosition();
    const instance = this.worldObjectsStore.create({
      definitionId: this._heldDefinitionId,
      definitionSource: this._heldDefinitionSource,
      position: [dropPosition.x, dropPosition.y, dropPosition.z],
    });
    this.worldObjectsSystem.spawnInstance(instance);

    this._heldDefinitionId = null;
    this._heldDefinitionSource = null;
  }

  _computeDropPosition() {
    const camera = this.cameraSystem;
    const yaw = camera?.yaw ?? 0;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-1);
    const eyeHeight = this.playerCharacterSystem?.getEyeHeight?.() ?? 1.65;
    const base = camera?.position ?? new THREE.Vector3();
    return new THREE.Vector3(base.x, base.y - eyeHeight, base.z).addScaledVector(forward, DROP_DISTANCE);
  }

  _startReach(position) {
    this._reachElapsed = 0;
    this._reachTargetWorld = position instanceof THREE.Vector3 ? position : new THREE.Vector3(position.x, position.y, position.z);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  // A held item is genuinely "in hand," not "in the world" — WorldObjectsStore
  // already stops tracking it the moment it's picked up (see _pickUp()), so
  // this is the only place a save actually remembers it exists at all.
  save() {
    return { definitionId: this._heldDefinitionId, definitionSource: this._heldDefinitionSource };
  }

  /** Only remembers *what's* held — attaching the actual mesh has to wait
   *  for a real rig to exist, which this runs well before (see `load()`'s
   *  own general contract in `PersistenceSystem.js`); `update()`'s own
   *  lazy-attach above is what finishes the job the first real frame a
   *  rig is available. */
  load(data) {
    this._heldDefinitionId = data?.definitionId ?? null;
    this._heldDefinitionSource = data?.definitionSource ?? null;
  }
}
