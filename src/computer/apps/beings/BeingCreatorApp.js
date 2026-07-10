import { PreviewRenderer } from "../builder/PreviewRenderer.js";
import { MOVEMENT_STYLES, IDLE_BEHAVIOURS, AWARENESS_MODES, INTERACTION_BEHAVIOURS, BEING_TYPES } from "../../../beings/BeingBehaviours.js";

/**
 * createBeingCreatorApp
 * ------------------------
 * "This should become the Workshop's creature creation workspace...
 * clean, comfortable, simple, persistent." The exact same two-pane shape
 * `BuilderApp.js` already established — `.builder-workspace`/
 * `.builder-workspace-preview`/`.builder-workspace-form`, the same
 * `PreviewRenderer` widget reused unchanged (it was already written
 * generically enough that "preview whatever object3D you're handed"
 * needed nothing Being-specific added to it) — "follow the same design
 * philosophy as the Builder, Animation and Player editors" is closer to
 * a literal instruction than a stylistic suggestion here.
 *
 * Like Builder, this edits one in-memory *draft* at a time — nothing
 * reaches `BeingLibrary` until "Save to Library" is pressed, so trying
 * things costs nothing. "Creating a Being should not automatically place
 * it into the world" is true by construction: this file never touches
 * `BeingInstanceStore` at all, only `BeingSpawnerApp.js` does.
 */
export function createBeingCreatorApp({ beingLibrary, modelLibrary, modelAssetStore, modelLoader, animationLibraryStore }) {
  return {
    id: "beingCreator",
    label: "Being Creator",
    glyph: "\uD83E\uDDDC",
    mount(container) {
      let draft = freshDraft();
      let editingId = null;

      const workspace = document.createElement("div");
      workspace.className = "builder-workspace";
      container.appendChild(workspace);

      const previewPane = document.createElement("div");
      previewPane.className = "builder-workspace-preview";
      const formPane = document.createElement("div");
      formPane.className = "builder-workspace-form";
      workspace.append(previewPane, formPane);

      const preview = new PreviewRenderer(previewPane, { lookAtHeight: 0.5, distance: 2.6 });

      async function refreshPreview() {
        const model = draft.modelId ? await modelLoader.load(draft.modelId) : null;
        const object3D = model ?? modelLoader.buildPlaceholder();
        object3D.scale.setScalar(draft.scale);
        preview.setObject(object3D);
      }

      function loadIntoDraft(being) {
        draft = { ...being, tags: [...being.tags] };
        editingId = being.id;
        refreshPreview();
        renderAll();
      }

      function newDraft() {
        draft = freshDraft();
        editingId = null;
        refreshPreview();
        renderAll();
      }

      function saveDraft() {
        if (editingId) {
          beingLibrary.update(editingId, draftPatch(draft));
        } else {
          const created = beingLibrary.create(draft.name);
          beingLibrary.update(created.id, draftPatch(draft));
          editingId = created.id;
        }
        renderAll();
      }

      function renderAll() {
        formPane.innerHTML = "";
        formPane.appendChild(buildLibrarySection(beingLibrary, editingId, loadIntoDraft, newDraft, renderAll));
        formPane.appendChild(buildIdentitySection(draft, renderAll));
        formPane.appendChild(buildModelSection(draft, modelLibrary, modelAssetStore, renderAll, refreshPreview));
        formPane.appendChild(buildMovementSection(draft, renderAll));
        formPane.appendChild(buildAnimationSection(draft, animationLibraryStore, renderAll));
        formPane.appendChild(buildActionsSection(editingId, saveDraft));
      }

      refreshPreview();
      renderAll();

      return () => preview.dispose();
    },
  };
}

function freshDraft() {
  return {
    name: "New Being",
    description: "",
    beingType: "custom",
    tags: [],
    modelId: null,
    scale: 1,
    movementStyle: "static",
    idleBehaviour: "stand",
    walkSpeed: 1.2,
    turnSpeed: 2.5,
    homeRadius: 2.5,
    awarenessMode: "ignorePlayer",
    interactionBehaviour: "none",
    idleAnimationClipId: null,
    walkAnimationClipId: null,
  };
}

function draftPatch(draft) {
  const { name: _n, ...rest } = draft;
  return { name: draft.name, ...rest };
}

// ---------------------------------------------------------------------
// Library section — "Create, Save, Edit, Duplicate, Rename, Delete,
// Export, Import." The same list-with-inline-actions shape
// AIApp.js's own Profiles section already established for a similarly
// "several saved things, pick one to edit" screen.
// ---------------------------------------------------------------------
function buildLibrarySection(beingLibrary, editingId, onLoad, onNew, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section builder-library";
  const heading = document.createElement("h3");
  heading.textContent = "Beings";
  section.appendChild(heading);

  const actions = document.createElement("div");
  actions.className = "builder-library-controls";
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "builder-primary";
  newBtn.textContent = "New Being";
  newBtn.addEventListener("click", onNew);
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "builder-small-button";
  importBtn.textContent = "Import\u2026";
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.style.display = "none";
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      beingLibrary.importDefinition(await file.text());
      onChange();
    } catch (err) {
      window.alert(err.message || "Couldn't import that Being.");
    }
    importInput.value = "";
  });
  importBtn.addEventListener("click", () => importInput.click());
  actions.append(newBtn, importBtn, importInput);
  section.appendChild(actions);

  const list = document.createElement("ul");
  list.className = "builder-library-list";
  for (const being of beingLibrary.all()) {
    list.appendChild(buildLibraryRow(being, being.id === editingId, beingLibrary, onLoad, onChange));
  }
  if (beingLibrary.all().length === 0) {
    const empty = document.createElement("p");
    empty.className = "app-subtitle";
    empty.textContent = "No Beings yet \u2014 start one above.";
    list.appendChild(empty);
  }
  section.appendChild(list);
  return section;
}

function buildLibraryRow(being, isSelected, beingLibrary, onLoad, onChange) {
  const li = document.createElement("li");
  if (isSelected) li.classList.add("selected");

  const meta = document.createElement("span");
  meta.className = "builder-library-meta";
  meta.textContent = being.name;
  meta.style.cursor = "pointer";
  meta.addEventListener("click", () => onLoad(being));
  li.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "builder-inline-row";

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "builder-icon-button";
  renameBtn.textContent = "Rename";
  renameBtn.addEventListener("click", () => {
    const name = window.prompt("Rename this Being:", being.name);
    if (name) {
      beingLibrary.rename(being.id, name);
      onChange();
    }
  });

  const dupBtn = document.createElement("button");
  dupBtn.type = "button";
  dupBtn.className = "builder-icon-button";
  dupBtn.textContent = "Duplicate";
  dupBtn.addEventListener("click", () => {
    beingLibrary.duplicate(being.id);
    onChange();
  });

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "builder-icon-button";
  exportBtn.textContent = "Export";
  exportBtn.addEventListener("click", () => {
    const json = beingLibrary.exportDefinition(being.id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${being.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "being"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "builder-icon-button";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    if (window.confirm(`Delete "${being.name}"? This can't be undone.`)) {
      beingLibrary.remove(being.id);
      onChange();
    }
  });

  actions.append(renameBtn, dupBtn, exportBtn, deleteBtn);
  li.appendChild(actions);
  return li;
}

// ---------------------------------------------------------------------
// Identity — Name, Description, Being Type, Tags
// ---------------------------------------------------------------------
function buildIdentitySection(draft, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Identity"));
  section.appendChild(textRow("Name", draft.name, (v) => { draft.name = v; onChange(); }));
  section.appendChild(textareaRow("Description", draft.description, (v) => { draft.description = v; }));
  section.appendChild(selectRow("Being Type", draft.beingType, BEING_TYPES, (v) => { draft.beingType = v; }));
  const typeHint = document.createElement("p");
  typeHint.className = "app-subtitle";
  typeHint.textContent = "For organisation only \u2014 doesn't change how a Being actually behaves.";
  section.appendChild(typeHint);
  section.appendChild(textRow("Tags (comma separated)", draft.tags.join(", "), (v) => {
    draft.tags = v.split(",").map((t) => t.trim()).filter(Boolean);
  }));
  return section;
}

// ---------------------------------------------------------------------
// Model — "Import models, save imported models, rename, delete, preview"
// ---------------------------------------------------------------------
function buildModelSection(draft, modelLibrary, modelAssetStore, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Model"));

  const models = modelLibrary.all();
  const row = document.createElement("div");
  row.className = "panel-row";
  const label = document.createElement("label");
  label.textContent = "Model";
  const select = document.createElement("select");
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = models.length ? "\u2014 no model (placeholder) \u2014" : "No models imported yet";
  select.appendChild(noneOpt);
  for (const model of models) {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.textContent = model.name;
    if (draft.modelId === model.id) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    draft.modelId = select.value || null;
    onPreviewChange();
    onChange();
  });
  row.append(label, select);
  section.appendChild(row);

  if (draft.modelId) {
    const currentModel = modelLibrary.get(draft.modelId);
    const modelActions = document.createElement("div");
    modelActions.className = "builder-inline-row";
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "builder-icon-button";
    renameBtn.textContent = "Rename Model";
    renameBtn.addEventListener("click", () => {
      const name = window.prompt("Rename this model:", currentModel?.name ?? "");
      if (name) {
        modelLibrary.rename(draft.modelId, name);
        onChange();
      }
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "builder-icon-button";
    deleteBtn.textContent = "Delete Model";
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm(`Delete the model "${currentModel?.name}"? Any Being using it will fall back to the placeholder shape.`)) return;
      await modelAssetStore.remove(draft.modelId);
      modelLibrary.remove(draft.modelId);
      draft.modelId = null;
      onPreviewChange();
      onChange();
    });
    modelActions.append(renameBtn, deleteBtn);
    section.appendChild(modelActions);
  }

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "builder-small-button";
  importBtn.textContent = "Import Model (.glb/.gltf)\u2026";
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = ".glb,.gltf,model/gltf-binary,model/gltf+json";
  importInput.style.display = "none";
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const isGltf = file.name.toLowerCase().endsWith(".gltf");
    try {
      const data = isGltf ? await file.text() : await file.arrayBuffer();
      const modelId = modelLibrary.add(file.name.replace(/\.(glb|gltf)$/i, ""), isGltf ? "gltf" : "glb");
      await modelAssetStore.put(modelId, data);
      draft.modelId = modelId;
      onPreviewChange();
      onChange();
    } catch {
      window.alert("Couldn't import that file \u2014 make sure it's a valid .glb or .gltf model.");
    }
    importInput.value = "";
  });
  importBtn.addEventListener("click", () => importInput.click());
  section.appendChild(importBtn);
  section.appendChild(importInput);

  section.appendChild(sliderRow("Scale", draft.scale, 0.1, 5, 0.05, (v) => { draft.scale = v; onPreviewChange(); }, (v) => v.toFixed(2) + "\u00d7"));
  return section;
}

// ---------------------------------------------------------------------
// Movement & Behaviour
// ---------------------------------------------------------------------
function buildMovementSection(draft, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Behaviour"));

  section.appendChild(selectRow("Movement Style", draft.movementStyle, MOVEMENT_STYLES, (v) => { draft.movementStyle = v; onChange(); }));
  const movementDef = MOVEMENT_STYLES.find((m) => m.id === draft.movementStyle);
  if (movementDef) {
    const desc = document.createElement("p");
    desc.className = "app-subtitle";
    desc.textContent = movementDef.description;
    section.appendChild(desc);
  }
  section.appendChild(selectRow("Idle Behaviour", draft.idleBehaviour, IDLE_BEHAVIOURS, (v) => { draft.idleBehaviour = v; }));
  section.appendChild(selectRow("Awareness", draft.awarenessMode, AWARENESS_MODES, (v) => { draft.awarenessMode = v; }));
  section.appendChild(selectRow("Interaction", draft.interactionBehaviour, INTERACTION_BEHAVIOURS, (v) => { draft.interactionBehaviour = v; }));

  if (draft.movementStyle !== "static") {
    section.appendChild(sliderRow("Walk Speed", draft.walkSpeed, 0.2, 4, 0.1, (v) => { draft.walkSpeed = v; }, (v) => v.toFixed(1) + " m/s"));
    section.appendChild(sliderRow("Turn Speed", draft.turnSpeed, 0.5, 6, 0.1, (v) => { draft.turnSpeed = v; }, (v) => v.toFixed(1)));
  }
  section.appendChild(sliderRow("Home Radius", draft.homeRadius, 0.5, 8, 0.25, (v) => { draft.homeRadius = v; }, (v) => v.toFixed(2) + " m"));
  const homeHint = document.createElement("p");
  homeHint.className = "app-subtitle";
  homeHint.textContent = "How far this Being will naturally wander from wherever it's placed \u2014 set when placing it in the Being Spawner.";
  section.appendChild(homeHint);
  return section;
}

// ---------------------------------------------------------------------
// Animation Integration — "Beings should simply reference Workshop
// animation assets... avoid duplicating animation systems."
// ---------------------------------------------------------------------
function buildAnimationSection(draft, animationLibraryStore, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Animation"));
  const hint = document.createElement("p");
  hint.className = "app-subtitle";
  hint.textContent = "References clips from the shared Animation Library \u2014 the same one the Player Animation Editor edits.";
  section.appendChild(hint);

  const clips = animationLibraryStore?.all?.() ?? [];
  const clipOptions = [["", "\u2014 none \u2014"], ...clips.map((c) => [c.id, c.name])];
  section.appendChild(selectRow("Idle Animation", draft.idleAnimationClipId ?? "", clipOptions, (v) => { draft.idleAnimationClipId = v || null; onChange(); }));
  section.appendChild(selectRow("Walk Animation", draft.walkAnimationClipId ?? "", clipOptions, (v) => { draft.walkAnimationClipId = v || null; onChange(); }));
  return section;
}

function buildActionsSection(editingId, onSave) {
  const section = document.createElement("div");
  section.className = "builder-section";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "builder-primary";
  saveBtn.textContent = editingId ? "Save Changes" : "Save to Library";
  saveBtn.addEventListener("click", onSave);
  section.appendChild(saveBtn);
  return section;
}

// ---------------------------------------------------------------------
// Small field helpers — matching AIApp.js's own established shapes
// ---------------------------------------------------------------------
function sectionHeading(text) {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function textRow(label, value, onChange) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.addEventListener("change", () => onChange(input.value));
  row.append(labelEl, input);
  return row;
}

function textareaRow(label, value, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "ai-textarea-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const textarea = document.createElement("textarea");
  textarea.value = value ?? "";
  textarea.rows = 2;
  textarea.addEventListener("change", () => onChange(textarea.value));
  wrap.append(labelEl, textarea);
  return wrap;
}

function sliderRow(label, value, min, max, step, onChange, format) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const labelEl = document.createElement("label");
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

function selectRow(label, value, options, onChange) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const select = document.createElement("select");
  for (const opt of options) {
    const [optId, optLabel] = Array.isArray(opt) ? opt : [opt.id, opt.label];
    const optionEl = document.createElement("option");
    optionEl.value = optId;
    optionEl.textContent = optLabel;
    if (optId === value) optionEl.selected = true;
    select.appendChild(optionEl);
  }
  select.addEventListener("change", () => onChange(select.value));
  row.append(labelEl, select);
  return row;
}
