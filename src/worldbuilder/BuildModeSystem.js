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
const WHEEL_ROTATE_STEP = Math.PI / 36; // 5° per tick — fine, continuous control matching common 3D editing workflows, not the button's own coarse step
const GRID_SNAP_SIZE = 0.5; // metres — fine enough for ordinary furniture spacing, coarse enough to actually feel like a grid
const ROTATION_SNAP_STEP = Math.PI / 4; // 45° increments — matches ROTATE_STEP, so "snap rotation" and "the rotate button" always agree

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
  constructor({ objectLibraryStore, worldObjectsStore, modelLibrary, modelLoader, blueprintStore }) {
    this.objectLibraryStore = objectLibraryStore;
    this.worldObjectsStore = worldObjectsStore;
    this.modelLibrary = modelLibrary;
    this.modelLoader = modelLoader;
    this.blueprintStore = blueprintStore;
    this.active = false;
    // "Please investigate introducing optional snapping systems... snapping
    // should remain optional." Both default off — building without any
    // restriction is the default Workshop feel; a player who wants either
    // kind of precision turns it on deliberately.
    this.snapToGrid = false;
    this.snapRotation = false;

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

    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onWheel = (e) => this._handleWheel(e);
    engine.canvas.addEventListener("pointermove", this._onPointerMove);
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);
    engine.canvas.addEventListener("wheel", this._onWheel, { passive: false });

    engine.events.on("library:changed", () => {
      if (this.active) this._renderLibrary();
    });

    engine.events.on("persistence:save", (bag) => {
      bag.buildMode = {}; // nothing session-specific worth persisting — see docs/WORLDBUILDER.md
    });
  }

  /** Called by BuilderPhoneApp.js's own mount() — deliberately no longer
   *  touches the mouse, the camera, or any phone shell of its own; all
   *  of that is `PhoneSystem.js`'s job now, uniformly, for every app.
   *  "Continue allowing world building while walking naturally through
   *  the environment" is true by construction once this system stops
   *  freezing movement itself — `PhoneSystem`'s own `pauseLook()` (not
   *  `lock()`) already leaves walk/run/jump/crouch untouched. */
  /** Called by BuilderPhoneApp.js's own mount() — creates a fresh UI
   *  targeting whichever container the Phone currently hands it (its own
   *  content area gets cleared between every app switch, so this can't
   *  be a one-time, `init()`-time construction the way it used to be
   *  against a permanent `#buildmode-root` element). */
  mountUI(container) {
    this.ui = new BuilderPhoneUI(container, {
      onArmDefinition: (id, source) => this._armDefinition(id, source),
      onRotateGhost: () => this._rotateGhost(),
      onCancelGhost: () => this._cancelGhost(),
      onStartMove: () => this._startMoveSelected(),
      onTransformChange: (patch) => this._applyDirectTransformEdit(patch),
      onColorOverrideChange: (color) => this._updateSelectedColor(color),
      onDuplicate: () => this._duplicateSelected(),
      onSaveAsBlueprint: () => this._promptSaveAsBlueprint(),
      getSnapToGrid: () => this.snapToGrid,
      getSnapRotation: () => this.snapRotation,
      onToggleSnapToGrid: () => this.toggleSnapToGrid(),
      onToggleSnapRotation: () => this.toggleSnapRotation(),
      onDelete: () => this._deleteSelected(),
      onResetFurniturePosition: () => this._resetSelectedFurniture(),
      onDeselect: () => this._select(null),
    });
    this.enter();
  }

  /** Called by BuilderPhoneApp.js's own unmount (the disposer its mount()
   *  returns) — the reverse of mountUI(). */
  unmountUI() {
    this.exit();
    this.ui = null;
  }

  /** Called by BuilderPhoneApp.js's own onCancel() — true if there was
   *  something to cancel/deselect (in which case PhoneSystem.js should
   *  *not* also go home in the same keystroke), false if there was
   *  nothing left, in which case the phone's own back gesture is what
   *  should happen instead. */
  handleCancelKey() {
    if (this._ghost) {
      this._cancelGhost();
      return true;
    }
    if (this.selection) {
      this._select(null);
      return true;
    }
    return false;
  }

  /** Called by mountUI() — deliberately no longer touches the mouse, the
   *  camera, or any phone shell of its own; all of that is
   *  `PhoneSystem.js`'s job now, uniformly, for every app. "Continue
   *  allowing world building while walking naturally through the
   *  environment" is true by construction once this system stops
   *  freezing movement itself — `PhoneSystem`'s own `pauseLook()` (not
   *  `lock()`) already leaves walk/run/jump/crouch untouched. */
  enter() {
    if (this.active) return;
    this.active = true;
    this._renderLibrary();
    this.ui.showLibraryScreen();
    this.engine.events.emit("buildmode:entered");
  }

  exit() {
    if (!this.active) return;
    this._cancelGhost();
    this._select(null);
    this.active = false;
    this.engine.events.emit("buildmode:exited");
  }

  _renderLibrary() {
    this.ui.renderLibrary(CONSTRUCTION_PIECES, this.objectLibraryStore.all(), this.modelLibrary?.all() ?? [], this.blueprintStore?.all() ?? []);
  }

  _resolveDefinition(definitionId, source) {
    if (source === "construction") return getConstructionPiece(definitionId);
    if (source === "importedModel") return this.modelLibrary?.get(definitionId) ?? null;
    if (source === "blueprint") return this.blueprintStore?.get(definitionId) ?? null;
    return this.objectLibraryStore.get(definitionId);
  }

  // -----------------------------------------------------------------
  // Beginning a ghost — the only four entry points
  // -----------------------------------------------------------------

  _armDefinition(definitionId, source) {
    if (this._ghost) return; // already busy placing/moving something
    const definition = this._resolveDefinition(definitionId, source);
    if (!definition) return;

    if (source === "blueprint") {
      this._armBlueprint(definition);
      return;
    }

    // "The Builder should treat imported models similarly to any other
    // available shape." ObjectCompiler.compileDefinition() builds
    // geometry synchronously; loading a model is inherently async — the
    // same "show a placeholder immediately, swap in the real thing once
    // it resolves" pattern BeingController.js already uses for exactly
    // this reason, rather than making the whole ghost-placement pipeline
    // async for this one source.
    const object3D = source === "importedModel" ? this.modelLoader?.buildPlaceholder() ?? compileDefinition({ parts: [] }) : compileDefinition(definition);
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

    if (source === "importedModel" && this.modelLoader) {
      this.modelLoader.load(definitionId).then((model) => {
        if (!model || this._ghost?.object3D !== object3D) return; // cancelled/confirmed/superseded before this resolved
        const { position, rotation } = object3D;
        this.engine.scene.remove(object3D);
        model.position.copy(position);
        model.rotation.copy(rotation);
        this.engine.scene.add(model);
        this._ghost.object3D = model;
        this._ghost.materialSwap = makeTransparent(model);
      });
    }

    this._select(null);
    this.ui.showGhostScreen(definition, "Place");
  }

  /** Builds one group ghost containing every one of the blueprint's own
   *  child objects, each positioned at its own saved relative offset —
   *  the whole cluster moves and rotates together during placement,
   *  exactly like a single object's own ghost, even though it's really
   *  several. Each child's own real geometry (via `compileDefinition()`
   *  or `ModelLoader`, whichever its own `definitionSource` calls for)
   *  is used directly, not a placeholder — a blueprint's own preview
   *  should look like what it actually is. */
  _armBlueprint(blueprint) {
    const group = new THREE.Group();
    const childMeshes = [];
    for (const obj of blueprint.objects) {
      const childDefinition = this._resolveDefinition(obj.definitionId, obj.definitionSource);
      if (!childDefinition) continue;
      const mesh = obj.definitionSource === "importedModel" ? this.modelLoader?.buildPlaceholder() ?? compileDefinition({ parts: [] }) : compileDefinition(childDefinition, { colorOverride: obj.colorOverride });
      mesh.position.set(...obj.offset);
      mesh.rotation.y = obj.rotationY ?? 0;
      mesh.scale.setScalar(obj.scale ?? 1);
      group.add(mesh);
      childMeshes.push({ mesh, obj });
      if (obj.definitionSource === "importedModel" && this.modelLoader) {
        this.modelLoader.load(obj.definitionId).then((model) => {
          if (!model || !group.children.includes(mesh)) return;
          model.position.copy(mesh.position);
          model.rotation.copy(mesh.rotation);
          model.scale.copy(mesh.scale);
          group.remove(mesh);
          group.add(model);
        });
      }
    }

    const point = this._raycastGhostSurfaces() ?? defaultGhostPoint(this.engine.camera);
    group.position.copy(point);
    this.engine.scene.add(group);

    this._ghost = {
      kind: "new",
      object3D: group,
      definition: blueprint,
      source: "blueprint",
      rotationY: 0,
      materialSwap: makeTransparent(group),
    };

    this._select(null);
    this.ui.showGhostScreen(blueprint, "Place");
  }

  /** "Save as Blueprint" — captures the currently selected World Object
   *  plus every other one within `radius` of it, storing each one's own
   *  position/rotation/scale as an offset relative to the selected
   *  object's own position. See BlueprintStore.js's own comment on why
   *  this radius-based capture, rather than a full multi-select
   *  interface, is this phase's own deliberate scope. */
  captureBlueprintNearSelection(name, radius = 3) {
    if (!this.blueprintStore || this.selection?.kind !== "worldObject") return null;
    const center = this.worldObjectsStore.get(this.selection.id);
    if (!center) return null;
    const [cx, cy, cz] = center.position;

    const objects = [];
    for (const instance of this.worldObjectsStore.all()) {
      const [x, y, z] = instance.position;
      const dist = Math.hypot(x - cx, y - cy, z - cz);
      if (dist > radius) continue;
      objects.push({
        definitionId: instance.definitionId,
        definitionSource: instance.definitionSource,
        offset: [x - cx, y - cy, z - cz],
        rotationY: instance.rotationY,
        scale: instance.scale,
        colorOverride: instance.colorOverride,
      });
    }
    if (objects.length === 0) return null;
    return this.blueprintStore.create(name, objects);
  }

  _promptSaveAsBlueprint() {
    const name = window.prompt("Name this Blueprint (captures everything placed within 3m):", "New Blueprint");
    if (!name) return;
    const blueprint = this.captureBlueprintNearSelection(name);
    if (!blueprint) window.alert("Nothing nearby to capture — select a placed object first.");
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

  toggleSnapToGrid() {
    this.snapToGrid = !this.snapToGrid;
  }

  toggleSnapRotation() {
    this.snapRotation = !this.snapRotation;
  }

  _rotateGhost() {
    if (!this._ghost) return;
    this._ghost.rotationY += ROTATE_STEP;
    this._applyGhostRotation();
  }

  /** "Please also expand rotation controls to allow for rotation on
   *  multiple axis." Plain wheel still turns Y (yaw), matching the
   *  original single-axis control exactly; Shift+wheel tilts around X,
   *  Ctrl+wheel tilts around Z — modifier keys rather than new UI, so a
   *  player who never needs anything but yaw sees no change at all.
   *  `rotationX`/`rotationZ` default to 0 on every ghost and are only
   *  ever set here — placing/moving an ordinary object never touches
   *  them, so nothing needs to change for the common, Y-only case. */
  _handleWheel(event) {
    if (!this._ghost) return;
    event.preventDefault();
    const step = Math.sign(event.deltaY) * WHEEL_ROTATE_STEP;
    if (event.shiftKey) {
      this._ghost.rotationX = (this._ghost.rotationX ?? 0) + step;
      this._ghost.object3D.rotation.x = this._ghost.rotationX;
    } else if (event.ctrlKey || event.metaKey) {
      this._ghost.rotationZ = (this._ghost.rotationZ ?? 0) + step;
      this._ghost.object3D.rotation.z = this._ghost.rotationZ;
    } else {
      this._ghost.rotationY += step;
      this._applyGhostRotation();
    }
  }

  /** Snaps to the nearest `ROTATION_SNAP_STEP` increment when enabled,
   *  shared by both the button and the wheel so they never disagree
   *  about what "snapped" means. Updates `ghost.rotationY` itself, not
   *  just the visual `object3D.rotation.y` — `_confirmGhost()` persists
   *  from `rotationY`, so snapping only the display would silently not
   *  actually snap what gets placed. */
  _applyGhostRotation() {
    if (this.snapRotation) this._ghost.rotationY = Math.round(this._ghost.rotationY / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP;
    this._ghost.object3D.rotation.y = this._ghost.rotationY;
  }

  _confirmGhost() {
    const ghost = this._ghost;
    if (!ghost) return;

    if (ghost.kind === "new") {
      const position = ghost.object3D.position;
      disposeGhostMaterials(ghost.object3D); // never touches geometry — see GhostPreview.js
      this.engine.scene.remove(ghost.object3D);

      if (ghost.source === "blueprint") {
        // Each child becomes its own, fully independent World Object —
        // "players should still be able to modify them after placement"
        // is true by construction, since nothing about this creates a
        // combined or grouped instance, just several ordinary ones at
        // once. Each one's own captured offset is rotated by however the
        // whole cluster was rotated while it was being placed, then
        // added to the final placement point.
        const cos = Math.cos(ghost.rotationY);
        const sin = Math.sin(ghost.rotationY);
        let lastInstance = null;
        for (const obj of ghost.definition.objects) {
          const [ox, oy, oz] = obj.offset;
          const rotatedX = ox * cos + oz * sin;
          const rotatedZ = -ox * sin + oz * cos;
          const instance = this.worldObjectsStore.create({
            definitionId: obj.definitionId,
            definitionSource: obj.definitionSource,
            roomId: CURRENT_ROOM_ID,
            position: [position.x + rotatedX, position.y + oy, position.z + rotatedZ],
            rotationY: (obj.rotationY ?? 0) + ghost.rotationY,
            scale: obj.scale ?? 1,
            colorOverride: obj.colorOverride ?? null,
          });
          this._worldObjectsSystem?.spawnInstance(instance);
          lastInstance = instance;
        }
        this.engine.events.emit("persistence:saveRequested");
        this._ghost = null;
        if (lastInstance) this._select({ kind: "worldObject", id: lastInstance.id });
        return;
      }

      const instance = this.worldObjectsStore.create({
        definitionId: ghost.definition.id,
        definitionSource: ghost.source,
        roomId: CURRENT_ROOM_ID,
        position: [position.x, position.y, position.z],
        rotationY: ghost.rotationY,
        rotationX: ghost.rotationX ?? 0,
        rotationZ: ghost.rotationZ ?? 0,
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
    if (point) {
      if (this.snapToGrid) {
        point.x = Math.round(point.x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
        point.z = Math.round(point.z / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
      }
      this._ghost.object3D.position.copy(point);
    }
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
    if (!this.active) return;
    if (this.engine.input?.wasJustPressed("cancel")) {
      if (this._ghost) this._cancelGhost();
      else if (this.selection) this._select(null);
      // Deliberately no "else exit()" branch — with nothing left to
      // cancel/deselect, this same Escape press is handled by
      // PhoneSystem.js's own onCancel()/goHome() instead (see
      // BuilderPhoneApp.js's own onCancel hook), not duplicated here.
      // Both reacting to the identical key press would either cancel a
      // ghost *and* leave the app in the same stroke, or leave the app
      // when the player only meant to back out of a ghost.
    }
  }

  dispose() {
    this.engine.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.engine.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.engine.canvas.removeEventListener("wheel", this._onWheel);
  }
}
