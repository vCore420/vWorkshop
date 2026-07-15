/**
 * BuilderPhoneUI
 * ----------------
 * The Builder's own screens within the Workshop Phone — "the Computer is
 * for creating, the Phone is for using... continue allowing world
 * building while walking naturally through the environment." This class
 * no longer owns a phone shell of its own (no header, no slide
 * animation) — `PhoneSystem`/`PhoneUI.js` own that now, uniformly, for
 * every app; this class only ever fills whatever container it's handed
 * with one of its own three screens.
 *
 * `BuildModeSystem` owns all the actual state (what's armed, what's
 * selected, what's mid-ghost); this class only ever renders whatever
 * state it's handed and reports interactions back via plain callbacks —
 * the same shape every overlay/app in this codebase already uses.
 *
 * Three screens, swapped in and out of the same container:
 *   - **Library** — tabs (Construction Library / Saved Objects) over a
 *     scrollable grid. The default screen; shown whenever nothing is
 *     armed or selected.
 *   - **Ghost** — shown while something is being placed or moved: Rotate,
 *     a confirm button (labelled "Place" or "Move here" depending on
 *     which), and Cancel. See BuildModeSystem's `_ghost`.
 *   - **Selection** — shown for a confirmed, non-moving selection:
 *     position/rotation (and, for Builder objects only, scale/colour)
 *     fields for precise numeric tweaks, a Move button that hands off to
 *     the Ghost screen, and Duplicate/Delete (Builder objects) or Reset
 *     Position (furniture, only once it's actually been moved from its
 *     Workshop default).
 */
import { getConstructionGroup, CONSTRUCTION_GROUP_ORDER } from "./ConstructionLibrary.js";
import { TERRAIN_MATERIALS } from "../systems/TerrainSystem.js";

export class BuilderPhoneUI {
  constructor(rootEl, callbacks) {
    this.callbacks = callbacks;
    this._libraryData = { constructionPieces: [], libraryDefinitions: [] };
    this._activeTab = "construction";
    // "Brush size adjustment. Brush strength adjustment." Local UI state
    // only — BuildModeSystem itself is the source of truth for whether a
    // tool is *active*; this is just what the next `onSetTerrainTool()`
    // call will describe.
    this._terrainToolType = "raise";
    this._terrainMaterialId = "grass";
    this._terrainRadius = 4;
    this._terrainStrength = 0.6;

    // The Phone's own content container, handed straight in — no shell
    // of this class's own to build around it any more.
    this.screen = rootEl;
  }

  /** "Undo, redo, history inspection." Shown at the top of every screen
   *  (Library, Ghost excluded — a ghost's own Cancel already covers "I
   *  changed my mind about this one placement," and undoing something
   *  from *before* it started would be a confusing thing to allow mid-
   *  placement) rather than tucked away on just one — the Builder should
   *  give players confidence to experiment regardless of what they
   *  happen to be looking at when they want to undo something. */
  _buildHistoryBar() {
    const bar = document.createElement("div");
    bar.className = "builder-phone-history-bar";
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "builder-phone-small-button";
    undoBtn.textContent = "\u21B6 Undo";
    undoBtn.disabled = !this.callbacks.canUndo();
    undoBtn.addEventListener("click", () => this.callbacks.onUndo());
    const redoBtn = document.createElement("button");
    redoBtn.type = "button";
    redoBtn.className = "builder-phone-small-button";
    redoBtn.textContent = "\u21B7 Redo";
    redoBtn.disabled = !this.callbacks.canRedo();
    redoBtn.addEventListener("click", () => this.callbacks.onRedo());
    bar.append(undoBtn, redoBtn);
    return bar;
  }

  // -----------------------------------------------------------------
  // Screen: Library
  // -----------------------------------------------------------------

  renderLibrary(constructionPieces, libraryDefinitions, importedModels = [], blueprints = []) {
    this._libraryData = { constructionPieces, libraryDefinitions, importedModels, blueprints };
    if (this._currentScreen === "library") this.showLibraryScreen();
  }

  showLibraryScreen() {
    this._currentScreen = "library";
    this.screen.innerHTML = "";
    this.screen.appendChild(this._buildHistoryBar());

    // "Select all. Invert selection." Available from the Library screen
    // specifically, since that's what's showing whenever nothing (or
    // exactly one thing) is currently selected — the natural place to
    // reach for "actually, everything" or "everything except this."
    const selectionRow = document.createElement("div");
    selectionRow.className = "builder-phone-history-bar";
    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "builder-phone-small-button";
    selectAllBtn.textContent = "Select All";
    selectAllBtn.addEventListener("click", () => this.callbacks.onSelectAll());
    const invertBtn = document.createElement("button");
    invertBtn.type = "button";
    invertBtn.className = "builder-phone-small-button";
    invertBtn.textContent = "Invert Selection";
    invertBtn.addEventListener("click", () => this.callbacks.onInvertSelection());
    selectionRow.append(selectAllBtn, invertBtn);
    this.screen.appendChild(selectionRow);

    const tabs = document.createElement("div");
    tabs.className = "builder-phone-tabs";
    for (const [id, label] of [["construction", "Construction Library"], ["saved", "Saved Objects"], ["models", "Imported Models"], ["blueprints", "Blueprints"], ["terrain", "Terrain"]]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = id === this._activeTab ? "active" : "";
      btn.addEventListener("click", () => {
        if (this._activeTab === "terrain" && id !== "terrain") this.callbacks.onSetTerrainTool(null);
        this._activeTab = id;
        this.showLibraryScreen();
      });
      tabs.appendChild(btn);
    }
    this.screen.appendChild(tabs);

    if (this._activeTab === "terrain") {
      this.screen.appendChild(this._buildTerrainPanel());
      return;
    }

    if (this._activeTab === "models") this.screen.appendChild(this._buildImportModelRow());

    const grid = document.createElement("div");
    grid.className = "builder-phone-grid";
    const { constructionPieces, libraryDefinitions, importedModels, blueprints } = this._libraryData;
    const items = { construction: constructionPieces, saved: libraryDefinitions, models: importedModels, blueprints }[this._activeTab];
    const source = { construction: "construction", saved: "library", models: "importedModel", blueprints: "blueprint" }[this._activeTab];

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "builder-phone-empty";
      empty.textContent =
        this._activeTab === "models"
          ? "No models imported yet \u2014 import one above (.glb or .gltf)."
          : this._activeTab === "blueprints"
            ? "No Blueprints yet \u2014 select something you've built and choose \u201cSave as Blueprint.\u201d"
            : "Nothing designed yet — build one in the computer's Builder app.";
      grid.appendChild(empty);
      this.screen.appendChild(grid);
      return;
    }

    if (this._activeTab !== "construction") {
      const cardsGrid = document.createElement("div");
      cardsGrid.className = "builder-phone-cards-grid";
      for (const def of items) cardsGrid.appendChild(this._buildGridCard(def, source));
      grid.appendChild(cardsGrid);
      this.screen.appendChild(grid);
      return;
    }

    // "Please continue organising Builder assets into clear categories as
    // the library expands" — grouped section by section (Structural,
    // Openings, Nature, Paths, Lighting, Utilities, Workshop) rather than
    // one long undifferentiated grid, now that the catalog has grown well
    // past its original size.
    this.screen.appendChild(grid);
    const byGroup = new Map();
    for (const def of items) {
      const group = getConstructionGroup(def.id);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push(def);
    }
    for (const group of CONSTRUCTION_GROUP_ORDER) {
      const defs = byGroup.get(group);
      if (!defs?.length) continue;
      const heading = document.createElement("h4");
      heading.className = "builder-phone-group-heading";
      heading.textContent = group;
      grid.appendChild(heading);
      const groupGrid = document.createElement("div");
      groupGrid.className = "builder-phone-group-grid";
      for (const def of defs) groupGrid.appendChild(this._buildGridCard(def, source));
      grid.appendChild(groupGrid);
    }
  }

  _buildGridCard(def, source) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "builder-phone-card";
    const swatch = document.createElement("div");
    swatch.className = "builder-phone-card-swatch";
    swatch.style.background = def.parts?.[0]?.color ?? "#8d8577";
    const name = document.createElement("span");
    name.className = "builder-phone-card-name";
    name.textContent = def.name;
    const category = document.createElement("span");
    category.className = "builder-phone-card-category";
    category.textContent = def.category ?? "";
    card.append(swatch, name, category);
    card.addEventListener("click", () => this.callbacks.onArmDefinition(def.id, source));
    return card;
  }

  /** Workshop Workflow phase — "extend the Builder so imported models can
   *  be used as Builder shapes." A model imported here uses the exact
   *  same `.glb`/`.gltf` handling the Being Creator's own Model section
   *  already does (see `BuildModeSystem.importModel()`'s own comment) —
   *  this is just the missing front door for it, directly where a
   *  Builder-only session already is, rather than a detour through a
   *  different app. */
  _buildImportModelRow() {
    const row = document.createElement("div");
    row.className = "builder-phone-history-bar";

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "builder-phone-small-button";
    importBtn.textContent = "Import Model (.glb/.gltf)\u2026";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb,.gltf,model/gltf-binary,model/gltf+json";
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      importBtn.disabled = true;
      importBtn.textContent = "Importing\u2026";
      try {
        await this.callbacks.onImportModel(file);
      } catch (err) {
        console.error(err);
        window.alert("Couldn't import that file \u2014 make sure it's a valid .glb or .gltf model.");
      }
      importBtn.disabled = false;
      importBtn.textContent = "Import Model (.glb/.gltf)\u2026";
      input.value = "";
    });
    importBtn.addEventListener("click", () => input.click());

    row.append(importBtn, input);
    return row;
  }

  // -----------------------------------------------------------------
  // Screen: Ghost (placing or moving)
  // -----------------------------------------------------------------

  showGhostScreen(definition, confirmLabel, { allowRotate = true } = {}) {
    this._currentScreen = "ghost";
    this.screen.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = definition.name;
    this.screen.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "builder-phone-hint";
    // confirmLabel ("Place"/"Move here") used to label a button; now that
    // confirming is a left-click in the world instead (see
    // BuildModeSystem.js's own _handlePointerDown), it describes the
    // action in the hint text instead — the distinction between placing
    // something new and moving something that already exists is still
    // worth saying, just not as a button anymore.
    hint.textContent = allowRotate
      ? `Move your pointer (or drag, on touch) to position it, rotate (button, or scroll the mouse wheel) if you need to, then left-click in the world to ${confirmLabel.toLowerCase()}.`
      : `Move your pointer (or drag, on touch) to position the whole selection, then left-click in the world to ${confirmLabel.toLowerCase()}. Moving several objects together is translation-only \u2014 rotate them individually instead.`;
    this.screen.appendChild(hint);

    const snapRow = document.createElement("div");
    snapRow.className = "builder-phone-snap-row";
    const gridLabel = document.createElement("label");
    const gridCheckbox = document.createElement("input");
    gridCheckbox.type = "checkbox";
    gridCheckbox.checked = this.callbacks.getSnapToGrid();
    gridCheckbox.addEventListener("change", () => this.callbacks.onToggleSnapToGrid());
    gridLabel.append(gridCheckbox, " Snap to grid");
    snapRow.appendChild(gridLabel);
    if (allowRotate) {
      const rotationLabel = document.createElement("label");
      const rotationCheckbox = document.createElement("input");
      rotationCheckbox.type = "checkbox";
      rotationCheckbox.checked = this.callbacks.getSnapRotation();
      rotationCheckbox.addEventListener("change", () => this.callbacks.onToggleSnapRotation());
      rotationLabel.append(rotationCheckbox, " Snap rotation");
      snapRow.appendChild(rotationLabel);
    }
    this.screen.appendChild(snapRow);

    const actions = document.createElement("div");
    actions.className = "builder-phone-ghost-actions";

    if (allowRotate) {
      const rotateBtn = document.createElement("button");
      rotateBtn.type = "button";
      rotateBtn.className = "builder-phone-button";
      rotateBtn.textContent = "\u21BB Rotate";
      rotateBtn.addEventListener("click", () => this.callbacks.onRotateGhost());
      actions.appendChild(rotateBtn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "builder-phone-button builder-phone-button-danger";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.callbacks.onCancelGhost());
    actions.appendChild(cancelBtn);

    this.screen.appendChild(actions);
  }

  // -----------------------------------------------------------------
  // Screen: Selection (confirmed, not moving)
  // -----------------------------------------------------------------

  showSelectionScreen(selection) {
    this._currentScreen = "selection";
    this.screen.innerHTML = "";
    this.screen.appendChild(this._buildHistoryBar());

    const backRow = document.createElement("button");
    backRow.type = "button";
    backRow.className = "builder-phone-back";
    backRow.textContent = "\u2039 Back";
    backRow.addEventListener("click", () => this.callbacks.onDeselect());
    this.screen.appendChild(backRow);

    const title = document.createElement("h3");
    title.textContent = selection.definition.name;
    this.screen.appendChild(title);

    if (selection.groupName) {
      const groupNote = document.createElement("p");
      groupNote.className = "builder-phone-hint";
      groupNote.textContent = `Part of "${selection.groupName}" \u2014 selecting this selected the whole group.`;
      this.screen.appendChild(groupNote);
    }

    const measurement = this.callbacks.getMeasurement?.();
    if (measurement?.kind === "dimensions") {
      const dims = document.createElement("p");
      dims.className = "builder-phone-hint";
      dims.textContent = `${measurement.width.toFixed(2)}m wide \u00d7 ${measurement.height.toFixed(2)}m tall \u00d7 ${measurement.depth.toFixed(2)}m deep`;
      this.screen.appendChild(dims);
    }

    const isWorldObject = selection.kind === "worldObject";
    const position = isWorldObject ? selection.instance.position : selection.position;
    const rotationY = isWorldObject ? selection.instance.rotationY : selection.rotationY;

    const grid = document.createElement("div");
    grid.className = "builder-phone-fields";

    const positionRow = document.createElement("div");
    positionRow.className = "builder-phone-row";
    const positionLabel = document.createElement("span");
    positionLabel.textContent = "Position";
    positionRow.appendChild(positionLabel);
    ["x", "y", "z"].forEach((axis, index) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.05";
      input.value = position[index];
      input.addEventListener("input", () => {
        const next = [...position];
        next[index] = parseFloat(input.value) || 0;
        this.callbacks.onTransformChange({ position: next });
      });
      positionRow.appendChild(input);
    });
    grid.appendChild(positionRow);

    const rotRow = document.createElement("div");
    rotRow.className = "builder-phone-row";
    const rotLabel = document.createElement("span");
    rotLabel.textContent = "Rotation";
    const rotInput = document.createElement("input");
    rotInput.type = "range";
    rotInput.min = "0";
    rotInput.max = "360";
    rotInput.step = "1";
    rotInput.value = String(Math.round((rotationY * 180) / Math.PI));
    rotInput.addEventListener("input", () => {
      this.callbacks.onTransformChange({ rotationY: (parseFloat(rotInput.value) * Math.PI) / 180 });
    });
    rotRow.append(rotLabel, rotInput);
    grid.appendChild(rotRow);

    if (isWorldObject) {
      const scaleRow = document.createElement("div");
      scaleRow.className = "builder-phone-row";
      const scaleLabel = document.createElement("span");
      scaleLabel.textContent = "Scale";
      const scaleInput = document.createElement("input");
      scaleInput.type = "range";
      scaleInput.min = "0.2";
      scaleInput.max = "3";
      scaleInput.step = "0.05";
      scaleInput.value = String(selection.instance.scale);
      scaleInput.addEventListener("input", () => {
        this.callbacks.onTransformChange({ scale: parseFloat(scaleInput.value) || 1 });
      });
      scaleRow.append(scaleLabel, scaleInput);
      grid.appendChild(scaleRow);

      const colorRow = document.createElement("div");
      colorRow.className = "builder-phone-row";
      const colorLabel = document.createElement("span");
      colorLabel.textContent = "Colour";
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = selection.instance.colorOverride ?? "#8d8577";
      colorInput.addEventListener("input", () => this.callbacks.onColorOverrideChange(colorInput.value));
      const clearColorBtn = document.createElement("button");
      clearColorBtn.type = "button";
      clearColorBtn.className = "builder-phone-small-button";
      clearColorBtn.textContent = "Reset";
      clearColorBtn.addEventListener("click", () => this.callbacks.onColorOverrideChange(null));
      colorRow.append(colorLabel, colorInput, clearColorBtn);
      grid.appendChild(colorRow);
    }

    this.screen.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "builder-phone-ghost-actions";
    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "builder-phone-button builder-phone-button-primary";
    moveBtn.textContent = "Move";
    moveBtn.addEventListener("click", () => this.callbacks.onStartMove());
    actions.appendChild(moveBtn);

    if (isWorldObject) {
      const duplicateBtn = document.createElement("button");
      duplicateBtn.type = "button";
      duplicateBtn.className = "builder-phone-button";
      duplicateBtn.textContent = "Duplicate";
      duplicateBtn.addEventListener("click", () => this.callbacks.onDuplicate());
      actions.appendChild(duplicateBtn);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "builder-phone-button";
      copyBtn.textContent = "Copy Transform";
      copyBtn.title = "Remembers this object's own rotation and scale, to paste onto another";
      copyBtn.addEventListener("click", () => this.callbacks.onCopyTransform());
      actions.appendChild(copyBtn);

      const pasteBtn = document.createElement("button");
      pasteBtn.type = "button";
      pasteBtn.className = "builder-phone-button";
      pasteBtn.textContent = "Paste Transform";
      pasteBtn.addEventListener("click", () => this.callbacks.onPasteTransform());
      actions.appendChild(pasteBtn);

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "builder-phone-button";
      resetBtn.textContent = "Reset Transform";
      resetBtn.title = "Sets rotation and scale back to their defaults";
      resetBtn.addEventListener("click", () => this.callbacks.onResetTransform());
      actions.appendChild(resetBtn);

      const blueprintBtn = document.createElement("button");
      blueprintBtn.type = "button";
      blueprintBtn.className = "builder-phone-button";
      blueprintBtn.textContent = "Save as Blueprint";
      blueprintBtn.title = "Captures this and everything placed nearby as one reusable Blueprint";
      blueprintBtn.addEventListener("click", () => this.callbacks.onSaveAsBlueprint());
      actions.appendChild(blueprintBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "builder-phone-button builder-phone-button-danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => this.callbacks.onDelete());
      actions.appendChild(deleteBtn);
    } else if (selection.hasOverride) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "builder-phone-button";
      resetBtn.textContent = "Reset Position";
      resetBtn.addEventListener("click", () => this.callbacks.onResetFurniturePosition());
      actions.appendChild(resetBtn);
    }
    this.screen.appendChild(actions);
  }

  // -----------------------------------------------------------------
  // Screen: Multi-Selection — "working with many objects should become
  // comfortable." Deliberately simpler than the single-selection screen
  // (no per-object numeric fields — with several objects selected, whose
  // position would that even show?), just bulk actions over the whole
  // group at once.
  // -----------------------------------------------------------------

  showMultiSelectionScreen({ count, allWorldObjects, isSingleGroup, groupName }) {
    this._currentScreen = "multi";
    this.screen.innerHTML = "";
    this.screen.appendChild(this._buildHistoryBar());

    const backRow = document.createElement("button");
    backRow.type = "button";
    backRow.className = "builder-phone-back";
    backRow.textContent = "\u2039 Clear Selection";
    backRow.addEventListener("click", () => this.callbacks.onClearSelection());
    this.screen.appendChild(backRow);

    const title = document.createElement("h3");
    title.textContent = isSingleGroup ? `"${groupName}" (${count} objects)` : `${count} objects selected`;
    this.screen.appendChild(title);

    const measurement = this.callbacks.getMeasurement?.();
    if (measurement) {
      const measureText = document.createElement("p");
      measureText.className = "builder-phone-hint";
      measureText.textContent =
        measurement.kind === "distance"
          ? `${measurement.distance.toFixed(2)}m apart`
          : `Overall footprint: ${measurement.width.toFixed(2)}m \u00d7 ${measurement.height.toFixed(2)}m \u00d7 ${measurement.depth.toFixed(2)}m`;
      this.screen.appendChild(measureText);
    }

    if (!allWorldObjects) {
      const note = document.createElement("p");
      note.className = "builder-phone-hint";
      note.textContent = "Furniture can only be moved one piece at a time \u2014 grouping, duplicating, and aligning apply to Builder objects only.";
      this.screen.appendChild(note);
    }

    const groupHeading = document.createElement("h4");
    groupHeading.className = "builder-phone-group-heading";
    groupHeading.textContent = "Group";
    this.screen.appendChild(groupHeading);
    const groupRow = document.createElement("div");
    groupRow.className = "builder-phone-ghost-actions";
    if (isSingleGroup) {
      const ungroupBtn = document.createElement("button");
      ungroupBtn.type = "button";
      ungroupBtn.className = "builder-phone-button";
      ungroupBtn.textContent = "Ungroup";
      ungroupBtn.addEventListener("click", () => this.callbacks.onUngroupSelection());
      groupRow.appendChild(ungroupBtn);
    } else {
      const groupBtn = document.createElement("button");
      groupBtn.type = "button";
      groupBtn.className = "builder-phone-button";
      groupBtn.textContent = "Group";
      groupBtn.title = "Selecting any one member will always select the whole group";
      groupBtn.disabled = !allWorldObjects;
      groupBtn.addEventListener("click", () => this.callbacks.onGroupSelection());
      groupRow.appendChild(groupBtn);
    }
    this.screen.appendChild(groupRow);

    const bulkHeading = document.createElement("h4");
    bulkHeading.className = "builder-phone-group-heading";
    bulkHeading.textContent = "All Selected";
    this.screen.appendChild(bulkHeading);
    const bulkRow = document.createElement("div");
    bulkRow.className = "builder-phone-ghost-actions";
    const dupAllBtn = document.createElement("button");
    dupAllBtn.type = "button";
    dupAllBtn.className = "builder-phone-button";
    dupAllBtn.textContent = "Duplicate All";
    dupAllBtn.disabled = !allWorldObjects;
    dupAllBtn.addEventListener("click", () => this.callbacks.onDuplicateMultiple());
    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "builder-phone-button";
    pasteBtn.textContent = "Paste Transform";
    pasteBtn.disabled = !allWorldObjects;
    pasteBtn.addEventListener("click", () => this.callbacks.onPasteTransform());
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "builder-phone-button";
    resetBtn.textContent = "Reset Transforms";
    resetBtn.disabled = !allWorldObjects;
    resetBtn.addEventListener("click", () => this.callbacks.onResetTransform());
    const blueprintBtn = document.createElement("button");
    blueprintBtn.type = "button";
    blueprintBtn.className = "builder-phone-button";
    blueprintBtn.textContent = "Save as Blueprint";
    blueprintBtn.title = `Captures exactly these ${count} objects`;
    blueprintBtn.disabled = !allWorldObjects;
    blueprintBtn.addEventListener("click", () => this.callbacks.onSaveMultipleAsBlueprint());
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.type = "button";
    deleteAllBtn.className = "builder-phone-button builder-phone-button-danger";
    deleteAllBtn.textContent = "Delete All";
    deleteAllBtn.disabled = !allWorldObjects;
    deleteAllBtn.addEventListener("click", () => this.callbacks.onDeleteMultiple());
    bulkRow.append(dupAllBtn, pasteBtn, resetBtn, blueprintBtn, deleteAllBtn);
    this.screen.appendChild(bulkRow);

    if (allWorldObjects) {
      const alignHeading = document.createElement("h4");
      alignHeading.className = "builder-phone-group-heading";
      alignHeading.textContent = "Align";
      this.screen.appendChild(alignHeading);
      this.screen.appendChild(this._buildAlignRow("X (left \u2194 right)", "x"));
      this.screen.appendChild(this._buildAlignRow("Y (bottom \u2194 top)", "y"));
      this.screen.appendChild(this._buildAlignRow("Z (near \u2194 far)", "z"));

      if (count >= 3) {
        const distHeading = document.createElement("h4");
        distHeading.className = "builder-phone-group-heading";
        distHeading.textContent = "Distribute Evenly";
        this.screen.appendChild(distHeading);
        const distRow = document.createElement("div");
        distRow.className = "builder-phone-ghost-actions";
        for (const [axis, label] of [["x", "X"], ["y", "Y"], ["z", "Z"]]) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "builder-phone-small-button";
          btn.textContent = label;
          btn.addEventListener("click", () => this.callbacks.onDistribute(axis));
          distRow.appendChild(btn);
        }
        this.screen.appendChild(distRow);
      }
    }
  }

  _buildAlignRow(label, axis) {
    const row = document.createElement("div");
    row.className = "builder-phone-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    row.appendChild(labelEl);
    const buttons = document.createElement("div");
    buttons.className = "builder-phone-align-buttons";
    for (const [mode, glyph] of [["min", "\u21E4"], ["center", "\u2194"], ["max", "\u21E5"]]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "builder-phone-small-button";
      btn.textContent = glyph;
      btn.addEventListener("click", () => this.callbacks.onAlign(axis, mode));
      buttons.appendChild(btn);
    }
    row.appendChild(buttons);
    return row;
  }

  // -----------------------------------------------------------------
  // Terrain panel — "terrain editing should feel natural, responsive and
  // easy to control." Choosing a tool, brush size, brush strength, or
  // paint material all immediately call `onSetTerrainTool()` with the
  // *complete* current tool description — BuildModeSystem itself never
  // needs to remember a partial tool state across separate calls.
  // Sculpting/painting itself happens directly in the 3D world (click and
  // drag), not through this panel at all — the panel only ever describes
  // *which* tool a click-and-drag currently means.
  // -----------------------------------------------------------------

  _pushTerrainTool() {
    const tool = { type: this._terrainToolType, radius: this._terrainRadius, strength: this._terrainStrength };
    if (this._terrainToolType === "paint") tool.materialId = this._terrainMaterialId;
    this.callbacks.onSetTerrainTool(tool);
  }

  _buildTerrainPanel() {
    const wrap = document.createElement("div");

    const hint = document.createElement("p");
    hint.className = "builder-phone-hint";
    hint.textContent = "Click and drag anywhere on the ground to sculpt or paint with the tool selected below.";
    wrap.appendChild(hint);

    const shapeHeading = document.createElement("h4");
    shapeHeading.className = "builder-phone-group-heading";
    shapeHeading.textContent = "Shape";
    wrap.appendChild(shapeHeading);
    const shapeRow = document.createElement("div");
    shapeRow.className = "builder-phone-ghost-actions";
    for (const [type, label] of [["raise", "Raise"], ["lower", "Lower"], ["flatten", "Flatten"], ["smooth", "Smooth"], ["terrace", "Terrace"]]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = type === this._terrainToolType ? "builder-phone-button builder-phone-button-primary" : "builder-phone-button";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        this._terrainToolType = type;
        this._pushTerrainTool();
        this.showLibraryScreen();
      });
      shapeRow.appendChild(btn);
    }
    wrap.appendChild(shapeRow);

    const paintHeading = document.createElement("h4");
    paintHeading.className = "builder-phone-group-heading";
    paintHeading.textContent = "Paint";
    wrap.appendChild(paintHeading);
    const paintRow = document.createElement("div");
    paintRow.className = "builder-phone-ghost-actions";
    for (const material of TERRAIN_MATERIALS) {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = this._terrainToolType === "paint" && this._terrainMaterialId === material.id;
      btn.className = isActive ? "builder-phone-button builder-phone-button-primary" : "builder-phone-button";
      btn.textContent = material.label;
      btn.style.borderLeft = `4px solid ${material.color}`;
      btn.addEventListener("click", () => {
        this._terrainToolType = "paint";
        this._terrainMaterialId = material.id;
        this._pushTerrainTool();
        this.showLibraryScreen();
      });
      paintRow.appendChild(btn);
    }
    wrap.appendChild(paintRow);

    const brushHeading = document.createElement("h4");
    brushHeading.className = "builder-phone-group-heading";
    brushHeading.textContent = "Brush";
    wrap.appendChild(brushHeading);
    // Workshop Reliability phase — the terrain grid eased from 1m to 2m
    // resolution (see TerrainSystem.js's own top comment on why) as part
    // of retiring the old small, separately-layered patch. A brush
    // radius below the grid's own spacing could miss every vertex
    // entirely depending on exactly where its centre landed — the
    // minimum here moved from 1m to 2m to match, so "Size" always does
    // something visible at every value on the slider.
    wrap.appendChild(this._terrainSliderRow("Size", this._terrainRadius, 2, 12, 0.5, (v) => (v.toFixed(1) + "m"), (v) => { this._terrainRadius = v; this._pushTerrainTool(); }));
    wrap.appendChild(this._terrainSliderRow("Strength", this._terrainStrength, 0.05, 1.5, 0.05, (v) => v.toFixed(2), (v) => { this._terrainStrength = v; this._pushTerrainTool(); }));

    // Activating the panel always (re)pushes the currently-configured
    // tool immediately, so opening the Terrain tab is itself enough to
    // start sculpting — no separate "activate" step to remember.
    this._pushTerrainTool();
    return wrap;
  }

  _terrainSliderRow(label, value, min, max, step, format, onChange) {
    const row = document.createElement("div");
    row.className = "panel-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const valueEl = document.createElement("span");
    valueEl.className = "settings-range-value";
    valueEl.textContent = format(value);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      valueEl.textContent = format(v);
      onChange(v);
    });
    row.append(labelEl, input, valueEl);
    return row;
  }
}
