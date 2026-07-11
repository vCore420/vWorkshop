/**
 * BuilderPhoneUI
 * ----------------
 * "A Workshop 'Builder Phone' should smoothly slide up from the
 * lower-right corner... the rest of the Workshop should remain visible
 * throughout." This is the DOM half of Build Mode — a single small panel,
 * never a full-screen takeover, replacing the old bottom-docked library
 * strip and side-docked property panel with one object that reads as a
 * physical device you've taken out, not a separate editing application.
 * `BuildModeSystem` owns all the actual state (what's armed, what's
 * selected, what's mid-ghost); this class only ever renders whatever
 * state it's handed and reports interactions back via plain callbacks —
 * the same shape every overlay/app in this codebase already uses.
 *
 * Three screens, swapped in and out of the same phone shell rather than
 * three separate panels:
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
export class BuilderPhoneUI {
  constructor(rootEl, callbacks) {
    this.root = rootEl;
    this.callbacks = callbacks;
    this._libraryData = { constructionPieces: [], libraryDefinitions: [] };
    this._activeTab = "construction";

    this.phone = document.createElement("div");
    this.phone.className = "builder-phone";
    this.root.appendChild(this.phone);

    const header = document.createElement("div");
    header.className = "builder-phone-header";
    header.textContent = "Builder";
    this.phone.appendChild(header);

    this.screen = document.createElement("div");
    this.screen.className = "builder-phone-screen";
    this.phone.appendChild(this.screen);

    this.root.classList.add("hidden");
  }

  show() {
    this.root.classList.remove("hidden");
    // Applying "open" a frame later, rather than immediately, is what
    // makes the slide-up an actual transition rather than an instant
    // jump — the phone needs to render off-screen for one frame first.
    requestAnimationFrame(() => this.phone.classList.add("open"));
  }

  hide() {
    this.phone.classList.remove("open");
    // Wait for the slide-down transition to actually finish before pulling
    // the root out of the layout entirely — matching how OverlayManager's
    // own close does the same thing for its fade-out.
    setTimeout(() => this.root.classList.add("hidden"), 350);
  }

  // -----------------------------------------------------------------
  // Screen: Library
  // -----------------------------------------------------------------

  renderLibrary(constructionPieces, libraryDefinitions, importedModels = []) {
    this._libraryData = { constructionPieces, libraryDefinitions, importedModels };
    if (this._currentScreen === "library") this.showLibraryScreen();
  }

  showLibraryScreen() {
    this._currentScreen = "library";
    this.screen.innerHTML = "";

    const tabs = document.createElement("div");
    tabs.className = "builder-phone-tabs";
    for (const [id, label] of [["construction", "Construction Library"], ["saved", "Saved Objects"], ["models", "Imported Models"]]) {
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
    const { constructionPieces, libraryDefinitions, importedModels } = this._libraryData;
    const items = this._activeTab === "construction" ? constructionPieces : this._activeTab === "saved" ? libraryDefinitions : importedModels;
    const source = this._activeTab === "construction" ? "construction" : this._activeTab === "saved" ? "library" : "importedModel";

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "builder-phone-empty";
      empty.textContent =
        this._activeTab === "models"
          ? "No models imported yet \u2014 import one in the Being Creator's own Model section."
          : "Nothing designed yet — build one in the computer's Builder app.";
      grid.appendChild(empty);
    } else {
      for (const def of items) grid.appendChild(this._buildGridCard(def, source));
    }
    this.screen.appendChild(grid);
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
    hint.textContent = `Move your pointer (or drag, on touch) to position it, rotate if you need to, then left-click in the world to ${confirmLabel.toLowerCase()}.`;
    this.screen.appendChild(hint);

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
