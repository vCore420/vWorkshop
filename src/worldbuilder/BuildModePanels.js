/**
 * BuildModePanels
 * ----------------
 * The DOM half of Build Mode: a library strip docked to the bottom of the
 * screen, and a small property panel docked to the side when something's
 * selected. Deliberately not a full editor UI — see docs/WORLDBUILDER.md's
 * "why Build Mode looks like this" section. `BuildModeSystem` owns all the
 * actual state (what's selected, what's armed for placement); this class
 * only renders whatever state it's handed and reports clicks back via
 * plain callbacks, the same shape every overlay/app in this codebase uses.
 */
export class BuildModePanels {
  constructor(rootEl, callbacks) {
    this.root = rootEl;
    this.callbacks = callbacks;

    this.hintBar = document.createElement("div");
    this.hintBar.className = "buildmode-hint";
    this.root.appendChild(this.hintBar);

    this.libraryStrip = document.createElement("div");
    this.libraryStrip.className = "buildmode-library";
    this.root.appendChild(this.libraryStrip);

    this.propertyPanel = document.createElement("div");
    this.propertyPanel.className = "buildmode-properties";
    this.root.appendChild(this.propertyPanel);

    this.root.classList.add("hidden");
  }

  show() {
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }

  setHint(text) {
    this.hintBar.textContent = text;
  }

  renderLibrary(constructionPieces, libraryDefinitions, armedDefinitionId, armedSource) {
    this.libraryStrip.innerHTML = "";

    const constructionSection = document.createElement("div");
    constructionSection.className = "buildmode-library-section";
    const constructionLabel = document.createElement("div");
    constructionLabel.className = "buildmode-library-label";
    constructionLabel.textContent = "Construction";
    const constructionRow = document.createElement("div");
    constructionRow.className = "buildmode-library-row";
    for (const def of constructionPieces) {
      constructionRow.appendChild(this._buildChip(def, "construction", armedDefinitionId, armedSource));
    }
    constructionSection.append(constructionLabel, constructionRow);
    this.libraryStrip.appendChild(constructionSection);

    const librarySection = document.createElement("div");
    librarySection.className = "buildmode-library-section";
    const libraryLabel = document.createElement("div");
    libraryLabel.className = "buildmode-library-label";
    libraryLabel.textContent = "Your objects";
    const libraryRow = document.createElement("div");
    libraryRow.className = "buildmode-library-row";
    if (libraryDefinitions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "buildmode-library-empty";
      empty.textContent = "Nothing designed yet — build one in the computer's Builder app.";
      libraryRow.appendChild(empty);
    } else {
      for (const def of libraryDefinitions) {
        libraryRow.appendChild(this._buildChip(def, "library", armedDefinitionId, armedSource));
      }
    }
    librarySection.append(libraryLabel, libraryRow);
    this.libraryStrip.appendChild(librarySection);
  }

  _buildChip(def, source, armedDefinitionId, armedSource) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "buildmode-chip";
    if (def.id === armedDefinitionId && source === armedSource) chip.classList.add("armed");
    chip.innerHTML = `<span class="chip-name">${escapeHtml(def.name)}</span><span class="chip-category">${escapeHtml(def.category)}</span>`;
    chip.addEventListener("click", () => this.callbacks.onArmDefinition(def.id, source));
    return chip;
  }

  renderSelection(instance, definition) {
    this.propertyPanel.innerHTML = "";
    if (!instance || !definition) {
      this.propertyPanel.classList.remove("visible");
      return;
    }
    this.propertyPanel.classList.add("visible");

    const title = document.createElement("h3");
    title.textContent = definition.name;
    this.propertyPanel.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "buildmode-grid";

    const positionRow = (axis, index) => {
      const label = document.createElement("label");
      label.textContent = axis.toUpperCase();
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.05";
      input.value = instance.position[index];
      input.addEventListener("input", () => {
        const next = [...instance.position];
        next[index] = parseFloat(input.value) || 0;
        this.callbacks.onTransformChange({ position: next });
      });
      label.appendChild(input);
      return label;
    };
    const posGroup = document.createElement("div");
    posGroup.className = "buildmode-row";
    const posCaption = document.createElement("span");
    posCaption.textContent = "Position";
    posGroup.append(posCaption, positionRow("x", 0), positionRow("y", 1), positionRow("z", 2));
    grid.appendChild(posGroup);

    const rotRow = document.createElement("div");
    rotRow.className = "buildmode-row";
    const rotCaption = document.createElement("span");
    rotCaption.textContent = "Rotation";
    const rotInput = document.createElement("input");
    rotInput.type = "range";
    rotInput.min = "0";
    rotInput.max = "360";
    rotInput.step = "1";
    rotInput.value = String(Math.round((instance.rotationY * 180) / Math.PI));
    rotInput.addEventListener("input", () => {
      this.callbacks.onTransformChange({ rotationY: (parseFloat(rotInput.value) * Math.PI) / 180 });
    });
    rotRow.append(rotCaption, rotInput);
    grid.appendChild(rotRow);

    const scaleRow = document.createElement("div");
    scaleRow.className = "buildmode-row";
    const scaleCaption = document.createElement("span");
    scaleCaption.textContent = "Scale";
    const scaleInput = document.createElement("input");
    scaleInput.type = "range";
    scaleInput.min = "0.2";
    scaleInput.max = "3";
    scaleInput.step = "0.05";
    scaleInput.value = String(instance.scale);
    scaleInput.addEventListener("input", () => {
      this.callbacks.onTransformChange({ scale: parseFloat(scaleInput.value) || 1 });
    });
    scaleRow.append(scaleCaption, scaleInput);
    grid.appendChild(scaleRow);

    const colorRow = document.createElement("div");
    colorRow.className = "buildmode-row";
    const colorCaption = document.createElement("span");
    colorCaption.textContent = "Colour";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = instance.colorOverride ?? "#8d8577";
    colorInput.addEventListener("input", () => this.callbacks.onColorOverrideChange(colorInput.value));
    const clearColorBtn = document.createElement("button");
    clearColorBtn.type = "button";
    clearColorBtn.textContent = "Reset";
    clearColorBtn.addEventListener("click", () => this.callbacks.onColorOverrideChange(null));
    colorRow.append(colorCaption, colorInput, clearColorBtn);
    grid.appendChild(colorRow);

    this.propertyPanel.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "buildmode-actions";
    const duplicateBtn = document.createElement("button");
    duplicateBtn.textContent = "Duplicate";
    duplicateBtn.addEventListener("click", () => this.callbacks.onDuplicate());
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "buildmode-delete";
    deleteBtn.addEventListener("click", () => this.callbacks.onDelete());
    actions.append(duplicateBtn, deleteBtn);
    this.propertyPanel.appendChild(actions);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
