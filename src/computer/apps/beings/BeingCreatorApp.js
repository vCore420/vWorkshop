import { PreviewRenderer } from "../builder/PreviewRenderer.js";
import { MOVEMENT_STYLES, IDLE_BEHAVIOURS, AWARENESS_MODES, INTERACTION_BEHAVIOURS, BEING_TYPES } from "../../../beings/BeingBehaviours.js";
import { compileBody, mirrorSubtree, makeDefaultBodyPart, nextBodyPartId, descendantIds, BODY_PART_SHAPES } from "../../../beings/BodyCompiler.js";
import { WORKSHOP_JOINTS, autoMapSkeleton, isSkeletonMapUsable } from "../../../player/WorkshopSkeleton.js";
import { ClipPlayer } from "../../../player/AnimationPlayback.js";
import { applyPoseToMappedSkeleton } from "../../../player/AnimationRetargeting.js";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * createBeingCreatorApp
 * ------------------------
 * "The Workshop should allow creators to build life from nothing. Not
 * just import it... just as the Builder creates buildings, the Being
 * Creator should create creatures." The same two-pane shape
 * `BuilderApp.js` already established, and — new in the Being Creator
 * phase — genuinely the same *kind* of tool: a being's body can now be
 * built entirely from primitive shapes (`BodyCompiler.js`), organised
 * into a real parent-child hierarchy, and rigged simply by telling each
 * part which Workshop skeleton joint it represents — no separate "bones"
 * system layered on top (see `BodyCompiler.js`'s own comment on why a
 * part just *is* a joint, when it's tagged as one).
 *
 * Like Builder, this edits one in-memory *draft* at a time — nothing
 * reaches `BeingLibrary` until "Save to Library" is pressed, so trying
 * things costs nothing. "Creating a Being should not automatically place
 * it into the world" is true by construction: this file never touches
 * `BeingInstanceStore` at all, only `BeingSpawnerApp.js` does.
 *
 * A being's own body comes from exactly one of two places at a time —
 * `draft.bodySource` is `"model"` (an imported `.glb`/`.gltf`, unchanged
 * from earlier phases) or `"primitives"` (this phase's own new
 * construction workflow) — see `buildBodySourceSection()` for the
 * toggle. Whichever is active, the preview (`refreshPreview()`) and the
 * "Preview Animation" controls both work identically either way, since
 * both paths ultimately produce the same thing: a real `THREE.Object3D`
 * plus, where possible, a skeleton map `AnimationRetargeting.
 * applyPoseToMappedSkeleton()` already knows how to animate.
 */
export function createBeingCreatorApp({ beingLibrary, modelLibrary, modelAssetStore, modelLoader, animationLibraryStore }) {
  return {
    id: "beingCreator",
    label: "Being Creator",
    glyph: "\uD83E\uDDDC",
    mount(container) {
      let draft = freshDraft();
      let editingId = null;
      let highlightMaterial = null; // the previous refresh's selection-tint clone — see refreshPreview(), same pattern BuilderApp.js already established

      const workspace = document.createElement("div");
      workspace.className = "builder-workspace";
      container.appendChild(workspace);

      const previewPane = document.createElement("div");
      previewPane.className = "builder-workspace-preview";
      const formPane = document.createElement("div");
      formPane.className = "builder-workspace-form";
      workspace.append(previewPane, formPane);

      const preview = new PreviewRenderer(previewPane, { lookAtHeight: 0.5, distance: 2.6 });

      // --- Animation preview — "previewing existing Workshop animations,
      // pose previews... the goal is to ensure every created being is
      // ready to move." A second, independent loop alongside
      // PreviewRenderer's own continuous render loop (which just renders
      // whatever's currently in the scene every frame, unchanged) — this
      // one only ever updates a pose on the currently-previewed body,
      // exactly the same `ClipPlayer`/`applyPoseToMappedSkeleton()`
      // pairing `BeingController.js` uses for a placed Being, so what's
      // previewed here is an honest preview of what actually happens in
      // the Workshop, not an approximation of it.
      let previewSkeleton = null; // {map, rest} — set by refreshPreview(), null whenever the current body has no usable rig
      let previewClipPlayer = new ClipPlayer();
      let previewPlaying = false;
      let previewClipId = null;
      let lastFrameTime = performance.now();
      let animFrameHandle = null;

      function animationTick() {
        animFrameHandle = requestAnimationFrame(animationTick);
        const now = performance.now();
        const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;
        if (!previewPlaying || !previewSkeleton) return;
        const { pose } = previewClipPlayer.advance(dt);
        applyPoseToMappedSkeleton(pose, previewSkeleton.map, previewSkeleton.rest);
      }
      animFrameHandle = requestAnimationFrame(animationTick);

      async function refreshPreview() {
        highlightMaterial?.dispose(); // never the shared cached material every other part of this colour also uses — see BuilderApp.js's own identical reasoning
        highlightMaterial = null;
        previewSkeleton = null;

        let object3D;
        if (draft.bodySource === "primitives") {
          const compiled = compileBody(draft.bodyParts);
          object3D = compiled.root;
          if (Object.keys(compiled.skeletonMap).length > 0) previewSkeleton = { map: compiled.skeletonMap, rest: compiled.skeletonRest };
        } else {
          const model = draft.modelId ? await modelLoader.load(draft.modelId) : null;
          object3D = model ?? modelLoader.buildPlaceholder();
          // "Animation compatibility... skeleton validation... ensure
          // every created being is ready to move" applies to an imported
          // model too, not only a primitive one — the identical
          // heuristic `BeingController.js` itself uses once this Being
          // is actually placed, so a "ready to preview" model here is an
          // honest preview of what happens in the Workshop, not an
          // optimistic guess.
          if (model) {
            const { map, rest } = autoMapSkeleton(model);
            if (isSkeletonMapUsable(map)) previewSkeleton = { map, rest };
          }
        }
        object3D.scale.setScalar(draft.scale);

        if (draft.bodySource === "primitives" && draft.selectedPartId) {
          object3D.traverse((child) => {
            if (child.userData?.partId !== draft.selectedPartId || !child.isMesh) return;
            highlightMaterial = child.material.clone();
            highlightMaterial.emissive.set("#b8863b");
            highlightMaterial.emissiveIntensity = 0.55;
            child.material = highlightMaterial;
          });
        }
        preview.setObject(object3D);
        if (previewClipId !== draft.idleAnimationClipId) restartPreviewClip();
      }

      function restartPreviewClip() {
        previewClipId = draft.idleAnimationClipId;
        const clip = previewClipId ? animationLibraryStore?.getClip(previewClipId) : null;
        previewClipPlayer.setClip(clip);
      }

      function loadIntoDraft(being) {
        draft = { ...being, tags: [...being.tags], bodyParts: structuredClone(being.bodyParts ?? []), selectedPartId: null };
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
        formPane.appendChild(buildBodySourceSection(draft, renderAll, refreshPreview));
        if (draft.bodySource === "primitives") {
          formPane.appendChild(buildBodyConstructionSection(draft, renderAll, refreshPreview));
        } else {
          formPane.appendChild(buildModelSection(draft, modelLibrary, modelAssetStore, renderAll, refreshPreview));
        }
        formPane.appendChild(buildMovementSection(draft, renderAll));
        formPane.appendChild(
          buildAnimationSection(draft, animationLibraryStore, renderAll, refreshPreview, {
            get playing() { return previewPlaying; },
            togglePlaying: () => {
              previewPlaying = !previewPlaying;
              if (previewPlaying) restartPreviewClip();
              renderAll();
            },
            hasSkeleton: () => !!previewSkeleton,
          })
        );
        formPane.appendChild(buildActionsSection(editingId, saveDraft));
      }

      refreshPreview();
      renderAll();

      return () => {
        if (animFrameHandle) cancelAnimationFrame(animFrameHandle);
        preview.dispose();
      };
    },
  };
}

function freshDraft() {
  const torsoId = nextBodyPartId();
  return {
    name: "New Being",
    description: "",
    beingType: "custom",
    tags: [],
    modelId: null,
    // "Not just import it" — a fresh Being starts ready to build from
    // primitives, with one sensible starting part already in place
    // rather than an empty, intimidating list. Switching to "Imported
    // Model" (see buildBodySourceSection()) is one click away for anyone
    // who'd rather import first.
    bodySource: "primitives",
    bodyParts: [{ ...makeDefaultBodyPart(torsoId, { shape: "box" }), name: "Torso", jointName: "torso", position: [0, 1, 0], scale: [0.4, 0.55, 0.28], color: "#8d8577" }],
    selectedPartId: torsoId,
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
  const { name: _n, selectedPartId: _s, ...rest } = draft;
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
// Body Source toggle — "just as the Builder creates buildings, the
// Being Creator should create creatures... continue supporting imported
// models."
// ---------------------------------------------------------------------
function buildBodySourceSection(draft, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Body"));
  const hint = document.createElement("p");
  hint.className = "app-subtitle";
  hint.textContent = "Build a body entirely from primitive shapes right here, or import a modelled one \u2014 either becomes a real Workshop Asset the same way.";
  section.appendChild(hint);

  const row = document.createElement("div");
  row.className = "panel-row";
  const label = document.createElement("label");
  label.textContent = "Source";
  const select = document.createElement("select");
  for (const [value, text] of [["primitives", "Built from Primitives"], ["model", "Imported Model"]]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    if (draft.bodySource === value) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    draft.bodySource = select.value;
    onPreviewChange();
    onChange();
  });
  row.append(label, select);
  section.appendChild(row);
  return section;
}

// ---------------------------------------------------------------------
// Body Construction — "support creating beings entirely from primitive
// shapes... introduce a true body hierarchy... create a clear hierarchy
// editor... the hierarchy should become the heart of the Being Creator."
// ---------------------------------------------------------------------
function partDepth(bodyParts, partId) {
  let depth = 0;
  let current = bodyParts.find((p) => p.id === partId);
  const seen = new Set();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    depth++;
    current = bodyParts.find((p) => p.id === current.parentId);
  }
  return depth;
}

/** Parts in a stable, hierarchy-respecting order — every part appears
 *  after its own parent, children grouped together right after their
 *  parent, so the rendered list actually reads as a tree rather than
 *  whatever order they happen to sit in the array (usually creation
 *  order, which re-parenting would otherwise leave looking scrambled). */
function orderedByHierarchy(bodyParts) {
  const byParent = new Map();
  for (const part of bodyParts) {
    const key = part.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(part);
  }
  const ordered = [];
  const visit = (parentId) => {
    for (const part of byParent.get(parentId) ?? []) {
      ordered.push(part);
      visit(part.id);
    }
  };
  visit(null);
  // Any part whose own parentId doesn't actually exist any more (should
  // only happen to already-imported/malformed data) still gets shown,
  // appended at the end, rather than silently disappearing from the list.
  for (const part of bodyParts) if (!ordered.includes(part)) ordered.push(part);
  return ordered;
}

function buildBodyConstructionSection(draft, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section builder-library";
  section.appendChild(sectionHeading("Body Construction"));
  const hint = document.createElement("p");
  hint.className = "app-subtitle";
  hint.textContent = "Every part can be a plain shape, or a rig joint a Workshop animation can actually move \u2014 assign one below and this Being is ready to animate.";
  section.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "builder-library-controls";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "builder-primary";
  addBtn.textContent = "Add Part";
  addBtn.addEventListener("click", () => {
    const part = makeDefaultBodyPart(nextBodyPartId(), { parentId: draft.selectedPartId });
    draft.bodyParts.push(part);
    draft.selectedPartId = part.id;
    onPreviewChange();
    onChange();
  });
  actions.appendChild(addBtn);
  section.appendChild(actions);

  const list = document.createElement("ul");
  list.className = "builder-library-list";
  if (draft.bodyParts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "app-subtitle";
    empty.textContent = "No parts yet \u2014 add one above to start building.";
    list.appendChild(empty);
  }
  for (const part of orderedByHierarchy(draft.bodyParts)) {
    list.appendChild(buildPartRow(draft, part, onChange, onPreviewChange));
  }
  section.appendChild(list);

  const selectedPart = draft.bodyParts.find((p) => p.id === draft.selectedPartId);
  if (selectedPart) section.appendChild(buildPartEditor(draft, selectedPart, onChange, onPreviewChange));

  return section;
}

function buildPartRow(draft, part, onChange, onPreviewChange) {
  const li = document.createElement("li");
  if (part.id === draft.selectedPartId) li.classList.add("selected");

  const meta = document.createElement("span");
  meta.className = "builder-library-meta";
  meta.style.cursor = "pointer";
  meta.style.paddingLeft = `${partDepth(draft.bodyParts, part.id) * 16}px`;
  meta.textContent = part.jointName ? `${part.name} \u00b7 ${jointLabel(part.jointName)}` : part.name;
  meta.addEventListener("click", () => {
    draft.selectedPartId = part.id;
    onPreviewChange();
    onChange();
  });
  li.appendChild(meta);

  const controls = document.createElement("div");
  controls.className = "builder-inline-row";
  controls.appendChild(
    iconButton("\u2942", "Mirror this part and its children", () => {
      draft.bodyParts.push(...mirrorSubtree(draft.bodyParts, part.id));
      onPreviewChange();
      onChange();
    })
  );
  controls.appendChild(
    iconButton("\u29c9", "Duplicate just this part", () => {
      const copy = { ...part, id: nextBodyPartId(), name: `${part.name} (copy)`, jointName: null }; // jointName never duplicated — a joint id can only ever belong to one part at a time, see buildPartEditor()'s own rig-joint dropdown
      draft.bodyParts.push(copy);
      draft.selectedPartId = copy.id;
      onPreviewChange();
      onChange();
    })
  );
  controls.appendChild(
    iconButton("\u2715", "Delete this part and its children", () => {
      const toRemove = new Set([part.id, ...descendantIds(draft.bodyParts, part.id)]);
      draft.bodyParts = draft.bodyParts.filter((p) => !toRemove.has(p.id));
      if (toRemove.has(draft.selectedPartId)) draft.selectedPartId = null;
      onPreviewChange();
      onChange();
    })
  );
  li.appendChild(controls);
  return li;
}

function jointLabel(jointId) {
  return WORKSHOP_JOINTS.find((j) => j.id === jointId)?.label ?? jointId;
}

function buildPartEditor(draft, part, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading(`Part: ${part.name}`));

  section.appendChild(textRow("Name", part.name, (v) => { part.name = v || part.name; onChange(); }));

  // Parent — every part except this one and its own descendants (which
  // would otherwise create a cycle — see BodyCompiler.descendantIds()'s
  // own comment).
  const excluded = descendantIds(draft.bodyParts, part.id);
  excluded.add(part.id);
  const parentOptions = [["", "\u2014 Root \u2014"], ...draft.bodyParts.filter((p) => !excluded.has(p.id)).map((p) => [p.id, p.name])];
  section.appendChild(selectRow("Parent", part.parentId ?? "", parentOptions, (v) => { part.parentId = v || null; onPreviewChange(); onChange(); }));

  section.appendChild(selectRow("Shape", part.shape, BODY_PART_SHAPES, (v) => { part.shape = v; onPreviewChange(); }));

  // Rig joint — "assigning body parts... editing joints." At most one
  // part per Workshop joint; already-used joints (by some *other* part)
  // are simply left out of the list rather than shown disabled, keeping
  // the dropdown itself short and honest about what's actually available.
  const usedElsewhere = new Set(draft.bodyParts.filter((p) => p.id !== part.id && p.jointName).map((p) => p.jointName));
  const jointOptions = [["", "\u2014 None (decorative) \u2014"], ...WORKSHOP_JOINTS.filter((j) => !usedElsewhere.has(j.id)).map((j) => [j.id, j.label])];
  section.appendChild(selectRow("Rig Joint", part.jointName ?? "", jointOptions, (v) => { part.jointName = v || null; onPreviewChange(); onChange(); }));
  const jointHint = document.createElement("p");
  jointHint.className = "app-subtitle";
  jointHint.textContent = part.jointName
    ? "A Workshop animation can move this part directly."
    : "Purely decorative \u2014 moves along with whatever it's parented to, but no animation targets it directly.";
  section.appendChild(jointHint);

  section.appendChild(vectorRow("Position", part.position, -3, 3, 0.01, (v) => { part.position = v; onPreviewChange(); }));
  section.appendChild(vectorRow("Rotation", part.rotation.map((r) => r * RAD_TO_DEG), -180, 180, 1, (v) => { part.rotation = v.map((d) => d * DEG_TO_RAD); onPreviewChange(); }, "\u00b0"));
  section.appendChild(vectorRow("Scale", part.scale, 0.02, 2, 0.01, (v) => { part.scale = v; onPreviewChange(); }));

  const colorRow = document.createElement("div");
  colorRow.className = "panel-row";
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "Colour";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = part.color;
  colorInput.addEventListener("input", () => { part.color = colorInput.value; onPreviewChange(); });
  colorRow.append(colorLabel, colorInput);
  section.appendChild(colorRow);

  return section;
}

/** Three sliders in a row (X/Y/Z), for position/rotation/scale — the
 *  three vector fields every body part has. `onChange` receives the
 *  whole updated `[x,y,z]` array each time any one axis moves, so a
 *  caller never has to reassemble it from three separate callbacks. */
function vectorRow(label, values, min, max, step, onChange, unit = "") {
  const wrap = document.createElement("div");
  wrap.className = "panel-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  const axesWrap = document.createElement("div");
  axesWrap.className = "being-vector-axes";
  const current = [...values];
  ["X", "Y", "Z"].forEach((axisLabel, axis) => {
    const axisWrap = document.createElement("div");
    axisWrap.className = "being-vector-axis";
    const axisTag = document.createElement("span");
    axisTag.textContent = axisLabel;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(values[axis]);
    const valueEl = document.createElement("span");
    valueEl.className = "settings-range-value";
    valueEl.textContent = values[axis].toFixed(2) + unit;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      current[axis] = v;
      valueEl.textContent = v.toFixed(2) + unit;
      onChange([...current]);
    });
    axisWrap.append(axisTag, input, valueEl);
    axesWrap.appendChild(axisWrap);
  });
  wrap.appendChild(axesWrap);
  return wrap;
}

function iconButton(glyph, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "builder-icon-button";
  btn.title = title;
  btn.textContent = glyph;
  btn.addEventListener("click", onClick);
  return btn;
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
// animation assets... avoid duplicating animation systems." Plus, new in
// the Being Creator phase, a genuine live preview — "previewing existing
// Workshop animations, pose previews... ensure every created being is
// ready to move."
// ---------------------------------------------------------------------
function buildAnimationSection(draft, animationLibraryStore, onChange, onPreviewChange, preview) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Animation"));
  const hint = document.createElement("p");
  hint.className = "app-subtitle";
  hint.textContent = "References clips from the shared Animation Library \u2014 the same one the Player Animation Editor edits.";
  section.appendChild(hint);

  const clips = animationLibraryStore?.all?.() ?? [];
  const clipOptions = [["", "\u2014 none \u2014"], ...clips.map((c) => [c.id, c.name])];
  section.appendChild(selectRow("Idle Animation", draft.idleAnimationClipId ?? "", clipOptions, (v) => { draft.idleAnimationClipId = v || null; onChange(); onPreviewChange(); }));
  section.appendChild(selectRow("Walk Animation", draft.walkAnimationClipId ?? "", clipOptions, (v) => { draft.walkAnimationClipId = v || null; onChange(); }));

  const previewRow = document.createElement("div");
  previewRow.className = "panel-row";
  const previewLabel = document.createElement("label");
  previewLabel.textContent = "Preview";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "builder-small-button";
  const canPreview = preview.hasSkeleton() && draft.idleAnimationClipId;
  playBtn.disabled = !canPreview;
  playBtn.textContent = preview.playing ? "Pause" : "Play Idle Animation";
  playBtn.addEventListener("click", preview.togglePlaying);
  previewRow.append(previewLabel, playBtn);
  section.appendChild(previewRow);

  if (!preview.hasSkeleton()) {
    const note = document.createElement("p");
    note.className = "app-subtitle";
    note.textContent =
      draft.bodySource === "primitives"
        ? "Assign at least one Rig Joint under Body Construction to preview animation here."
        : "This model doesn't have a skeleton the Workshop vocabulary maps to confidently enough to preview animation \u2014 see docs/ANIMATION.md's own Skeleton Mapping section.";
    section.appendChild(note);
  }
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
