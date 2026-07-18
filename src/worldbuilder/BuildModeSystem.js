import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { RoomLayoutSystem } from "../systems/RoomLayoutSystem.js";
import { FurnitureSystem } from "../systems/FurnitureSystem.js";
import { WorldObjectsSystem } from "./WorldObjectsSystem.js";
import { CURRENT_ROOM_ID } from "./WorldObjectsStore.js";
import { CONSTRUCTION_PIECES, getConstructionPiece } from "./ConstructionLibrary.js";
import { compileDefinition } from "./ObjectCompiler.js";
import { BuilderPhoneUI } from "./BuilderPhoneUI.js";
import { makeTransparent, restoreMaterials, disposeGhostMaterials, defaultGhostPoint } from "./GhostPreview.js";
import { EditHistory } from "./EditHistory.js";
import { alignPositions, distributeEvenly } from "./AlignmentTools.js";
import { TERRAIN_MATERIALS } from "../systems/TerrainSystem.js";
import { importModelFile } from "../beings/ModelLibrary.js";

const ROTATE_STEP = Math.PI / 4; // 45° per press — coarse enough to feel deliberate, fine enough to square something up
const WHEEL_ROTATE_STEP = Math.PI / 36; // 5° per tick — fine, continuous control matching common 3D editing workflows, not the button's own coarse step
const GRID_SNAP_SIZE = 0.5; // metres — fine enough for ordinary furniture spacing, coarse enough to actually feel like a grid
const ROTATION_SNAP_STEP = Math.PI / 4; // 45° increments — matches ROTATE_STEP, so "snap rotation" and "the rotate button" always agree
const DRAG_SELECT_THRESHOLD_PX = 6; // a pointerdown that never moves this far is a click, not the start of a box-select drag

/** The same "timestamp + random suffix, no persisted counter to keep in
 *  sync across reloads" scheme `BlueprintStore.create()` already uses —
 *  a group id is just a value stored redundantly on every member's own
 *  `groupId` field (see this file's own "Grouping" section), not an
 *  entry in some separate registry a counter would need to stay
 *  consistent with. */
function nextGroupId() {
  return `group-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

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
 * Build Mode is mutually exclusive with the normal interaction pipeline,
 * but no longer enforces that itself: since Build Mode became a Phone app
 * (`BuilderPhoneApp.js`), both halves of the old contract moved up into
 * `PhoneSystem` — `PhoneSystem.open()` refuses while
 * `InteractionSystem.active` (you're sitting at the computer, say), and
 * `InteractionSystem` suspends its proximity scan on `phone:opened` /
 * `phone:closed`, uniformly for every app, this one included. enter()
 * and exit() below still broadcast `buildmode:entered`/`buildmode:exited`
 * — honestly: nothing in the Workshop listens for them today. They're
 * kept as a public signal (a plugin or a future system that cares
 * specifically about *building*, as opposed to the phone being out, has
 * no other way to know), not because anything currently consumes them —
 * exactly the "deliberately not built on yet" distinction the dead-code
 * audits keep drawing, made legible here so the next audit doesn't have
 * to re-derive it.
 *
 * **Builder Evolution phase: multi-selection, grouping, history, and
 * layout tools, all layered on top of the mechanics above without
 * changing them.** "The Builder should never fight the player... small
 * workflow improvements are often more valuable than large new features."
 * `this.selection` is still the ordinary single "primary" item every
 * existing method already assumed; `this.additionalSelection` is the
 * *only* new field, holding whatever else is also selected — see
 * `getSelectedItems()`. Shift-click and drag-select (a screen-space
 * rectangle, `#build-select-root` in `index.html`) both feed the same
 * mechanism. A shared, undoable `EditHistory.js` stack, real object
 * grouping (a `groupId`/`groupName` value shared across members, no
 * separate registry), alignment/distribution (`AlignmentTools.js`), and
 * transform copy/paste/reset round out the rest — see each section's own
 * comment further down this file.
 */
export class BuildModeSystem {
  constructor({ objectLibraryStore, worldObjectsStore, modelLibrary, modelLoader, modelAssetStore, blueprintStore, terrainSystem }) {
    this.objectLibraryStore = objectLibraryStore;
    this.worldObjectsStore = worldObjectsStore;
    this.modelLibrary = modelLibrary;
    this.modelLoader = modelLoader;
    this.modelAssetStore = modelAssetStore;
    this.blueprintStore = blueprintStore;
    this.terrainSystem = terrainSystem;
    this.active = false;
    // "Please investigate introducing optional snapping systems... snapping
    // should remain optional." Both default off — building without any
    // restriction is the default Workshop feel; a player who wants either
    // kind of precision turns it on deliberately.
    this.snapToGrid = false;
    this.snapRotation = false;

    /** { kind: "furniture"|"worldObject", id } | null — a *confirmed*, non-editing selection.
     *  The "primary"/anchor item — see `additionalSelection` below for the rest of a multi-selection. */
    this.selection = null;
    /** Array<{kind, id}> — every *other* currently-selected item, beyond
     *  `this.selection` itself. Empty for the ordinary single-selection
     *  case, which is why nothing about existing single-object code paths
     *  (`_applyDirectTransformEdit`, `_duplicateSelected`, `_deleteSelected`,
     *  and so on) needed to change at all — they only ever look at
     *  `this.selection`. `getSelectedItems()` is the one place both are
     *  combined; see "Multi-Selection" in this class's own comment. */
    this.additionalSelection = [];

    // "Continue improving editing history... the Builder should give
    // players confidence to experiment." One shared stack for every
    // mutating action Build Mode performs — see `_pushHistory()`.
    this.editHistory = new EditHistory();

    // "Copy transforms. Paste transforms." A plain snapshot, not a
    // reference to any live object — copying, then deleting the object it
    // came from, still leaves a valid clipboard to paste from.
    this._transformClipboard = null;

    // Screen-space box-select tracking — see `_handlePointerDown()`/
    // `_handlePointerMove()`/`_handlePointerUp()`. `null` whenever no drag
    // is in progress.
    this._dragSelectStart = null;

    // "Introduce a dedicated terrain editing workflow." `null` (the
    // ordinary place/select mode, unchanged) or `{type, materialId?,
    // radius, strength}` — see "Terrain Editing" further down this file
    // for the full mechanism. Set via `setTerrainTool()`, read by
    // `_handlePointerDown/Move/Up()` to decide whether a click sculpts
    // the ground instead of selecting something.
    this._terrainTool = null;
    this._terrainStrokeSnapshot = null; // {heights, materialIndex} captured once at the start of a stroke — see _beginTerrainStroke()
    this._terrainBrushPreview = null; // a ring mesh following the cursor while a terrain tool is active — see _buildTerrainBrushPreview()/setTerrainTool()

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
    this._onPointerUp = (e) => this._handlePointerUp(e);
    this._onWheel = (e) => this._handleWheel(e);
    this._onKeyDown = (e) => this._handleKeyDown(e);
    engine.canvas.addEventListener("pointermove", this._onPointerMove);
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);
    engine.canvas.addEventListener("pointerup", this._onPointerUp);
    engine.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    window.addEventListener("keydown", this._onKeyDown);

    engine.events.on("library:changed", () => {
      if (this.active) this._renderLibrary();
    });

    engine.events.on("persistence:save", (bag) => {
      bag.buildMode = {}; // nothing session-specific worth persisting — see docs/WORLDBUILDER.md
    });

    this._buildTerrainBrushPreview();
  }

  /** Workshop Workflow phase — "better visual feedback" for terrain
   *  editing. A simple ring, flat on the ground, following the cursor
   *  the moment a terrain tool is armed — not just while a stroke is
   *  already in progress. Previously there was no way to see where a
   *  brush would actually land, or how large an area it would cover,
   *  before committing to a drag. Built once and reused (shown/hidden,
   *  repositioned, resized) rather than rebuilt per frame — the same
   *  "build once, mutate" instinct every other frequently-updated visual
   *  in this project already follows. `MeshBasicMaterial` (unlit) so it
   *  reads clearly as an interface element regardless of the Workshop's
   *  own time of day or weather, the same reasoning a selection outline
   *  or a placement ghost already would. */
  _buildTerrainBrushPreview() {
    const geometry = new THREE.RingGeometry(0.9, 1, 48);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this._terrainBrushPreview = new THREE.Mesh(geometry, material);
    this._terrainBrushPreview.visible = false;
    this._terrainBrushPreview.renderOrder = 10; // draws after the terrain itself, so it never flickers against it at grazing angles
    this.engine.scene.add(this._terrainBrushPreview);
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

      // --- Builder Evolution: multi-selection, grouping, history, transform/alignment tools ---
      onSelectAll: () => this._selectAll(),
      onInvertSelection: () => this._invertSelection(),
      onClearSelection: () => this._select(null),
      onGroupSelection: () => this._promptGroupSelection(),
      onUngroupSelection: () => this._ungroupSelection(),
      onDuplicateMultiple: () => this._duplicateMultiple(),
      onDeleteMultiple: () => this._deleteMultiple(),
      onAlign: (axis, mode) => this._alignSelection(axis, mode),
      onDistribute: (axis) => this._distributeSelection(axis),
      onCopyTransform: () => this._copyTransform(),
      onPasteTransform: () => this._pasteTransform(),
      onResetTransform: () => this._resetTransform(),
      onSaveMultipleAsBlueprint: () => this._promptSaveMultipleAsBlueprint(),
      onUndo: () => this._undo(),
      onRedo: () => this._redo(),
      canUndo: () => this.editHistory.canUndo(),
      canRedo: () => this.editHistory.canRedo(),
      getMeasurement: () => this._measureSelection(),
      onSetTerrainTool: (tool) => this.setTerrainTool(tool),
      onImportModel: (file) => this.importModel(file),
      onExportBlueprint: (id) => this.blueprintStore?.exportBlueprint(id) ?? null,
      onImportBlueprint: (data) => this._importBlueprint(data),
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
    if (this._terrainPointerDown) this._finishTerrainStroke();
    this._terrainTool = null;
    this._terrainPointerDown = false;
    if (this._terrainBrushPreview) this._terrainBrushPreview.visible = false;
    this._cancelGhost();
    this._select(null);
    this.active = false;
    this.engine.events.emit("buildmode:exited");
  }

  _renderLibrary() {
    this.ui.renderLibrary(CONSTRUCTION_PIECES, this.objectLibraryStore.all(), this.modelLibrary?.all() ?? [], this.blueprintStore?.all() ?? []);
  }

  /** Workshop Workflow phase — "players can create custom Builder blocks
   *  using primitive shapes, however they cannot import external models
   *  for use as Builder shapes... extend the Builder so imported models
   *  can be used as Builder shapes alongside Workshop-created shapes."
   *  Models were already placeable from the "Imported Models" tab — the
   *  only genuine gap was *getting* one in without a detour through the
   *  Being Creator's own Model section first. This is the identical
   *  import path that section already uses
   *  (`modelLibrary.add()`/`modelAssetStore.put()`, the same `.glb`/
   *  `.gltf` handling — see `BeingCreatorApp.js`'s own `buildModelSection()`)
   *  so an imported model behaves identically everywhere it can be used,
   *  regardless of which app it was imported from. Newly imported models
   *  are immediately real Workshop Assets (see `modelLibrary`'s own
   *  `AssetService` registration in main.js) and immediately available
   *  to every Being and every future Builder session too, not something
   *  private to this one. Called by `BuilderPhoneUI.js`'s own "Import
   *  Model" button; throws with a specific message that UI already knows
   *  how to show directly, the same "not a valid file" case Being
   *  Creator's own import already handles. */
  async importModel(file) {
    if (!this.modelAssetStore || !this.modelLibrary) throw new Error("Models aren't available right now.");
    const modelId = await importModelFile(file, { modelLibrary: this.modelLibrary, modelAssetStore: this.modelAssetStore });
    this._renderLibrary();
    return modelId;
  }

  /** Version 3, Phase 7 ("Sharing the Workshop") — the exact same
   *  "import, then re-render the library screen so the new entry is
   *  immediately visible" shape `importModel()` above already
   *  establishes, applied to `BlueprintStore.importBlueprint()`. */
  _importBlueprint(data) {
    if (!this.blueprintStore) throw new Error("Blueprints aren't available right now.");
    const blueprint = this.blueprintStore.importBlueprint(data);
    this._renderLibrary();
    return blueprint;
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

  /** "Save as Blueprint" (single-selection screen) — captures the
   *  currently selected World Object plus every other one within
   *  `radius` of it, storing each one's own position/rotation/scale as an
   *  offset relative to the selected object's own position. The quick,
   *  no-multi-select-needed option for a single click; see
   *  `_captureSelectionAsBlueprintObjects()`/`_promptSaveMultipleAsBlueprint()`
   *  for the exact-capture alternative once a real multi-selection is
   *  active. See `BlueprintStore.js`'s own comment for why both exist. */
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
    if (this._ghost) return;
    if (this.getSelectedItems().length > 1) {
      this._startMoveMultiple();
      return;
    }
    if (!this.selection) return;
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

  /** "Groups should simplify editing rather than complicate it" — a
   *  group (or any multi-selection) needs to be movable as one unit for
   *  grouping to actually save any effort. Deliberately translation-only
   *  (no rotate, no snap-to-surface pivoting) — real rotation around a
   *  shared pivot for an arbitrary cluster is a genuinely harder problem
   *  than this phase's own time stretched to; see docs/WORLDBUILDER.md's
   *  own "Known simplifications." Every member keeps its own live
   *  `object3D` as a direct child of the scene the entire time (no
   *  temporary reparenting) — only its position is nudged by the same
   *  delta every other member gets, computed from how far the *first*
   *  selected item's own original position is from wherever the pointer
   *  now raycasts to (see `_handlePointerMove()`'s own `moveMultiple`
   *  branch). Safer than reparenting real, live entities into a
   *  throwaway group and back out again, and visually identical. */
  _startMoveMultiple() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length < 2) return;
    const members = [];
    for (const item of items) {
      const entity = this._worldObjectsSystem?.getLiveEntity(item.id);
      if (!entity?.object3D) continue;
      const obj = entity.object3D;
      members.push({ id: item.id, object3D: obj, materialSwap: makeTransparent(obj), originalPosition: [obj.position.x, obj.position.y, obj.position.z] });
    }
    if (members.length < 2) {
      for (const m of members) restoreMaterials(m.materialSwap);
      return;
    }
    this._ghost = {
      kind: "moveMultiple",
      object3D: null, // deliberately no single object3D — see this method's own comment
      definition: { name: `${members.length} objects` },
      members,
      anchorOriginalPosition: [...members[0].originalPosition],
    };
    this.ui.showGhostScreen(this._ghost.definition, "Move here", { allowRotate: false });
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
    if (!this._ghost || this._ghost.kind === "moveMultiple") return; // translation-only — see _startMoveMultiple()'s own comment
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
  /** "Continue improving editing history... undo, redo." The ordinary,
   *  universally-expected shortcuts — Ctrl+Z (Cmd+Z on a Mac) to undo,
   *  Ctrl+Y or Ctrl+Shift+Z to redo — work anywhere Build Mode is open,
   *  not only while something happens to be selected, since "what should
   *  I press to undo" shouldn't depend on the current screen. Ignored
   *  entirely while a ghost is active — undoing *through* an in-progress
   *  placement would be confusing (what would it even undo — the last
   *  confirmed action, or the placement that hasn't happened yet?); the
   *  ghost's own Cancel is the right tool for "I changed my mind about
   *  this one." */
  _handleKeyDown(event) {
    if (!this.active || this._ghost) return;
    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    if (!ctrlOrCmd) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      this._undo();
    } else if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      this._redo();
    }
  }

  _handleWheel(event) {
    if (!this._ghost || this._ghost.kind === "moveMultiple") return; // translation-only — see _startMoveMultiple()'s own comment
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
        const created = [];
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
          created.push(instance);
        }
        this.engine.events.emit("persistence:saveRequested");
        this._pushHistory(
          `Place blueprint "${ghost.definition.name}"`,
          () => {
            for (const c of created) this._removeInstanceSilently(c.id);
          },
          () => {
            for (const c of created) this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(c));
            this.engine.events.emit("persistence:saveRequested");
          }
        );
        this._ghost = null;
        if (created.length) this._select({ kind: "worldObject", id: created[created.length - 1].id });
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
      this._pushHistory(
        `Place ${ghost.definition.name}`,
        () => this._removeInstanceSilently(instance.id),
        () => {
          this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(instance));
          this.engine.events.emit("persistence:saveRequested");
        }
      );
      this._ghost = null;
      this._select({ kind: "worldObject", id: instance.id });
      return;
    }

    if (ghost.kind === "moveMultiple") {
      const previous = ghost.members.map((m) => ({ id: m.id, position: m.originalPosition }));
      const next = ghost.members.map((m) => ({ id: m.id, position: [m.object3D.position.x, m.object3D.position.y, m.object3D.position.z] }));
      for (const m of ghost.members) restoreMaterials(m.materialSwap);
      for (const n of next) this._worldObjectsSystem?.updateInstanceTransform(n.id, { position: n.position });
      this.engine.events.emit("persistence:saveRequested");
      this._pushHistory(
        `Move ${ghost.members.length} objects`,
        () => {
          for (const p of previous) this._worldObjectsSystem?.updateInstanceTransform(p.id, { position: p.position });
          this.engine.events.emit("persistence:saveRequested");
        },
        () => {
          for (const n of next) this._worldObjectsSystem?.updateInstanceTransform(n.id, { position: n.position });
          this.engine.events.emit("persistence:saveRequested");
        }
      );
      this._ghost = null;
      this._setSelectionItems(ghost.members.map((m) => ({ kind: "worldObject", id: m.id })));
      return;
    }

    restoreMaterials(ghost.materialSwap);
    const position = ghost.object3D.position;
    if (ghost.kind === "moveWorldObject") {
      const next = { position: [position.x, position.y, position.z], rotationY: ghost.rotationY };
      this._worldObjectsSystem?.updateInstanceTransform(ghost.sourceId, next);
      this._pushHistory(
        `Move ${ghost.definition?.name ?? "object"}`,
        () => this._worldObjectsSystem?.updateInstanceTransform(ghost.sourceId, ghost.originalTransform),
        () => this._worldObjectsSystem?.updateInstanceTransform(ghost.sourceId, next)
      );
      this._select({ kind: "worldObject", id: ghost.sourceId });
    } else {
      const next = { position: [position.x, position.y, position.z], rotationY: ghost.rotationY };
      this._furnitureSystem?.setOverride(ghost.sourceId, next.position, next.rotationY);
      this._pushHistory(
        `Move ${ghost.definition?.name ?? "furniture"}`,
        () => this._furnitureSystem?.setOverride(ghost.sourceId, ghost.originalTransform.position, ghost.originalTransform.rotationY),
        () => this._furnitureSystem?.setOverride(ghost.sourceId, next.position, next.rotationY)
      );
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

    if (ghost.kind === "moveMultiple") {
      for (const m of ghost.members) {
        restoreMaterials(m.materialSwap);
        m.object3D.position.set(...m.originalPosition);
      }
      this._ghost = null;
      this._setSelectionItems(ghost.members.map((m) => ({ kind: "worldObject", id: m.id })));
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
  // active ghost; with no ghost active, a pointerdown starts *tracking* a
  // potential drag rather than deciding anything immediately — only once
  // the pointer actually moves past a small threshold does this become a
  // box-select drag (see `_handlePointerMove`/`_handlePointerUp` below);
  // otherwise, releasing at essentially the same spot is an ordinary
  // click/tap, indistinguishable in feel from how selection always
  // worked, just decided a few pixels later than before.
  // -----------------------------------------------------------------

  _updatePointerNDC(event) {
    const rect = this.engine.canvas.getBoundingClientRect();
    this._pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._hasPointer = true;
  }

  _handlePointerMove(event) {
    if (!this.active) return;
    if (this._terrainTool) {
      this._updatePointerNDC(event);
      const point = this._raycastTerrain();
      if (this._terrainBrushPreview) {
        this._terrainBrushPreview.visible = !!point;
        if (point) this._terrainBrushPreview.position.set(point.x, point.y + 0.03, point.z);
      }
      if (this._terrainPointerDown && point) this._applyTerrainToolAt(point.x, point.z);
      return;
    }
    if (this._ghost) {
      this._updatePointerNDC(event);
      const point = this._raycastGhostSurfaces();
      if (point) {
        if (this.snapToGrid) {
          point.x = Math.round(point.x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          point.z = Math.round(point.z / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
        }
        if (this._ghost.kind === "moveMultiple") {
          // The raycast point directly becomes where the *first* member
          // ends up; every other member keeps its own original offset
          // from that one, so the whole selection translates rigidly
          // together — see `_startMoveMultiple()`'s own comment for why
          // this is a delta, not a reparented group.
          const [ax, ay, az] = this._ghost.anchorOriginalPosition;
          const dx = point.x - ax;
          const dy = point.y - ay;
          const dz = point.z - az;
          for (const member of this._ghost.members) {
            member.object3D.position.set(member.originalPosition[0] + dx, member.originalPosition[1] + dy, member.originalPosition[2] + dz);
          }
        } else {
          this._ghost.object3D.position.copy(point);
        }
      }
      return;
    }
    if (!this._dragSelectStart) return;
    const drag = this._dragSelectStart;
    const moved = Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY);
    if (!drag.dragging && moved > DRAG_SELECT_THRESHOLD_PX) {
      drag.dragging = true;
      this._showDragSelectRect();
    }
    if (drag.dragging) {
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      this._updateDragSelectRect();
    }
  }

  _handlePointerDown(event) {
    if (!this.active) return;
    this._updatePointerNDC(event);
    if (this._terrainTool) {
      if (event.button !== 0) return;
      this._beginTerrainStroke();
      this._terrainPointerDown = true;
      const point = this._raycastTerrain();
      if (point) this._applyTerrainToolAt(point.x, point.z);
      return;
    }
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
    if (event.button !== 0) return; // only the primary button ever starts a selection or a drag-select
    this._dragSelectStart = { clientX: event.clientX, clientY: event.clientY, currentX: event.clientX, currentY: event.clientY, shiftKey: event.shiftKey, dragging: false };
  }

  /** The one place a pointerdown actually resolves into something —
   *  either an ordinary click/tap (raycast select/deselect, unchanged
   *  in feel from before this phase) or, if the pointer travelled far
   *  enough first, a box-select over whatever fell inside the dragged
   *  rectangle. "Shift-select... drag selection... box selection where
   *  appropriate" are all decided right here, together, since they're
   *  really one gesture with two possible endings. */
  _handlePointerUp(event) {
    if (!this.active) return;
    if (this._terrainTool) {
      if (this._terrainPointerDown) {
        this._terrainPointerDown = false;
        this._finishTerrainStroke();
      }
      return;
    }
    if (!this._dragSelectStart) return;
    const drag = this._dragSelectStart;
    this._dragSelectStart = null;

    if (drag.dragging) {
      this._hideDragSelectRect();
      this._finishDragSelect(drag);
      return;
    }

    this._updatePointerNDC(event);
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    const targets = [...(this._worldObjectsSystem?.getAllLiveObjects() ?? []), ...this._furnitureObjects()];
    const hit = this._raycastFirst(targets);
    const identified = hit ? this._identifyHit(hit.object) : null;
    if (identified) this._select(identified, { additive: drag.shiftKey });
    else if (!drag.shiftKey) this._select(null); // empty space, no shift — clear. With shift, clicking empty space leaves an existing multi-selection untouched rather than discarding it by accident.
  }

  _showDragSelectRect() {
    const root = document.getElementById("build-select-root");
    if (!root) return;
    this._dragRectEl = document.createElement("div");
    this._dragRectEl.className = "build-select-rect";
    root.appendChild(this._dragRectEl);
  }

  _updateDragSelectRect() {
    if (!this._dragRectEl || !this._dragSelectStart) return;
    const { clientX, clientY, currentX, currentY } = this._dragSelectStart;
    const left = Math.min(clientX, currentX);
    const top = Math.min(clientY, currentY);
    Object.assign(this._dragRectEl.style, { left: `${left}px`, top: `${top}px`, width: `${Math.abs(currentX - clientX)}px`, height: `${Math.abs(currentY - clientY)}px` });
  }

  _hideDragSelectRect() {
    this._dragRectEl?.remove();
    this._dragRectEl = null;
  }

  /** Projects every live World Object's own current world position into
   *  screen space (`THREE.Vector3.project()`, the ordinary way anything
   *  goes from 3D to 2D) and keeps whichever fall inside the dragged
   *  rectangle — furniture is deliberately excluded from box-select (it
   *  can still be selected by an ordinary click; a rectangle drag is
   *  about laying out *Builder* objects, not accidentally sweeping up
   *  the Workshop's own permanent furniture). */
  _finishDragSelect(drag) {
    const rect = this.engine.canvas.getBoundingClientRect();
    const minX = Math.min(drag.clientX, drag.currentX);
    const maxX = Math.max(drag.clientX, drag.currentX);
    const minY = Math.min(drag.clientY, drag.currentY);
    const maxY = Math.max(drag.clientY, drag.currentY);
    const scratch = new THREE.Vector3();

    const hits = [];
    for (const instance of this.worldObjectsStore.byRoom()) {
      const entity = this._worldObjectsSystem?.getLiveEntity(instance.id);
      if (!entity?.object3D) continue;
      entity.object3D.getWorldPosition(scratch);
      scratch.project(this.engine.camera);
      if (scratch.z < -1 || scratch.z > 1) continue; // behind the camera, or beyond the far plane
      const screenX = rect.left + ((scratch.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - scratch.y) / 2) * rect.height;
      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) hits.push({ kind: "worldObject", id: instance.id });
    }

    if (hits.length === 0) {
      if (!drag.shiftKey) this._select(null);
      return;
    }
    const expanded = hits.flatMap((h) => this._expandGroup(h)).filter((item, index, arr) => arr.findIndex((x) => this._sameItem(x, item)) === index);
    if (drag.shiftKey) {
      const already = this.getSelectedItems();
      this._setSelectionItems([...already, ...expanded.filter((item) => !already.some((s) => this._sameItem(s, item)))]);
    } else {
      this._setSelectionItems(expanded);
    }
  }

  /** Floor/ground + every already-placed object (world objects and
   *  furniture both) — a ghost can rest on top of something else exactly
   *  as naturally as on the floor. Excludes the ghost's own object(s)
   *  when moving something that already exists, so it never collides
   *  with itself while dragging — a `moveMultiple` ghost excludes every
   *  one of its own members, not just a single object3D.
   *
   *  Workshop Reliability phase — "player movement, collision, and
   *  object placement should all reference the same terrain surface."
   *  This used to raycast against `WorldEnvironmentSystem`'s own flat,
   *  purely-visual ground — meaning a ghost placed outdoors always
   *  landed on flat ground even when hovering directly over a sculpted
   *  hill, silently ignoring it. `TerrainSystem.js` is now the
   *  Workshop's one real ground (see that file's own top comment); this
   *  raycasts its actual mesh, the exact one `getHeightAt()`-driven
   *  player movement already walks on. */
  _gatherSurfaces() {
    const floorMesh = this.engine.getSystem(RoomLayoutSystem)?.getFloorMesh();
    const groundMesh = this.terrainSystem?.mesh;
    const surfaces = [floorMesh, groundMesh].filter(Boolean);
    const objects = [...(this._worldObjectsSystem?.getAllLiveObjects() ?? []), ...this._furnitureObjects()];
    const excluding = this._ghost?.kind === "moveMultiple" ? new Set(this._ghost.members.map((m) => m.object3D)) : new Set([this._ghost?.object3D].filter(Boolean));
    return [...surfaces, ...objects].filter((o) => !excluding.has(o));
  }

  _furnitureObjects() {
    return (this._furnitureSystem?.getAllPieces() ?? []).map((p) => p.entity.object3D);
  }

  /** Version 3, Phase 5 ("Beyond One Building") — "we should be able to
   *  place building blocks on top of each other with proper top
   *  collisions... manual entry should just be for fine adjustments." A
   *  raw hit point already lands correctly when the pointer manages to
   *  hit an existing object's own top surface precisely — but that's
   *  genuinely hard to aim at (a wall's own top is a thin 2m×0.2m strip
   *  at height, confirmed directly against the real raycast geometry
   *  before this fix, not assumed), so in practice the wall's far larger,
   *  easier-to-hit side face gets hit instead, landing the new piece
   *  embedded partway up the side rather than resting on top of it —
   *  exactly the "have to manually enter the Y position" complaint this
   *  fixes. Whenever the hit object is an existing World Object (not the
   *  floor, not furniture — see `_identifyHit()`), the Y coordinate now
   *  snaps to that object's own real top
   *  (`WorldObjectsSystem.getFootprint()`, the exact same real per-object
   *  box collision already uses) regardless of which face was actually
   *  hit. Aiming anywhere at an existing structure means "build on top of
   *  it," which is what stacking a roof onto a wall actually needs,
   *  without requiring pixel-precise aim at a thin top edge. */
  _raycastGhostSurfaces() {
    if (!this._hasPointer) return null;
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    const hit = this._raycastFirst(this._gatherSurfaces());
    if (!hit) return null;

    const identified = this._identifyHit(hit.object);
    if (identified?.kind === "worldObject") {
      const box = this._worldObjectsSystem?.getFootprint(identified.id);
      if (box) hit.point.y = box.max.y;
    }
    return hit.point;
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

  /** Every currently-selected item, primary first — the one place both
   *  halves of the selection (`this.selection` and
   *  `this.additionalSelection`) are combined. Every bulk action
   *  (group, align, duplicate-all, delete-all, measure) reads from this,
   *  never from the two fields directly. */
  getSelectedItems() {
    return this.selection ? [this.selection, ...this.additionalSelection] : [];
  }

  _sameItem(a, b) {
    return a?.kind === b?.kind && a?.id === b?.id;
  }

  /** "Shift-select... working with many objects should become
   *  comfortable." `additive` (a shift-click, or a member of a group
   *  being auto-expanded — see below) adds `selection` to whatever's
   *  already selected instead of replacing it; clicking something already
   *  selected while `additive` removes just that one item. A plain click
   *  (not additive) always replaces the whole selection outright — the
   *  ordinary, unchanged single-selection behaviour every existing call
   *  site still relies on.
   *
   *  **Selecting a grouped object selects its whole group** — "selecting
   *  groups" from the brief, made automatic rather than needing its own
   *  separate gesture: any `worldObject` selected (by click or shift-click)
   *  that carries a `groupId` pulls in every other instance sharing that
   *  same id, the same click a player would already make to select one
   *  piece of it. */
  _select(selection, { additive = false } = {}) {
    if (!selection) {
      this.selection = null;
      this.additionalSelection = [];
      this.ui.showLibraryScreen();
      return;
    }

    const groupItems = this._expandGroup(selection);

    if (additive) {
      const already = this.getSelectedItems();
      const stillPresent = groupItems.every((item) => already.some((s) => this._sameItem(s, item)));
      const next = stillPresent
        ? already.filter((item) => !groupItems.some((g) => this._sameItem(g, item))) // shift-clicking an already-selected (group of) item removes it
        : [...already, ...groupItems.filter((item) => !already.some((s) => this._sameItem(s, item)))];
      this._setSelectionItems(next);
    } else {
      this._setSelectionItems(groupItems);
    }
  }

  /** Every member currently sharing `selection`'s own `groupId`, or just
   *  `[selection]` for furniture (which has no grouping concept) or a
   *  worldObject with no group at all. */
  _expandGroup(selection) {
    if (selection.kind !== "worldObject") return [selection];
    const instance = this.worldObjectsStore.get(selection.id);
    if (!instance?.groupId) return [selection];
    return this.worldObjectsStore
      .all()
      .filter((i) => i.groupId === instance.groupId)
      .map((i) => ({ kind: "worldObject", id: i.id }));
  }

  /** The one place `this.selection`/`this.additionalSelection` are
   *  actually assigned, and the UI re-rendered to match — chooses between
   *  the ordinary single-selection screen, the multi-selection bulk-action
   *  screen, or the empty library screen, based purely on how many items
   *  ended up selected. */
  _setSelectionItems(items) {
    if (items.length === 0) {
      this.selection = null;
      this.additionalSelection = [];
      this.ui.showLibraryScreen();
      return;
    }
    if (items.length === 1) {
      this.selection = items[0];
      this.additionalSelection = [];
      this._showSingleSelection();
      return;
    }
    this.selection = items[0];
    this.additionalSelection = items.slice(1);
    this._showMultiSelection();
  }

  _showSingleSelection() {
    const selection = this.selection;
    if (selection.kind === "worldObject") {
      const instance = this.worldObjectsStore.get(selection.id);
      const definition = instance ? this._resolveWorldObjectDefinition(instance) : null;
      if (!instance || !definition) {
        this.selection = null;
        this.ui.showLibraryScreen();
        return;
      }
      this.ui.showSelectionScreen({ kind: "worldObject", instance, definition, groupName: instance.groupName ?? null });
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

  _showMultiSelection() {
    const items = this.getSelectedItems();
    const groupIds = new Set(
      items
        .filter((i) => i.kind === "worldObject")
        .map((i) => this.worldObjectsStore.get(i.id)?.groupId)
        .filter(Boolean)
    );
    const isSingleGroup = groupIds.size === 1;
    this.ui.showMultiSelectionScreen({
      count: items.length,
      allWorldObjects: items.every((i) => i.kind === "worldObject"),
      isSingleGroup,
      groupName: isSingleGroup ? this.worldObjectsStore.get(items.find((i) => i.kind === "worldObject").id)?.groupName : null,
    });
  }

  /** Deliberately not wrapped in an undo entry — this fires on every
   *  single `input` event while a slider is being dragged (position,
   *  rotation, scale), and pushing one history entry per pixel of drag
   *  would make undo nearly useless (one press would barely move
   *  anything back). "Move," "Reset Transform," and "Paste Transform"
   *  are the real, coarse-grained transform actions that get their own
   *  undo entry — a discrete, deliberate action each time, not a
   *  continuous stream of them. */
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
      groupId: null, // a duplicate starts its own life, not silently joining the original's group
      groupName: null,
      position: [instance.position[0] + 0.3, instance.position[1], instance.position[2] + 0.3],
    });
    this._worldObjectsSystem?.spawnInstance(copy);
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Duplicate ${this._resolveWorldObjectDefinition(instance)?.name ?? "object"}`,
      () => this._removeInstanceSilently(copy.id),
      () => {
        this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(copy));
        this.engine.events.emit("persistence:saveRequested");
      }
    );
    this._select({ kind: "worldObject", id: copy.id });
  }

  _deleteSelected() {
    if (this.selection?.kind !== "worldObject") return; // furniture can be moved, never deleted
    const instance = this.worldObjectsStore.get(this.selection.id);
    if (!instance) return;
    this._worldObjectsSystem?.removeInstance(this.selection.id);
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Delete ${this._resolveWorldObjectDefinition(instance)?.name ?? "object"}`,
      () => {
        this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(instance));
        this.engine.events.emit("persistence:saveRequested");
      },
      () => this._removeInstanceSilently(instance.id)
    );
    this._select(null);
  }

  _resetSelectedFurniture() {
    if (this.selection?.kind !== "furniture") return;
    this._furnitureSystem?.clearOverride(this.selection.id);
    this._select(this.selection);
  }

  _removeInstanceSilently(id) {
    this._worldObjectsSystem?.removeInstance(id);
    this.engine.events.emit("persistence:saveRequested");
  }

  // -----------------------------------------------------------------
  // Editing History — "undo, redo, history inspection... confidence to
  // experiment." See EditHistory.js's own comment for the mechanism
  // itself; every method below is just "do the thing, then push one
  // entry describing how to reverse and reapply it."
  // -----------------------------------------------------------------

  _pushHistory(label, undo, redo) {
    this.editHistory.push({ label, undo, redo });
  }

  _undo() {
    const label = this.editHistory.undo();
    this._refreshSelectionDisplay();
    return label;
  }

  _redo() {
    const label = this.editHistory.redo();
    this._refreshSelectionDisplay();
    return label;
  }

  /** After an undo/redo, the current selection may no longer exist (its
   *  own creation was just undone, say) or may have moved/changed —
   *  re-validating through `_select()` itself (rather than trusting
   *  whatever the panel already shows) is what keeps the displayed
   *  fields honest either way. */
  _refreshSelectionDisplay() {
    if (this.additionalSelection.length > 0) this._setSelectionItems(this.getSelectedItems());
    else if (this.selection) this._select(this.selection);
    else this.ui.showLibraryScreen();
  }

  // -----------------------------------------------------------------
  // Multi-Selection — "shift-select, drag selection, select all, invert
  // selection... working with many objects should become comfortable."
  // -----------------------------------------------------------------

  _selectAll() {
    const items = this.worldObjectsStore.byRoom().map((i) => ({ kind: "worldObject", id: i.id }));
    this._setSelectionItems(items);
  }

  _invertSelection() {
    const selected = this.getSelectedItems();
    const everything = this.worldObjectsStore.byRoom().map((i) => ({ kind: "worldObject", id: i.id }));
    this._setSelectionItems(everything.filter((item) => !selected.some((s) => this._sameItem(s, item))));
  }

  // -----------------------------------------------------------------
  // Grouping — "creating groups, naming groups, selecting groups, editing
  // groups, duplicating groups, ungrouping." A group is just a shared
  // `groupId`/`groupName` value stored redundantly on every member's own
  // instance record — no separate group registry to keep in sync (see
  // `nextGroupId()`'s own comment). Selecting any one member already
  // selects the whole group (`_expandGroup()`); duplicating or deleting a
  // multi-selection already handles a group's members the same as any
  // other multi-selection would.
  // -----------------------------------------------------------------

  _promptGroupSelection() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length < 2) return;
    const name = window.prompt("Name this group:", "New Group");
    if (!name) return;
    const groupId = nextGroupId();
    const previous = items.map((item) => {
      const instance = this.worldObjectsStore.get(item.id);
      return { id: item.id, groupId: instance?.groupId ?? null, groupName: instance?.groupName ?? null };
    });
    const apply = () => {
      for (const item of items) this._worldObjectsSystem?.updateInstanceTransform(item.id, { groupId, groupName: name });
      this.engine.events.emit("persistence:saveRequested");
    };
    apply();
    this._pushHistory(
      `Group ${items.length} objects as "${name}"`,
      () => {
        for (const p of previous) this._worldObjectsSystem?.updateInstanceTransform(p.id, { groupId: p.groupId, groupName: p.groupName });
        this.engine.events.emit("persistence:saveRequested");
      },
      apply
    );
    this._setSelectionItems(items);
  }

  _ungroupSelection() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    const previous = items.map((item) => {
      const instance = this.worldObjectsStore.get(item.id);
      return { id: item.id, groupId: instance?.groupId ?? null, groupName: instance?.groupName ?? null };
    });
    if (previous.every((p) => !p.groupId)) return;
    for (const item of items) this._worldObjectsSystem?.updateInstanceTransform(item.id, { groupId: null, groupName: null });
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Ungroup ${items.length} objects`,
      () => {
        for (const p of previous) this._worldObjectsSystem?.updateInstanceTransform(p.id, { groupId: p.groupId, groupName: p.groupName });
        this.engine.events.emit("persistence:saveRequested");
      },
      () => {
        for (const item of items) this._worldObjectsSystem?.updateInstanceTransform(item.id, { groupId: null, groupName: null });
        this.engine.events.emit("persistence:saveRequested");
      }
    );
    this._setSelectionItems(items);
  }

  _duplicateMultiple() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return;
    const newGroupId = items.length > 1 && this.worldObjectsStore.get(items[0].id)?.groupId ? nextGroupId() : null;
    const copies = [];
    for (const item of items) {
      const instance = this.worldObjectsStore.get(item.id);
      if (!instance) continue;
      const copy = this.worldObjectsStore.create({
        ...instance,
        groupId: newGroupId,
        groupName: newGroupId ? instance.groupName : null,
        position: [instance.position[0] + 0.3, instance.position[1], instance.position[2] + 0.3],
      });
      this._worldObjectsSystem?.spawnInstance(copy);
      copies.push(copy);
    }
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Duplicate ${copies.length} objects`,
      () => {
        for (const c of copies) this._removeInstanceSilently(c.id);
      },
      () => {
        for (const c of copies) this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(c));
        this.engine.events.emit("persistence:saveRequested");
      }
    );
    this._setSelectionItems(copies.map((c) => ({ kind: "worldObject", id: c.id })));
  }

  _deleteMultiple() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return;
    const removed = items.map((item) => this.worldObjectsStore.get(item.id)).filter(Boolean);
    for (const instance of removed) this._worldObjectsSystem?.removeInstance(instance.id);
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Delete ${removed.length} objects`,
      () => {
        for (const instance of removed) this._worldObjectsSystem?.spawnInstance(this.worldObjectsStore.restore(instance));
        this.engine.events.emit("persistence:saveRequested");
      },
      () => {
        for (const instance of removed) this._removeInstanceSilently(instance.id);
      }
    );
    this._select(null);
  }

  // -----------------------------------------------------------------
  // Alignment & Distribution — "align left, centre, right, top, bottom,
  // even spacing... simplify creating clean layouts." Pure math lives in
  // AlignmentTools.js; this is just the plumbing between "the current
  // selection's own positions" and "a real, undoable transform update
  // per instance."
  // -----------------------------------------------------------------

  _alignSelection(axis, mode) {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length < 2) return;
    this._applyPositions(items, alignPositions(items.map((i) => this.worldObjectsStore.get(i.id).position), axis, mode), `Align ${items.length} objects`);
  }

  _distributeSelection(axis) {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length < 3) return;
    this._applyPositions(items, distributeEvenly(items.map((i) => this.worldObjectsStore.get(i.id).position), axis), `Distribute ${items.length} objects`);
  }

  _applyPositions(items, nextPositions, label) {
    const previous = items.map((item) => [...this.worldObjectsStore.get(item.id).position]);
    const apply = (positions) => {
      items.forEach((item, i) => this._worldObjectsSystem?.updateInstanceTransform(item.id, { position: positions[i] }));
      this.engine.events.emit("persistence:saveRequested");
    };
    apply(nextPositions);
    this._pushHistory(label, () => apply(previous), () => apply(nextPositions));
    this._setSelectionItems(items);
  }

  // -----------------------------------------------------------------
  // Transform tools — "reset transforms, copy transforms, paste
  // transforms."
  // -----------------------------------------------------------------

  _copyTransform() {
    if (this.selection?.kind !== "worldObject") return;
    const instance = this.worldObjectsStore.get(this.selection.id);
    if (!instance) return;
    this._transformClipboard = { rotationY: instance.rotationY, rotationX: instance.rotationX ?? 0, rotationZ: instance.rotationZ ?? 0, scale: instance.scale };
  }

  /** Pastes rotation and scale (never position — "paste transform" means
   *  "make this one oriented/sized like that one," not "stack them on top
   *  of each other") onto every selected World Object. */
  _pasteTransform() {
    if (!this._transformClipboard) return;
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return;
    const clip = this._transformClipboard;
    const previous = items.map((item) => {
      const i = this.worldObjectsStore.get(item.id);
      return { rotationY: i.rotationY, rotationX: i.rotationX ?? 0, rotationZ: i.rotationZ ?? 0, scale: i.scale };
    });
    const apply = (values) => {
      items.forEach((item, i) => this._worldObjectsSystem?.updateInstanceTransform(item.id, values[i] ?? values));
      this.engine.events.emit("persistence:saveRequested");
    };
    apply(items.map(() => clip));
    this._pushHistory(
      `Paste transform onto ${items.length} object${items.length === 1 ? "" : "s"}`,
      () => apply(previous),
      () => apply(items.map(() => clip))
    );
    this._refreshSelectionDisplay();
  }

  _resetTransform() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return;
    const previous = items.map((item) => {
      const i = this.worldObjectsStore.get(item.id);
      return { rotationY: i.rotationY, rotationX: i.rotationX ?? 0, rotationZ: i.rotationZ ?? 0, scale: i.scale };
    });
    const reset = { rotationY: 0, rotationX: 0, rotationZ: 0, scale: 1 };
    const apply = (values) => {
      items.forEach((item, i) => this._worldObjectsSystem?.updateInstanceTransform(item.id, values[i] ?? values));
      this.engine.events.emit("persistence:saveRequested");
    };
    apply(items.map(() => reset));
    this._pushHistory(
      `Reset transform on ${items.length} object${items.length === 1 ? "" : "s"}`,
      () => apply(previous),
      () => apply(items.map(() => reset))
    );
    this._refreshSelectionDisplay();
  }

  // -----------------------------------------------------------------
  // Measurement — "distance measurement, object dimensions... feel
  // confident building accurately." Reuses `WorldObjectsSystem.
  // getFootprints()`'s own already-computed, real `THREE.Box3` per
  // instance (built from the object's actual compiled geometry for
  // collision purposes) rather than maintaining a second, parallel
  // dimensions calculation.
  // -----------------------------------------------------------------

  _measureSelection() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return null;
    const boxes = items.map((item) => this._worldObjectsSystem?.getFootprint(item.id)).filter(Boolean);
    if (boxes.length === 0) return null;

    if (items.length === 1) {
      const box = boxes[0];
      return { kind: "dimensions", width: box.max.x - box.min.x, height: box.max.y - box.min.y, depth: box.max.z - box.min.z };
    }
    if (items.length === 2) {
      const a = this.worldObjectsStore.get(items[0].id).position;
      const b = this.worldObjectsStore.get(items[1].id).position;
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      return { kind: "distance", distance };
    }
    const min = [Math.min(...boxes.map((b) => b.min.x)), Math.min(...boxes.map((b) => b.min.y)), Math.min(...boxes.map((b) => b.min.z))];
    const max = [Math.max(...boxes.map((b) => b.max.x)), Math.max(...boxes.map((b) => b.max.y)), Math.max(...boxes.map((b) => b.max.z))];
    return { kind: "bounds", width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
  }

  // -----------------------------------------------------------------
  // Blueprint Workflow — "create, edit, duplicate, update, replace,
  // reuse, share... blueprint editing should feel natural." Now that real
  // multi-selection exists, capturing a Blueprint from *exactly* the
  // selected objects replaces the radius-based guess
  // `captureBlueprintNearSelection()` still offers as a quick, no-selection
  // fallback (kept for a single-object quick-capture — see its own
  // comment) — see docs/WORLDBUILDER.md for the full account.
  // -----------------------------------------------------------------

  /** `objects` in the exact shape `BlueprintStore.create()`/`update()`
   *  already expect — every position relative to the first selected
   *  item's own position, matching `captureBlueprintNearSelection()`'s
   *  own convention exactly, so a blueprint captured either way places
   *  identically. */
  _captureSelectionAsBlueprintObjects() {
    const items = this.getSelectedItems().filter((i) => i.kind === "worldObject");
    if (items.length === 0) return null;
    const instances = items.map((item) => this.worldObjectsStore.get(item.id)).filter(Boolean);
    if (instances.length === 0) return null;
    const [cx, cy, cz] = instances[0].position;
    return instances.map((instance) => ({
      definitionId: instance.definitionId,
      definitionSource: instance.definitionSource,
      offset: [instance.position[0] - cx, instance.position[1] - cy, instance.position[2] - cz],
      rotationY: instance.rotationY,
      scale: instance.scale,
      colorOverride: instance.colorOverride,
    }));
  }

  _promptSaveMultipleAsBlueprint() {
    if (!this.blueprintStore) return;
    const objects = this._captureSelectionAsBlueprintObjects();
    if (!objects) return;
    const name = window.prompt(`Name this Blueprint (captures exactly the ${objects.length} selected objects):`, "New Blueprint");
    if (!name) return;
    this.blueprintStore.create(name, objects);
  }

  /** "Update... replace." Re-captures the current selection's own
   *  transforms into an *existing* blueprint, keeping its id (and
   *  therefore every place that already references it) — the real
   *  "update this blueprint to match how I've since rearranged its
   *  pieces" workflow the brief asks for, rather than only ever being
   *  able to create a brand new one. */
  updateBlueprintFromSelection(blueprintId) {
    if (!this.blueprintStore?.get(blueprintId)) return false;
    const objects = this._captureSelectionAsBlueprintObjects();
    if (!objects) return false;
    this.blueprintStore.update(blueprintId, objects);
    return true;
  }

  // -----------------------------------------------------------------
  // Terrain Editing — "raise, lower, flatten, smooth, terrace terrain...
  // paint terrain materials... terrain editing should feel natural,
  // responsive and easy to control." The actual sculpting math lives
  // entirely in `TerrainSystem.js`; this is the interaction layer —
  // deciding what a click-and-drag in the world means while a terrain
  // tool is active, the same "this file owns *when*, the real logic
  // lives elsewhere" split every other tool in Build Mode already
  // follows. Selecting/placing objects and sculpting terrain are
  // mutually exclusive — activating a terrain tool cancels any ghost or
  // selection in progress first, and vice versa (see `setTerrainTool()`),
  // so there's never an ambiguous "what does clicking do right now."
  // -----------------------------------------------------------------

  /** `tool` is `null` (back to ordinary select/place) or `{type:
   *  "raise"|"lower"|"flatten"|"smooth"|"terrace"|"paint", materialId?,
   *  radius, strength}`. Called from the Builder Phone's own Terrain
   *  tab every time a tool, brush size, strength, or paint material is
   *  chosen — cheap enough to call on every single change rather than
   *  needing its own "confirm" step. */
  setTerrainTool(tool) {
    if (this._ghost) this._cancelGhost();
    if (this.selection || this.additionalSelection.length) this._select(null);
    this._terrainTool = tool;
    this._terrainPointerDown = false;
    this._updateTerrainBrushPreview();
  }

  /** Ring radius/colour always tracks the *current* tool exactly —
   *  called from `setTerrainTool()` (a new tool, size, or material) so
   *  the ring is never stale even for a change made mid-hover, before
   *  the cursor itself moves again. Visibility alone is also toggled
   *  from `_handlePointerMove()` each frame the terrain mesh is or isn't
   *  actually under the cursor, so the ring never floats disconnected
   *  from real ground. */
  _updateTerrainBrushPreview() {
    if (!this._terrainBrushPreview) return;
    if (!this._terrainTool) {
      this._terrainBrushPreview.visible = false;
      return;
    }
    const radius = this._terrainTool.radius ?? 1;
    this._terrainBrushPreview.scale.set(radius, 1, radius);
    const color = this._terrainTool.type === "paint" ? TERRAIN_MATERIALS.find((m) => m.id === this._terrainTool.materialId)?.color ?? "#ffffff" : "#ffffff";
    this._terrainBrushPreview.material.color.set(color);
  }

  _beginTerrainStroke() {
    if (!this.terrainSystem) return;
    // A full snapshot, not a diff — 101x101 vertices (grown from the
    // original 48m patch's 49x49 in the Workshop Reliability phase) is
    // still small enough (roughly 10,000 numbers each) that copying both
    // arrays whole is simpler and safer than tracking exactly which vertices a stroke
    // touched, and still cheap enough to do on every single stroke.
    this._terrainStrokeSnapshot = {
      heights: Float32Array.from(this.terrainSystem.heights),
      materialIndex: Uint8Array.from(this.terrainSystem.materialIndex),
    };
  }

  _finishTerrainStroke() {
    if (!this.terrainSystem || !this._terrainStrokeSnapshot) return;
    const before = this._terrainStrokeSnapshot;
    this._terrainStrokeSnapshot = null;
    const after = { heights: Float32Array.from(this.terrainSystem.heights), materialIndex: Uint8Array.from(this.terrainSystem.materialIndex) };
    // A stroke that didn't actually change anything (a click that missed
    // the terrain patch entirely, say) isn't worth an undo entry at all.
    if (before.heights.every((h, i) => h === after.heights[i]) && before.materialIndex.every((m, i) => m === after.materialIndex[i])) return;
    this.engine.events.emit("persistence:saveRequested");
    this._pushHistory(
      `Sculpt terrain (${this._terrainTool?.type ?? "edit"})`,
      () => {
        this.terrainSystem.load({ heights: Array.from(before.heights), materialIndex: Array.from(before.materialIndex) });
        this.engine.events.emit("persistence:saveRequested");
      },
      () => {
        this.terrainSystem.load({ heights: Array.from(after.heights), materialIndex: Array.from(after.materialIndex) });
        this.engine.events.emit("persistence:saveRequested");
      }
    );
  }

  /** Just the raycast — shared by the brush preview ring (every hover)
   *  and the actual sculpt/paint application (only while the pointer is
   *  down). Kept as one function so there's exactly one place that
   *  decides what "under the cursor, on the terrain" means. */
  _raycastTerrain() {
    if (!this.terrainSystem?.mesh) return null;
    this._raycaster.setFromCamera(this._pointerNDC, this.engine.camera);
    return this._raycaster.intersectObject(this.terrainSystem.mesh, false)[0]?.point ?? null;
  }

  _applyTerrainToolAt(x, z) {
    if (!this.terrainSystem || !this._terrainTool) return;
    const { type, radius, strength, materialId } = this._terrainTool;
    if (type === "paint") this.terrainSystem.paint(x, z, radius, materialId, strength);
    else if (typeof this.terrainSystem[type] === "function") this.terrainSystem[type](x, z, radius, strength);
  }

  update(_dt) {
    if (!this.active) return;
    if (this.engine.input?.wasJustPressed("cancel")) {
      if (this._ghost) this._cancelGhost();
      else if (this._terrainTool) this.setTerrainTool(null);
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
    this.engine.canvas.removeEventListener("pointerup", this._onPointerUp);
    this.engine.canvas.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("keydown", this._onKeyDown);
  }
}
