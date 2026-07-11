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

export class BuilderPhoneUI {
  constructor(rootEl, callbacks) {
    this.callbacks = callbacks;
    this._libraryData = { constructionPieces: [], libraryDefinitions: [] };
    this._activeTab = "construction";

    // The Phone's own content container, handed straight in — no shell
    // of this class's own to build around it any more.
    this.screen = rootEl;
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

    const tabs = document.createElement("div");
    tabs.className = "builder-phone-tabs";
    for (const [id, label] of [["construction", "Construction Library"], ["saved", "Saved Objects"], ["models", "Imported Models"], ["blueprints", "Blueprints"]]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = id === this._activeTab ? "active" : "";
      btn.addEventListener("click", () => {
        this._activeTab = id;
        this.showLibraryScreen();
      });
      tabs.appendChild(btn);
    }
    this.screen.appendChild(tabs);

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
          ? "No models imported yet \u2014 import one in the Being Creator's own Model section."
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

  // -----------------------------------------------------------------
  // Screen: Ghost (placing or moving)
  // -----------------------------------------------------------------

  showGhostScreen(definition, confirmLabel) {
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
    hint.textContent = `Move your pointer (or drag, on touch) to position it, rotate (button, or scroll the mouse wheel) if you need to, then left-click in the world to ${confirmLabel.toLowerCase()}.`;
    this.screen.appendChild(hint);

    const snapRow = document.createElement("div");
    snapRow.className = "builder-phone-snap-row";
    const gridLabel = document.createElement("label");
    const gridCheckbox = document.createElement("input");
    gridCheckbox.type = "checkbox";
    gridCheckbox.checked = this.callbacks.getSnapToGrid();
    gridCheckbox.addEventListener("change", () => this.callbacks.onToggleSnapToGrid());
    gridLabel.append(gridCheckbox, " Snap to grid");
    const rotationLabel = document.createElement("label");
    const rotationCheckbox = document.createElement("input");
    rotationCheckbox.type = "checkbox";
    rotationCheckbox.checked = this.callbacks.getSnapRotation();
    rotationCheckbox.addEventListener("change", () => this.callbacks.onToggleSnapRotation());
    rotationLabel.append(rotationCheckbox, " Snap rotation");
    snapRow.append(gridLabel, rotationLabel);
    this.screen.appendChild(snapRow);

    const actions = document.createElement("div");
    actions.className = "builder-phone-ghost-actions";

    const rotateBtn = document.createElement("button");
    rotateBtn.type = "button";
    rotateBtn.className = "builder-phone-button";
    rotateBtn.textContent = "\u21BB Rotate";
    rotateBtn.addEventListener("click", () => this.callbacks.onRotateGhost());
    actions.appendChild(rotateBtn);

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

    const backRow = document.createElement("button");
    backRow.type = "button";
    backRow.className = "builder-phone-back";
    backRow.textContent = "\u2039 Back";
    backRow.addEventListener("click", () => this.callbacks.onDeselect());
    this.screen.appendChild(backRow);

    const title = document.createElement("h3");
    title.textContent = selection.definition.name;
    this.screen.appendChild(title);

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
}
