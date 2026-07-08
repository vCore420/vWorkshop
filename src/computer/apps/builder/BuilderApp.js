import * as THREE from "three";
import { compileDefinition, makeDefaultPart } from "../../../worldbuilder/ObjectCompiler.js";
import { getBehaviourTypes, getBehaviourConfig, defaultPropertiesFor } from "../../../worldbuilder/behaviours/index.js";
import { PART_CATEGORIES, SEGMENTED_PART_TYPES, partLabel } from "../../../worldbuilder/PartTypes.js";
import { PreviewRenderer } from "./PreviewRenderer.js";

// Behaviours in this group can't be combined with each other — an entity
// can only carry one InteractableComponent. See behaviours/registry.js.
// Derived from the registry rather than hardcoded — every behaviour that
// declares `ownsInteractable: true` (built-in or from a plugin, see
// docs/PLUGIN_GUIDE.md) is automatically mutually exclusive with every
// other one, with nothing to remember to update here when a new one is
// added.
const INTERACTABLE_GROUP = new Set(getBehaviourTypes().filter((type) => getBehaviourConfig(type).ownsInteractable));

/**
 * createBuilderApp
 * ------------------
 * "The computer should gain a new application called Builder." Everything
 * here operates on one in-memory *draft* definition at a time — nothing is
 * part of the permanent ObjectLibraryStore until "Save to Library" is
 * pressed, so experimenting with parts costs nothing. See
 * docs/WORLDBUILDER.md for the full architecture this sits on top of
 * (ObjectCompiler, the behaviour registry, ObjectLibraryStore).
 *
 * **Workspace**: an even split — a large, always-visible live preview on
 * the left, every editing control on the right. This uses its own layout
 * classes (`.builder-workspace*`), not the `.builder-root`/`.builder-
 * preview`/`.builder-form` triplet WardrobeApp also uses — the two apps'
 * *content* sections (`.builder-section`, `.builder-library`, `.builder-
 * field`...) still share styling, but the outer split is Builder's own,
 * specifically so widening it here couldn't narrow the Wardrobe's own
 * preview as a side effect.
 */
export function createBuilderApp({ objectLibraryStore, worldObjectsStore, worldObjectsSystem }) {
  return {
    id: "builder",
    label: "Builder",
    glyph: "\uD83D\uDEE0",
    mount(container) {
      let draft = freshDraft();
      let highlightMaterial = null; // the one cloned material used to tint whichever part is selected — see refreshPreview()

      const root = document.createElement("div");
      root.className = "builder-workspace";
      container.appendChild(root);

      const previewPane = document.createElement("div");
      previewPane.className = "builder-workspace-preview";
      const formPane = document.createElement("div");
      formPane.className = "builder-workspace-form";
      root.append(previewPane, formPane);

      const preview = new PreviewRenderer(previewPane, { lookAtHeight: 0.3, distance: 3.2 });

      function refreshPreview() {
        highlightMaterial?.dispose(); // the previous refresh's clone, if any — never the shared cached material other objects use
        highlightMaterial = null;

        const compiled = compileDefinition(draft);
        if (draft.selectedPartId) {
          compiled.traverse((child) => {
            if (child.userData?.partId !== draft.selectedPartId || !child.isMesh) return;
            // Cloned specifically so this never touches the shared, cached
            // material every other object of this colour also uses (see
            // ObjectCompiler.js/PlaceholderFactory.js) — the same care
            // Build Mode's own ghost preview takes, for the same reason.
            highlightMaterial = child.material.clone();
            highlightMaterial.emissive = new THREE.Color("#b8863b");
            highlightMaterial.emissiveIntensity = 0.55;
            child.material = highlightMaterial;
          });
        }
        preview.setObject(compiled);
      }

      function saveDraftToLibrary() {
        const patch = definitionPatchFromDraft(draft);
        if (draft.editingId) {
          objectLibraryStore.update(draft.editingId, patch);
          worldObjectsSystem?.refreshInstancesOfDefinition(draft.editingId);
        } else {
          const created = objectLibraryStore.create(patch);
          draft = draftFromDefinition(created);
        }
        renderAll();
      }

      function renderAll() {
        formPane.innerHTML = "";
        formPane.appendChild(buildMetadataSection(draft, renderAll));
        formPane.appendChild(buildPartsSection(draft, renderAll, refreshPreview));
        formPane.appendChild(buildBehavioursSection(draft, renderAll));
        formPane.appendChild(buildActionsSection(draft, {
          onSave: saveDraftToLibrary,
          onClear: () => { draft = freshDraft(); renderAll(); },
        }));
        formPane.appendChild(buildLibrarySection(objectLibraryStore, worldObjectsStore, {
          onEdit: (def) => { draft = draftFromDefinition(def); renderAll(); },
        }));
        refreshPreview();
      }

      const unsubscribeLibrary = objectLibraryStore.events.on("library:changed", () => {
        // Only the library list needs to reflect external changes live;
        // re-rendering everything would blow away in-progress edits.
        const libSection = formPane.querySelector(".builder-library");
        if (libSection) {
          const replacement = buildLibrarySection(objectLibraryStore, worldObjectsStore, {
            onEdit: (def) => { draft = draftFromDefinition(def); renderAll(); },
          });
          libSection.replaceWith(replacement);
        }
      });

      renderAll();

      return () => {
        unsubscribeLibrary?.();
        preview.dispose();
      };
    },
  };
}

// ---- draft <-> definition helpers ----

function freshDraft() {
  return {
    editingId: null,
    name: "New object",
    description: "",
    category: "Other",
    tags: [],
    defaultScale: 1,
    defaultRotationY: 0,
    parts: [],
    behaviours: [],
    selectedPartId: null,
    nextPartNum: 1,
  };
}

function draftFromDefinition(def) {
  return {
    editingId: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    tags: [...def.tags],
    defaultScale: def.defaultScale,
    defaultRotationY: def.defaultRotationY,
    parts: def.parts.map((p) => ({ ...p })),
    behaviours: def.behaviours.map((b) => ({ ...b, properties: { ...b.properties } })),
    selectedPartId: null,
    nextPartNum: def.parts.length + 1,
  };
}

function definitionPatchFromDraft(draft) {
  return {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    tags: draft.tags,
    defaultScale: draft.defaultScale,
    defaultRotationY: draft.defaultRotationY,
    parts: draft.parts,
    behaviours: draft.behaviours,
  };
}

// ============================================================
// Metadata
// ============================================================
function buildMetadataSection(draft, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section";

  const heading = document.createElement("h2");
  heading.textContent = "Object";
  section.appendChild(heading);

  section.appendChild(textField("Name", draft.name, (v) => { draft.name = v; }));
  section.appendChild(textAreaField("Description", draft.description, (v) => { draft.description = v; }));
  section.appendChild(selectField("Category", draft.category, ["Furniture", "Lighting", "Decoration", "Tool", "Storage", "Other"], (v) => { draft.category = v; onChange(); }));
  section.appendChild(textField("Tags (comma separated)", draft.tags.join(", "), (v) => { draft.tags = v.split(",").map((t) => t.trim()).filter(Boolean); }));

  const defaultsRow = document.createElement("div");
  defaultsRow.className = "builder-inline-row";
  defaultsRow.appendChild(numberField("Default scale", draft.defaultScale, 0.1, (v) => { draft.defaultScale = v; }));
  defaultsRow.appendChild(numberField("Default rotation (\u00b0)", Math.round((draft.defaultRotationY * 180) / Math.PI), 1, (v) => { draft.defaultRotationY = (v * Math.PI) / 180; }));
  section.appendChild(defaultsRow);

  return section;
}

// ============================================================
// Parts
// ============================================================
function buildPartsSection(draft, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section";

  const heading = document.createElement("h2");
  heading.textContent = "Parts";
  section.appendChild(heading);

  // A dropdown grouped by category, not a wall of buttons — thirteen
  // shapes is a genuinely useful set, but thirteen buttons would be
  // exactly the "complicated interface" this pass was asked to avoid.
  const toolbar = document.createElement("div");
  toolbar.className = "builder-toolbar";
  const select = document.createElement("select");
  select.className = "builder-shape-select";
  for (const group of PART_CATEGORIES) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.category;
    for (const { id, label } of group.types) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      optgroup.appendChild(opt);
    }
    select.appendChild(optgroup);
  }
  toolbar.appendChild(select);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+ Add Shape";
  addBtn.addEventListener("click", () => {
    const part = makeDefaultPart(select.value, `part-${Date.now()}-${draft.nextPartNum++}`);
    draft.parts.push(part);
    draft.selectedPartId = part.id;
    onChange();
  });
  toolbar.appendChild(addBtn);
  section.appendChild(toolbar);

  if (draft.parts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "builder-empty";
    empty.textContent = "No parts yet — pick a shape above and add one to start building.";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "builder-parts-list";
  draft.parts.forEach((part, index) => {
    const li = document.createElement("li");
    if (part.id === draft.selectedPartId) li.classList.add("selected");

    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${partLabel(part.type)}`;
    label.addEventListener("click", () => { draft.selectedPartId = part.id; onChange(); });
    li.appendChild(label);

    const controls = document.createElement("span");
    controls.className = "builder-parts-list-controls";
    if (index > 0) controls.appendChild(iconButton("\u2191", "Move up", () => { swap(draft.parts, index, index - 1); onChange(); }));
    if (index < draft.parts.length - 1) controls.appendChild(iconButton("\u2193", "Move down", () => { swap(draft.parts, index, index + 1); onChange(); }));
    controls.appendChild(iconButton("\u29C9", "Duplicate", () => {
      const copy = { ...part, id: `part-${Date.now()}-${draft.nextPartNum++}`, position: [part.position[0] + 0.2, part.position[1], part.position[2] + 0.2] };
      draft.parts.splice(index + 1, 0, copy);
      draft.selectedPartId = copy.id;
      onChange();
    }));
    controls.appendChild(iconButton("\u2715", "Remove", () => {
      draft.parts = draft.parts.filter((p) => p.id !== part.id);
      if (draft.selectedPartId === part.id) draft.selectedPartId = null;
      onChange();
    }));
    li.appendChild(controls);

    list.appendChild(li);
  });
  section.appendChild(list);

  const selectedPart = draft.parts.find((p) => p.id === draft.selectedPartId);
  if (selectedPart) section.appendChild(buildPartEditor(selectedPart, onPreviewChange));

  return section;
}

function buildPartEditor(part, onPreviewChange) {
  const editor = document.createElement("div");
  editor.className = "builder-part-editor";

  const posRow = document.createElement("div");
  posRow.className = "builder-inline-row";
  ["x", "y", "z"].forEach((axis, i) => {
    posRow.appendChild(numberField(`Pos ${axis}`, part.position[i], 0.05, (v) => { part.position[i] = v; onPreviewChange(); }));
  });
  editor.appendChild(posRow);

  const scaleRow = document.createElement("div");
  scaleRow.className = "builder-inline-row";
  ["x", "y", "z"].forEach((axis, i) => {
    scaleRow.appendChild(numberField(`Scale ${axis}`, part.scale[i], 0.05, (v) => { part.scale[i] = Math.max(0.02, v); onPreviewChange(); }));
  });
  editor.appendChild(scaleRow);

  const miscRow = document.createElement("div");
  miscRow.className = "builder-inline-row";
  miscRow.appendChild(numberField("Rotation (\u00b0)", Math.round((part.rotationY * 180) / Math.PI), 1, (v) => { part.rotationY = (v * Math.PI) / 180; onPreviewChange(); }));
  miscRow.appendChild(colorField("Colour", part.color, (v) => { part.color = v; onPreviewChange(); }));
  if (SEGMENTED_PART_TYPES.has(part.type)) {
    miscRow.appendChild(numberField("Segments", part.segments ?? 16, 1, (v) => { part.segments = Math.max(3, Math.round(v)); onPreviewChange(); }));
  }
  editor.appendChild(miscRow);

  return editor;
}

// ============================================================
// Behaviours
// ============================================================
function buildBehavioursSection(draft, onChange) {
  const section = document.createElement("div");
  section.className = "builder-section";

  const heading = document.createElement("h2");
  heading.textContent = "Behaviour";
  section.appendChild(heading);
  const hint = document.createElement("p");
  hint.className = "builder-hint";
  hint.textContent = "No programming — just properties. Interactable/Seat/Storage/Door/Computer/Trigger/Audio source share one interaction slot, so only one of those can be active at a time.";
  section.appendChild(hint);

  for (const type of getBehaviourTypes()) {
    const config = getBehaviourConfig(type);
    const existing = draft.behaviours.find((b) => b.type === type);

    const row = document.createElement("div");
    row.className = "builder-behaviour-row";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!existing;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (config.ownsInteractable) {
          draft.behaviours = draft.behaviours.filter((b) => !INTERACTABLE_GROUP.has(b.type));
        }
        draft.behaviours.push({ type, properties: defaultPropertiesFor(type) });
      } else {
        draft.behaviours = draft.behaviours.filter((b) => b.type !== type);
      }
      onChange();
    });
    label.append(checkbox, ` ${config.label}`);
    row.appendChild(label);

    if (existing && config.propsSchema.length > 0) {
      const props = document.createElement("div");
      props.className = "builder-behaviour-props";
      for (const field of config.propsSchema) {
        props.appendChild(behaviourPropField(field, existing.properties));
      }
      row.appendChild(props);
    }

    section.appendChild(row);
  }

  return section;
}

function behaviourPropField(field, properties) {
  if (field.type === "select") {
    return selectField(
      field.label,
      properties[field.key],
      field.options.map(([, label]) => label),
      (label) => {
        const match = field.options.find(([, l]) => l === label);
        properties[field.key] = match ? match[0] : properties[field.key];
      },
      field.options.map(([value]) => value)
    );
  }
  if (field.type === "color") return colorField(field.label, properties[field.key], (v) => { properties[field.key] = v; });
  if (field.type === "number") return numberField(field.label, properties[field.key], 0.1, (v) => { properties[field.key] = v; });
  return textField(field.label, properties[field.key], (v) => { properties[field.key] = v; });
}

// ============================================================
// Actions (save / new)
// ============================================================
function buildActionsSection(draft, { onSave, onClear }) {
  const section = document.createElement("div");
  section.className = "builder-section builder-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "builder-primary";
  saveBtn.textContent = draft.editingId ? "Save changes" : "Save to library";
  saveBtn.addEventListener("click", onSave);

  const newBtn = document.createElement("button");
  newBtn.textContent = "New object";
  newBtn.addEventListener("click", onClear);

  section.append(saveBtn, newBtn);
  return section;
}

// ============================================================
// Library
// ============================================================
function buildLibrarySection(objectLibraryStore, worldObjectsStore, { onEdit }) {
  const section = document.createElement("div");
  section.className = "builder-section builder-library";

  const heading = document.createElement("h2");
  heading.textContent = "Object library";
  section.appendChild(heading);

  const definitions = objectLibraryStore.all();
  if (definitions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "builder-empty";
    empty.textContent = "Nothing saved yet. Build something above, then save it here — it'll be available anywhere in Build Mode (press B).";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "builder-library-list";
  for (const def of definitions) {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.innerHTML = `<strong>${escapeHtml(def.name)}</strong><span class="builder-library-meta">${escapeHtml(def.category)} \u00b7 ${def.parts.length} part${def.parts.length === 1 ? "" : "s"}</span>`;
    li.appendChild(info);

    const controls = document.createElement("div");
    controls.className = "builder-library-controls";
    controls.appendChild(smallButton("Edit", () => onEdit(def)));
    controls.appendChild(smallButton("Duplicate", () => objectLibraryStore.duplicate(def.id)));
    controls.appendChild(smallButton("Delete", () => {
      const inUse = worldObjectsStore.byDefinition(def.id).length > 0;
      if (inUse && !confirm(`"${def.name}" is placed somewhere in the workshop. Delete it from the library anyway? Placed copies will stay as they are.`)) return;
      objectLibraryStore.remove(def.id);
    }));
    li.appendChild(controls);

    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

// ============================================================
// Small DOM field helpers
// ============================================================
function textField(label, value, onInput) {
  const wrap = document.createElement("label");
  wrap.className = "builder-field";
  wrap.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

function textAreaField(label, value, onInput) {
  const wrap = document.createElement("label");
  wrap.className = "builder-field";
  wrap.textContent = label;
  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.value = value ?? "";
  textarea.addEventListener("input", () => onInput(textarea.value));
  wrap.appendChild(textarea);
  return wrap;
}

function numberField(label, value, step, onInput) {
  const wrap = document.createElement("label");
  wrap.className = "builder-field builder-field-narrow";
  wrap.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(value ?? 0);
  input.addEventListener("input", () => onInput(parseFloat(input.value) || 0));
  wrap.appendChild(input);
  return wrap;
}

function colorField(label, value, onInput) {
  const wrap = document.createElement("label");
  wrap.className = "builder-field builder-field-narrow";
  wrap.textContent = label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = value ?? "#8d8577";
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

function selectField(label, value, options, onChange, optionValues) {
  const wrap = document.createElement("label");
  wrap.className = "builder-field";
  wrap.textContent = label;
  const select = document.createElement("select");
  options.forEach((optionLabel, i) => {
    const opt = document.createElement("option");
    opt.value = optionValues ? optionValues[i] : optionLabel;
    opt.textContent = optionLabel;
    if ((optionValues ? optionValues[i] : optionLabel) === value) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => onChange(select.value));
  wrap.appendChild(select);
  return wrap;
}

function iconButton(glyph, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "builder-icon-button";
  btn.title = title;
  btn.textContent = glyph;
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function smallButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "builder-small-button";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function swap(arr, i, j) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
