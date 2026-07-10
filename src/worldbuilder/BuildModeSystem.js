import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { RoomLayoutSystem } from "../systems/RoomLayoutSystem.js";
import { WorldEnvironmentSystem } from "../systems/WorldEnvironmentSystem.js";
import { FurnitureSystem } from "../systems/FurnitureSystem.js";
import { WorldObjectsSystem } from "./WorldObjectsSystem.js";
import { CURRENT_ROOM_ID } from "./WorldObjectsStore.js";
import { CONSTRUCTION_PIECES, getConstructionPiece } from "./ConstructionLibrary.js";
import { compileDefinition } from "./ObjectCompiler.js";
import { BuilderPhoneUI } from "./BuilderPhoneUI.js";
import { makeTransparent, restoreMaterials, disposeGhostMaterials, defaultGhostPoint } from "./GhostPreview.js";

const ROTATE_STEP = Math.PI / 4; // 45° per press — coarse enough to feel deliberate, fine enough to square something up

/**
 * BuildModeSystem
 * -----------------
 * "I'll just move that chair" rather than "I'll open the editor" — Build
 * Mode is a Workshop *device* (the Builder Phone, see BuilderPhoneUI.js),
 * not a separate application taking over the screen. The 3D room never
 * stops rendering; only the camera *freezes in place*
 * (`CameraSystem.lock()`, the same generic capability the computer and
 * workbench already use) so clicking/dragging on screen means something
 * precise and stable.
 *
 * **One placement mechanic, used identically for three things**: placing
 * a brand new object from the library, moving an existing Builder object,
 * and moving a piece of Workshop furniture. All three produce the exact
 * same transparent "ghost" (see GhostPreview.js) that follows the pointer
 * and can be rotated before being confirmed — "avoid creating two
 * separate editing systems" is implemented literally: `_beginGhost()`-style
 * entry points are the only places any of the three ever start from, and
 * `_confirmGhost()`/`_cancelGhost()` are the only places any of them ever
 * end.
 *
 * Furniture and Builder-created ("world") objects are still genuinely
 * different underneath — furniture lives in `FurnitureSystem`'s
 * `overrides` map (see its own comment), world objects live in
 * `WorldObjectsStore` — but `_ghost.kind` is the only place that
 * difference is ever visible; everything else (raycasting, rotating,
 * the transparent material treatment, the Phone's own buttons) is
 * completely unaware which kind it's looking at.
 *
 * Selecting an existing instance is a real raycast into the actual scene
 * the player is looking at, using the exact geometry `WorldObjectsSystem`/
 * `FurnitureSystem` already have live — there's no separate "edit
 * representation" of the world to keep in sync with the real one.
 *
 * Build Mode also works identically indoors and outdoors: placement
 * raycasts against the interior floor *and* the outdoor ground plane (see
 * `_gatherSurfaces`), and nothing here assumes there is only one room —
 * see docs/WORLD.md.
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

    /** { kind: "furniture"|"worldObject", id } | null — a *confirmed*, non-editing selection */
    this.selection = null;

    /**
     * The one piece of live placement/movement state. Shape:
     *   {
     *     kind: "new" | "moveWorldObject" | "moveFurniture",
     *     object3D,               // the thing actually being repositioned
     *     definition,             // for hint text / the Phone's title
     *     source,                 // "library" | "construction" (kind === "new" only)
     *     rotationY,
     *     materialSwap,           // Map from GhostPreview.makeTransparent, for "move" kinds
     *     originalTransform,      // { position, rotationY }, for "move" kinds — restored on cancel
     *     sourceId,               // instanceId or furniture pieceId, for "move" kinds
     *   }
     * null when nothing is currently being placed/moved.
     */
    this._ghost = null;

    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
    this._hasPointer = false; // becomes true once a real mouse/touch position has been seen
  }

  init(engine) {
    this.engine = engine;
    this._furnitureSystem = engine.getSystem(FurnitureSystem);
    this._worldObjectsSystem = engine.getSystem(WorldObjectsSystem);
    this._cameraSystem = engine.getSystem(CameraSystem);

    this.ui = new BuilderPhoneUI(document.getElementById("buildmode-root"), {
      onArmDefinition: (id, source) => this._armDefinition(id, source),
      onRotateGhost: () => this._rotateGhost(),
      onCancelGhost: () => this._cancelGhost(),
      onStartMove: () => this._startMoveSelected(),
      onTransformChange: (patch) => this._applyDirectTransformEdit(patch),
      onColorOverrideChange: (color) => this._updateSelectedColor(color),
      onDuplicate: () => this._duplicateSelected(),
      onDelete: () => this._deleteSelected(),
      onResetFurniturePosition: () => this._resetSelectedFurniture(),
      onDeselect: () => this._select(null),
    });

    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    engine.canvas.addEventListener("pointermove", this._onPointerMove);
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);

    engine.events.on("buildmode:toggleRequested", () => this.toggle());
    engine.events.on("library:changed", () => {
      if (this.active) this._renderLibrary();
    });

    engine.events.on("persistence:save", (bag) => {
      bag.buildMode = {}; // nothing session-specific worth persisting — see docs/WORLDBUILDER.md
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
    this._cameraSystem?.lock();
    this.engine.input?.exitPointerLock();
    this.ui.show();
    this._renderLibrary();
    this.ui.showLibraryScreen();
    this.engine.events.emit("buildmode:entered");
  }

  exit() {
    if (!this.active) return;
    this._cancelGhost();
    this._select(null);
    this.active = false;
    this._cameraSystem?.unlock();
    this.engine.input?.requestPointerLock();
    this.ui.hide();
    this.engine.events.emit("buildmode:exited");
  }

  _renderLibrary() {
    this.ui.renderLibrary(CONSTRUCTION_PIECES, this.objectLibraryStore.all());
  }

  _resolveDefinition(definitionId, source) {
    if (source === "construction") return getConstructionPiece(definitionId);
    return this.objectLibraryStore.get(definitionId);
  }

  // -----------------------------------------------------------------
  // Beginning a ghost — the only three entry points
  // -----------------------------------------------------------------

  _armDefinition(definitionId, source) {
    if (this._ghost) return; // already busy placing/moving something
    const definition = this._resolveDefinition(definitionId, source);
    if (!definition) return;

    const object3D = compileDefinition(definition);
    const point = this._raycastGhostSurfaces() ?? defaultGhostPoint(this.engine.camera);
    object3D.position.copy(point);
    this.engine.scene.add(object3D);

    this._ghost = {
      kind: "new",
      object3D,
      definition,
      source,
      rotationY: definition.defaultRotationY ?? 0,
      materialSwap: makeTransparent(object3D),
    };
    object3D.rotation.y = this._ghost.rotationY;

    this._select(null);
    this.ui.showGhostScreen(definition, "Place");
  }

  _startMoveSelected() {
    if (!this.selection || this._ghost) return;
    if (this.selection.kind === "worldObject") {
      const instance = this.worldObjectsStore.get(this.selection.id);
      const entity = this._worldObjectsSystem?.getLiveEntity(this.selection.id);
      if (!instance || !entity?.object3D) return;
      this._ghost = {
        kind: "moveWorldObject",
        object3D: entity.object3D,
        definition: this._resolveWorldObjectDefinition(instance),
        rotationY: instance.rotationY,
        sourceId: instance.id,
        originalTransform: { position: [...instance.position], rotationY: instance.rotationY },
        materialSwap: makeTransparent(entity.object3D),
      };
    } else {
      const piece = this._furnitureSystem?.getPiece(this.selection.id);
      if (!piece) return;
      const obj = piece.entity.object3D;
      this._ghost = {
        kind: "moveFurniture",
        object3D: obj,
        definition: piece.definition,
        rotationY: obj.rotation.y,
        sourceId: this.selection.id,
        originalTransform: { position: [obj.position.x, obj.position.y, obj.position.z], rotationY: obj.rotation.y },
        materialSwap: makeTransparent(obj),
      };
    }
    this.ui.showGhostScreen(this._ghost.definition, "Move here");
  }

  _resolveWorldObjectDefinition(instance) {
    if (instance.definitionSource === "construction") return getConstructionPiece(instance.definitionId);
    return this.objectLibraryStore.get(instance.definitionId);
  }

  // -----------------------------------------------------------------
  // While a ghost is active
  // -----------------------------------------------------------------

  _rotateGhost() {
    if (!this._ghost) return;
    this._ghost.rotationY += ROTATE_STEP;
    this._ghost.object3D.rotation.y = this._ghost.rotationY;
  }

  _confirmGhost() {
    const ghost = this._ghost;
    if (!ghost) return;

    if (ghost.kind === "new") {
      const position = ghost.object3D.position;
      disposeGhostMaterials(ghost.object3D); // never touches geometry — see GhostPreview.js
      this.engine.scene.remove(ghost.object3D);

      const instance = this.worldObjectsStore.create({
        definitionId: ghost.definition.id,
        definitionSource: ghost.source,
        roomId: CURRENT_ROOM_ID,
        position: [position.x, position.y, position.z],
        rotationY: ghost.rotationY,
        scale: ghost.definition.defaultScale ?? 1,
      });
      this._worldObjectsSystem?.spawnInstance(instance);
      this.engine.events.emit("persistence:saveRequested");
      this._ghost = null;
      this._select({ kind: "worldObject", id: instance.id });
      return;
    }

    restoreMaterials(ghost.materialSwap);
    const position = ghost.object3D.position;
    if (ghost.kind === "moveWorldObject") {
      this._worldObjectsSystem?.updateInstanceTransform(ghost.sourceId, {
        position: [position.x, position.y, position.z],
        rotationY: ghost.rotationY,
      });
      this._select({ kind: "worldObject", id: ghost.sourceId });
    } else {
      this._furnitureSystem?.setOverride(ghost.sourceId, [position.x, position.y, position.z], ghost.rotationY);
      this._select({ kind: "furniture", id: ghost.sourceId });
    }
    this.engine.events.emit("persistence:saveRequested");
    this._ghost = null;
  }

  _cancelGhost() {
    const ghost = this._ghost;
    if (!ghost) return;

    if (ghost.kind === "new") {
      disposeGhostMaterials(ghost.object3D); // never touches geometry
      this.engine.scene.remove(ghost.object3D);
      this._ghost = null;
      this.ui.showLibraryScreen();
      return;
    }

    restoreMaterials(ghost.materialSwap);
    ghost.object3D.position.set(...ghost.originalTransform.position);
    ghost.object3D.rotation.y = ghost.originalTransform.rotationY;
    this._ghost = null;
    if (ghost.kind === "moveWorldObject") this._select({ kind: "worldObject", id: ghost.sourceId });
    else this._select({ kind: "furniture", id: ghost.sourceId });
  }

  // -----------------------------------------------------------------
  // Pointer handling — hover (mouse) or drag (touch) repositions the
  // active ghost; a plain click/tap with no ghost active selects/deselects.
  // -----------------------------------------------------------------

  _updatePointerNDC(event) {
    const rect = this.engine.canvas.getBoundingClientRect();
    this._pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._hasPointer = true;
  }

  _handlePointerMove(event) {
    if (!this.active || !this._ghost) return;
    this._updatePointerNDC(event);
    const point = this._raycastGhostSurfaces();
    if (point) this._ghost.object3D.position.copy(point);
  }

  _handlePointerDown(event) {
    if (!this.active) return;
    this._updatePointerNDC(event);
    if (this._ghost) {
      // "Left-clicking in the world should place the currently previewed
      // object" — the ghost's own position is already current, from the
      // most recent pointermove, so confirming here needs no further
      // raycast first. Gated to the left button specifically (button 0 —
      // also what a touch tap reports), so a right-click or middle-click
      // doesn't accidentally confirm a placement mid-adjustment.
      if (event.button === 0) this._confirmGhost();
      return;
    }

    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    const targets = [...(this._worldObjectsSystem?.getAllLiveObjects() ?? []), ...this._furnitureObjects()];
    const hit = this._raycastFirst(targets);
    this._select(hit ? this._identifyHit(hit.object) : null);
  }

  /** Floor/ground + every already-placed object (world objects and
   *  furniture both) — a ghost can rest on top of something else exactly
   *  as naturally as on the floor. Excludes the ghost's own object when
   *  moving something that already exists, so it never collides with
   *  itself while dragging. */
  _gatherSurfaces() {
    const floorMesh = this.engine.getSystem(RoomLayoutSystem)?.getFloorMesh();
    const groundMesh = this.engine.getSystem(WorldEnvironmentSystem)?.getGroundMesh();
    const surfaces = [floorMesh, groundMesh].filter(Boolean);
    const objects = [...(this._worldObjectsSystem?.getAllLiveObjects() ?? []), ...this._furnitureObjects()];
    const excluding = this._ghost?.object3D;
    return [...surfaces, ...objects].filter((o) => o !== excluding);
  }

  _furnitureObjects() {
    return (this._furnitureSystem?.getAllPieces() ?? []).map((p) => p.entity.object3D);
  }

  _raycastGhostSurfaces() {
    if (!this._hasPointer) return null;
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    const hit = this._raycastFirst(this._gatherSurfaces());
    return hit ? hit.point : null;
  }

  _raycastFirst(objects) {
    if (!objects.length) return null;
    const hits = this._raycaster.intersectObjects(objects, true);
    return hits[0] ?? null;
  }

  /** Walks up from whatever child mesh was actually hit to find the owning
   *  entity (via MeshComponent's `object3D.userData.entityId` bridge) and
   *  identifies it as either a world object or a furniture piece — the one
   *  place that distinction is made, everywhere else just handles
   *  `{kind, id}` generically. */
  _identifyHit(object3D) {
    let node = object3D;
    while (node) {
      if (node.userData?.entityId != null) {
        const entity = this.engine.entities.getById(node.userData.entityId);
        if (!entity) return null;
        if (entity.hasTag("worldObject") && entity.userData?.instanceId != null) {
          return { kind: "worldObject", id: entity.userData.instanceId };
        }
        if (entity.hasTag("furniture")) {
          return { kind: "furniture", id: entity.name };
        }
        return null;
      }
      node = node.parent;
    }
    return null;
  }

  // -----------------------------------------------------------------
  // Selection (confirmed, not currently moving)
  // -----------------------------------------------------------------

  _select(selection) {
    this.selection = selection;
    if (!selection) {
      this.ui.showLibraryScreen();
      return;
    }
    if (selection.kind === "worldObject") {
      const instance = this.worldObjectsStore.get(selection.id);
      const definition = instance ? this._resolveWorldObjectDefinition(instance) : null;
      if (!instance || !definition) {
        this.selection = null;
        this.ui.showLibraryScreen();
        return;
      }
      this.ui.showSelectionScreen({ kind: "worldObject", instance, definition });
    } else {
      const piece = this._furnitureSystem?.getPiece(selection.id);
      if (!piece) {
        this.selection = null;
        this.ui.showLibraryScreen();
        return;
      }
      const obj = piece.entity.object3D;
      const hasOverride = selection.id in (this._furnitureSystem?.overrides ?? {});
      this.ui.showSelectionScreen({
        kind: "furniture",
        definition: piece.definition,
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotationY: obj.rotation.y,
        hasOverride,
      });
    }
  }

  _applyDirectTransformEdit(patch) {
    if (!this.selection) return;
    if (this.selection.kind === "worldObject") {
      this._worldObjectsSystem?.updateInstanceTransform(this.selection.id, patch);
      this._select(this.selection); // refresh the panel's own displayed values
    } else {
      const piece = this._furnitureSystem?.getPiece(this.selection.id);
      if (!piece) return;
      const obj = piece.entity.object3D;
      const position = patch.position ?? [obj.position.x, obj.position.y, obj.position.z];
      const rotationY = patch.rotationY ?? obj.rotation.y;
      this._furnitureSystem.setOverride(this.selection.id, position, rotationY);
      this._select(this.selection);
    }
  }

  _updateSelectedColor(color) {
    if (this.selection?.kind !== "worldObject") return; // furniture has no colour-override concept
    // Deliberately doesn't re-render the panel afterwards: nothing else it
    // shows depends on colour, and rebuilding the DOM on every drag event
    // from a native <input type="color"> would repeatedly tear out and
    // recreate that same input mid-drag.
    this._worldObjectsSystem?.updateInstanceColorOverride(this.selection.id, color);
  }

  _duplicateSelected() {
    if (this.selection?.kind !== "worldObject") return; // there's only ever one of each furniture piece
    const instance = this.worldObjectsStore.get(this.selection.id);
    if (!instance) return;
    const copy = this.worldObjectsStore.create({
      ...instance,
      position: [instance.position[0] + 0.3, instance.position[1], instance.position[2] + 0.3],
    });
    this._worldObjectsSystem?.spawnInstance(copy);
    this.engine.events.emit("persistence:saveRequested");
    this._select({ kind: "worldObject", id: copy.id });
  }

  _deleteSelected() {
    if (this.selection?.kind !== "worldObject") return; // furniture can be moved, never deleted
    this._worldObjectsSystem?.removeInstance(this.selection.id);
    this.engine.events.emit("persistence:saveRequested");
    this._select(null);
  }

  _resetSelectedFurniture() {
    if (this.selection?.kind !== "furniture") return;
    this._furnitureSystem?.clearOverride(this.selection.id);
    this._select(this.selection);
  }

  update(_dt) {
    if (this.engine.input?.wasJustPressed("buildMode")) {
      this.toggle();
      return;
    }
    if (!this.active) return;
    if (this.engine.input?.wasJustPressed("cancel")) {
      if (this._ghost) this._cancelGhost();
      else if (this.selection) this._select(null);
      else this.exit();
    }
  }

  dispose() {
    this.engine.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.engine.canvas.removeEventListener("pointerdown", this._onPointerDown);
  }
}
