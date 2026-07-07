import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { RoomLayoutSystem } from "../systems/RoomLayoutSystem.js";
import { WorldEnvironmentSystem } from "../systems/WorldEnvironmentSystem.js";
import { WorldObjectsSystem } from "./WorldObjectsSystem.js";
import { CURRENT_ROOM_ID } from "./WorldObjectsStore.js";
import { CONSTRUCTION_PIECES, getConstructionPiece } from "./ConstructionLibrary.js";
import { BuildModePanels } from "./BuildModePanels.js";

/**
 * BuildModeSystem
 * -----------------
 * "I should feel like I am physically rearranging my workshop" — not
 * opening a separate editor. Concretely, that meant three decisions:
 *
 *   1. The 3D room never stops rendering or changes camera mode while
 *      Build Mode is active — only the camera *freezes in place*
 *      (`CameraSystem.lock()`, the same generic capability the computer
 *      and workbench already use) so you can click into the exact view
 *      you were already standing in.
 *   2. The UI is two small HUD-docked strips (a library browser, a
 *      property panel for whatever's selected) — never a full-screen
 *      takeover. See BuildModePanels.js.
 *   3. Placing/selecting objects is a real raycast into the actual scene
 *      the player is looking at, using the exact geometry
 *      `WorldObjectsSystem` already spawned — there's no separate "edit
 *      representation" of the world to keep in sync with the real one.
 *
 * The library strip shows two sources side by side — the permanent
 * `ConstructionLibrary` ("the alphabet") and the person's own
 * `ObjectLibraryStore` ("the language") — see `armedSource` below and
 * ConstructionLibrary.js's own comment for why they're kept structurally
 * separate rather than merged into one list.
 *
 * Build Mode also works identically indoors and outdoors: placement
 * raycasts against the interior floor *and* the outdoor ground plane (see
 * `_placeArmedDefinition`), and nothing here assumes there is only one
 * room — see docs/WORLD.md.
 *
 * Build Mode is mutually exclusive with the normal interaction pipeline:
 * entering refuses if `InteractionSystem.active` (you're sitting at the
 * computer, say); entering also tells `InteractionSystem` to suspend its
 * own proximity scan for as long as Build Mode is open, purely over events
 * (`buildmode:entered`/`buildmode:exited`) — see InteractionSystem's own
 * `_suspended` flag. Neither system imports the other's internals beyond
 * that.
 */
export class BuildModeSystem {
  constructor({ objectLibraryStore, worldObjectsStore }) {
    this.objectLibraryStore = objectLibraryStore;
    this.worldObjectsStore = worldObjectsStore;
    this.active = false;
    this.armedDefinitionId = null;
    this.armedSource = null; // "library" | "construction"
    this.selectedInstanceId = null;
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
  }

  init(engine) {
    this.engine = engine;
    this.panels = new BuildModePanels(document.getElementById("buildmode-root"), {
      onArmDefinition: (id, source) => this.armDefinition(id, source),
      onTransformChange: (patch) => this._updateSelectedTransform(patch),
      onColorOverrideChange: (color) => this._updateSelectedColor(color),
      onDuplicate: () => this._duplicateSelected(),
      onDelete: () => this._deleteSelected(),
    });

    this._onCanvasClick = (event) => this._handleClick(event);
    engine.canvas.addEventListener("click", this._onCanvasClick);

    engine.events.on("buildmode:toggleRequested", () => this.toggle());
    engine.events.on("library:changed", () => {
      if (this.active) this._renderLibrary();
    });

    engine.events.on("persistence:save", (bag) => {
      bag.buildMode = {}; // nothing session-specific worth persisting yet — see docs/WORLD.md
    });
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  enter() {
    if (this.active) return;
    const interactionSystem = this.engine.getSystem(InteractionSystem);
    if (interactionSystem?.active) return; // can't build while sitting at the computer, etc.

    this.active = true;
    this.engine.getSystem(CameraSystem)?.lock();
    this.engine.input?.exitPointerLock();
    this.panels.show();
    this._renderLibrary();
    this._setHintForCurrentState();
    this.engine.events.emit("buildmode:entered");
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.armedDefinitionId = null;
    this.armedSource = null;
    this.selectedInstanceId = null;
    this.engine.getSystem(CameraSystem)?.unlock();
    this.engine.input?.requestPointerLock();
    this.panels.hide();
    this.engine.events.emit("buildmode:exited");
  }

  armDefinition(definitionId, source) {
    const alreadyArmed = this.armedDefinitionId === definitionId && this.armedSource === source;
    this.armedDefinitionId = alreadyArmed ? null : definitionId;
    this.armedSource = alreadyArmed ? null : source;
    this.selectedInstanceId = null;
    this._renderLibrary();
    this.panels.renderSelection(null, null);
    this._setHintForCurrentState();
  }

  _renderLibrary() {
    this.panels.renderLibrary(CONSTRUCTION_PIECES, this.objectLibraryStore.all(), this.armedDefinitionId, this.armedSource);
  }

  _resolveDefinition(definitionId, source) {
    if (source === "construction") return getConstructionPiece(definitionId);
    return this.objectLibraryStore.get(definitionId);
  }

  _setHintForCurrentState() {
    if (this.armedDefinitionId) {
      const def = this._resolveDefinition(this.armedDefinitionId, this.armedSource);
      this.panels.setHint(`Click anywhere — indoors or outside — to place "${def?.name ?? "object"}". Click its chip again to cancel.`);
    } else if (this.selectedInstanceId) {
      this.panels.setHint("Adjust the selected object below, or click elsewhere to deselect.");
    } else {
      this.panels.setHint("Click an object to select it, or pick something from the library below to place it. Esc to stand back up.");
    }
  }

  _handleClick(event) {
    if (!this.active) return;
    const rect = this.engine.canvas.getBoundingClientRect();
    this._pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);

    const worldObjectsSystem = this.engine.getSystem(WorldObjectsSystem);
    const placedObjects = worldObjectsSystem?.getAllLiveObjects() ?? [];

    if (this.armedDefinitionId) {
      this._placeArmedDefinition(placedObjects);
      return;
    }

    // Selecting an existing instance takes priority over the floor/ground.
    const instanceHit = this._raycastFirst(placedObjects);
    if (instanceHit) {
      this._select(this._findInstanceIdForObject(instanceHit.object));
    } else {
      this._select(null);
    }
  }

  _placeArmedDefinition(placedObjects) {
    // Indoor floor and outdoor ground are both valid placement surfaces —
    // Build Mode has no notion of "the one room", just "whatever the
    // raycast actually hits". See docs/WORLD.md.
    const floorMesh = this.engine.getSystem(RoomLayoutSystem)?.getFloorMesh();
    const groundMesh = this.engine.getSystem(WorldEnvironmentSystem)?.getGroundMesh();
    const surfaces = [floorMesh, groundMesh].filter(Boolean);
    const targets = [...surfaces, ...placedObjects];
    const hit = this._raycastFirst(targets);
    if (!hit) return;

    const worldObjectsSystem = this.engine.getSystem(WorldObjectsSystem);
    const definition = this._resolveDefinition(this.armedDefinitionId, this.armedSource);
    if (!definition || !worldObjectsSystem) return;

    const instance = this.worldObjectsStore.create({
      definitionId: definition.id,
      definitionSource: this.armedSource,
      roomId: CURRENT_ROOM_ID,
      position: [hit.point.x, hit.point.y, hit.point.z],
      rotationY: definition.defaultRotationY ?? 0,
      scale: definition.defaultScale ?? 1,
    });
    worldObjectsSystem.spawnInstance(instance);
    this.engine.events.emit("persistence:saveRequested");

    this.armedDefinitionId = null;
    this.armedSource = null;
    this._renderLibrary();
    this._select(instance.id);
  }

  _select(instanceId) {
    this.selectedInstanceId = instanceId;
    const instance = instanceId ? this.worldObjectsStore.get(instanceId) : null;
    const definition = instance ? this._resolveDefinition(instance.definitionId, instance.definitionSource) : null;
    this.panels.renderSelection(instance, definition);
    this._setHintForCurrentState();
  }

  _updateSelectedTransform(patch) {
    if (!this.selectedInstanceId) return;
    this.engine.getSystem(WorldObjectsSystem)?.updateInstanceTransform(this.selectedInstanceId, patch);
  }

  _updateSelectedColor(color) {
    if (!this.selectedInstanceId) return;
    // Deliberately doesn't re-render the panel afterwards: nothing else it
    // shows depends on colour, and rebuilding the DOM on every drag event
    // from a native <input type="color"> would repeatedly tear out and
    // recreate that same input mid-drag.
    this.engine.getSystem(WorldObjectsSystem)?.updateInstanceColorOverride(this.selectedInstanceId, color);
  }

  _duplicateSelected() {
    if (!this.selectedInstanceId) return;
    const instance = this.worldObjectsStore.get(this.selectedInstanceId);
    if (!instance) return;
    const copy = this.worldObjectsStore.create({
      ...instance,
      position: [instance.position[0] + 0.3, instance.position[1], instance.position[2] + 0.3],
    });
    this.engine.getSystem(WorldObjectsSystem)?.spawnInstance(copy);
    this.engine.events.emit("persistence:saveRequested");
    this._select(copy.id);
  }

  _deleteSelected() {
    if (!this.selectedInstanceId) return;
    this.engine.getSystem(WorldObjectsSystem)?.removeInstance(this.selectedInstanceId);
    this.engine.events.emit("persistence:saveRequested");
    this._select(null);
  }

  _raycastFirst(objects) {
    if (!objects.length) return null;
    const hits = this._raycaster.intersectObjects(objects, true);
    return hits[0] ?? null;
  }

  /** Walks up from whatever child mesh was actually hit to find the owning
   *  entity (via MeshComponent's `object3D.userData.entityId` bridge) and
   *  returns that entity's world-object instance id, if any. */
  _findInstanceIdForObject(object3D) {
    let node = object3D;
    while (node) {
      if (node.userData?.entityId != null) {
        const entity = this.engine.entities.getById(node.userData.entityId);
        if (entity?.userData?.instanceId != null) return entity.userData.instanceId;
      }
      node = node.parent;
    }
    return null;
  }

  update(_dt) {
    if (this.engine.input?.wasJustPressed("buildMode")) {
      this.toggle();
      return;
    }
    if (!this.active) return;
    if (this.engine.input?.wasJustPressed("cancel")) {
      if (this.armedDefinitionId) {
        this.armDefinition(this.armedDefinitionId, this.armedSource); // toggles it back off
      } else if (this.selectedInstanceId) {
        this._select(null);
      } else {
        this.exit();
      }
    }
  }

  dispose() {
    this.engine.canvas.removeEventListener("click", this._onCanvasClick);
  }
}
