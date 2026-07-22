import * as THREE from "three";
import { PreviewRenderer } from "../builder/PreviewRenderer.js";
import { MOVEMENT_STYLES, IDLE_BEHAVIOURS, AWARENESS_MODES, INTERACTION_BEHAVIOURS, BEING_TYPES } from "../../../beings/BeingBehaviours.js";
import { compileBody, mirrorSubtree, makeDefaultBodyPart, nextBodyPartId, descendantIds, BODY_PART_SHAPES, BODY_PART_MATERIALS } from "../../../beings/BodyCompiler.js";
import { WORKSHOP_JOINTS, autoMapSkeleton, isSkeletonMapUsable, NON_JOINT_CONTAINER_NAMES } from "../../../player/WorkshopSkeleton.js";
import { ClipPlayer } from "../../../player/AnimationPlayback.js";
import { applyPoseToMappedSkeleton } from "../../../player/AnimationRetargeting.js";
import { importModelFile } from "../../../beings/ModelLibrary.js";
import { nextDomId } from "../../../utils/domIds.js";
import { createIconButton } from "../../../ui/iconButton.js";
import { StorageUtils } from "../../../utils/StorageUtils.js";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// Version 3, Phase 10c ("Being Creator, Beyond the Prototype, Wave 2") —
// one shared geometry/material for every joint marker, cached at module
// scope rather than rebuilt per `refreshPreview()` call the way each
// part's own (colour-varying, genuinely can't be shared) material is —
// every marker looks identical, so there's nothing per-instance to vary.
const JOINT_MARKER_GEOMETRY = new THREE.SphereGeometry(0.03, 10, 8);
const JOINT_MARKER_MATERIAL = new THREE.MeshBasicMaterial({ color: "#ff5fd6", depthTest: false });

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
export function createBeingCreatorApp({ beingLibrary, modelLibrary, modelAssetStore, modelLoader, animationLibraryStore, residentProfileStore = null }) {
  return {
    id: "beingCreator",
    label: "Being Creator",
    glyph: "beings",
    mount(container) {
      let draft = freshDraft();
      let editingId = null;
      let highlightMaterial = null; // the previous refresh's selection-tint clone — see refreshPreview(), same pattern BuilderApp.js already established
      // Version 3, Phase 10c — editor-only UI state, never saved onto the
      // draft/definition itself: which hierarchy branches are collapsed,
      // and whether joint markers are currently shown in the preview.
      const uiState = { collapsedPartIds: new Set(), showJointMarkers: false };

      const workspace = document.createElement("div");
      workspace.className = "builder-workspace";
      container.appendChild(workspace);

      const previewPane = document.createElement("div");
      previewPane.className = "builder-workspace-preview";
      const formPane = document.createElement("div");
      formPane.className = "builder-workspace-form";
      workspace.append(previewPane, formPane);

      const preview = new PreviewRenderer(previewPane, { lookAtHeight: 0.5, distance: 2.6 });

      // Version 3, Phase 10c ("Being Creator, Beyond the Prototype, Wave
      // 2") — click a part directly in the 3D preview to select it,
      // rather than only ever finding it in the hierarchy list. A click
      // on empty space (or only a joint marker — `PreviewRenderer`'s own
      // click handling already excludes those, see that file's own
      // comment) resolves to `null`, which deselects. Only meaningful
      // for a primitives-sourced body; an imported model's own meshes
      // carry no `userData.partId` at all, so a click against one always
      // resolves to `null` regardless — harmless, just a no-op.
      preview.setOnObjectClick((mesh) => {
        if (draft.bodySource !== "primitives") return;
        draft.selectedPartId = mesh?.userData?.partId ?? null;
        refreshPreview();
        renderAll();
      });

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
      let previewModelBoneNames = []; // Version 4, Phase 8d — every real named node the current imported model has, set by refreshPreview()'s own "model" branch; the Skeleton Mapping section's own dropdown options
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

        let object3D;
        if (draft.bodySource === "primitives") {
          // Synchronous work only below — no async gap for a stale value
          // to linger across, so resetting up front (then conditionally
          // reassigning) is safe here the way it wasn't left to be for
          // the "model" branch below — see that branch's own comment.
          previewSkeleton = null;
          const compiled = compileBody(draft.bodyParts);
          object3D = compiled.root;
          if (Object.keys(compiled.skeletonMap).length > 0) previewSkeleton = { map: compiled.skeletonMap, rest: compiled.skeletonRest };
          // "Show Joint Markers" — a small dot at every part's own pivot,
          // parented directly to that pivot so it sits at exactly the
          // right world position with no coordinate math needed. Never
          // tagged with `userData.partId`, so neither this file's own
          // selection-highlight below nor `PreviewRenderer`'s own click
          // raycasting (see that file's comment) ever mistakes a marker
          // for a genuine, selectable part.
          if (uiState.showJointMarkers) {
            object3D.traverse((child) => {
              if (child.isGroup && child.userData?.partId) child.add(new THREE.Mesh(JOINT_MARKER_GEOMETRY, JOINT_MARKER_MATERIAL));
            });
          }
        } else if (!draft.modelId) {
          previewSkeleton = null;
          previewModelBoneNames = [];
          object3D = modelLoader.buildPlaceholder();
        } else {
          const model = await modelLoader.load(draft.modelId);
          // Version 4, Phase 8d — deliberately *not* resetting
          // `previewSkeleton`/`previewModelBoneNames` to blank before
          // this await resolves, unlike the primitives branch above:
          // measured live, clearing them immediately produced a real,
          // visible flash of "Not mapped" in every Skeleton Mapping
          // dropdown for the ~100-300ms this load takes, every time —
          // most jarringly right after "Reset to Auto-Detected," which
          // otherwise looked like it had cleared the mapping entirely
          // for a moment before snapping back. Leaving the previous
          // values in place until the new ones are actually computed
          // means the preview only ever *updates* to a new state, never
          // visibly *blanks* first.
          object3D = model ?? modelLoader.buildPlaceholder();
          // "Animation compatibility... skeleton validation... ensure
          // every created being is ready to move" applies to an imported
          // model too, not only a primitive one — the identical
          // heuristic `BeingController.js` itself uses once this Being
          // is actually placed, so a "ready to preview" model here is an
          // honest preview of what happens in the Workshop, not an
          // optimistic guess.
          if (model) {
            // A manual correction made through the new Skeleton Mapping
            // section (below) needs to actually be visible here, in the
            // very editor used to make it. This used to always re-run
            // the heuristic, silently ignoring any cached override — the
            // identical cached-first, auto-detect-fallback order
            // `BeingController._resolveSkeleton()` already established
            // for a genuinely placed Being.
            const cachedSkeletonMap = modelLibrary.get(draft.modelId)?.skeletonMap;
            if (cachedSkeletonMap) {
              const map = {};
              const rest = {};
              model.traverse((node) => {
                for (const [jointId, boneName] of Object.entries(cachedSkeletonMap)) {
                  if (node.name === boneName && !map[jointId]) {
                    map[jointId] = node;
                    rest[jointId] = node.quaternion.clone();
                  }
                }
              });
              previewSkeleton = isSkeletonMapUsable(map) ? { map, rest } : null;
            } else {
              const { map, rest } = autoMapSkeleton(model);
              previewSkeleton = isSkeletonMapUsable(map) ? { map, rest } : null;
            }

            // Every real, named bone/node this model actually has — the
            // Skeleton Mapping section's own dropdown options. Excludes
            // the same organisational wrapper names `autoMapSkeleton()`
            // already excludes from joint detection (an "Armature" root
            // is never something a player would want to map a joint to).
            const names = [];
            model.traverse((node) => {
              if (node.name && !NON_JOINT_CONTAINER_NAMES.has(node.name.toLowerCase().trim())) names.push(node.name);
            });
            previewModelBoneNames = names.sort((a, b) => a.localeCompare(b));
            // The bone list above wasn't known yet when whichever caller
            // triggered this refresh already called renderAll() itself
            // (this function is async; that call already happened before
            // `await modelLoader.load()` resolved) — one more render,
            // scoped to exactly this case, so the Skeleton Mapping
            // section's own dropdowns actually show the new state once
            // the model finishes loading, not only on some unrelated
            // next edit.
            renderAll();
          } else {
            previewSkeleton = null;
            previewModelBoneNames = [];
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
          formPane.appendChild(buildBodyConstructionSection(draft, renderAll, refreshPreview, uiState));
        } else {
          formPane.appendChild(buildModelSection(draft, modelLibrary, modelAssetStore, renderAll, refreshPreview));
          formPane.appendChild(buildSkeletonMappingSection(draft, modelLibrary, previewSkeleton, previewModelBoneNames, renderAll, refreshPreview));
        }
        formPane.appendChild(buildMovementSection(draft, renderAll, residentProfileStore));
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
    residentProfileId: null,
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
    const data = beingLibrary.exportDefinition(being.id);
    if (!data) return;
    const filename = `${being.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "being"}.json`;
    StorageUtils.downloadJSON(filename, data);
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
  const sourceFieldId = nextDomId("being-source");
  label.htmlFor = sourceFieldId;
  const select = document.createElement("select");
  select.id = sourceFieldId;
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

/** Whether `partId` sits beneath a currently-collapsed ancestor — the
 *  part itself still exists and is still selectable (via the 3D preview
 *  or the editor), just not shown in the list right now. */
function isHiddenByCollapse(bodyParts, partId, collapsedPartIds) {
  let current = bodyParts.find((p) => p.id === partId);
  const seen = new Set();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (collapsedPartIds.has(current.parentId)) return true;
    current = bodyParts.find((p) => p.id === current.parentId);
  }
  return false;
}

function buildBodyConstructionSection(draft, onChange, onPreviewChange, uiState) {
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

  const markersLabel = document.createElement("label");
  markersLabel.className = "builder-checkbox-label";
  const markersCheckbox = document.createElement("input");
  markersCheckbox.type = "checkbox";
  markersCheckbox.checked = uiState.showJointMarkers;
  markersCheckbox.addEventListener("change", () => {
    uiState.showJointMarkers = markersCheckbox.checked;
    onPreviewChange();
  });
  markersLabel.append(markersCheckbox, document.createTextNode(" Show Joint Markers"));
  actions.appendChild(markersLabel);
  section.appendChild(actions);

  const list = document.createElement("ul");
  list.className = "builder-library-list";
  // Dropping a row directly on the list background (not on another row)
  // re-parents it to the root -- the list itself is the "no parent"
  // drop target. dragover must also call preventDefault(), or the
  // browser never treats this as a valid drop zone at all.
  list.addEventListener("dragover", (e) => e.preventDefault());
  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    const draggedPart = draft.bodyParts.find((p) => p.id === draggedId);
    if (!draggedPart || draggedPart.parentId === null) return;
    draggedPart.parentId = null;
    onPreviewChange();
    onChange();
  });
  if (draft.bodyParts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "app-subtitle";
    empty.textContent = "No parts yet \u2014 add one above to start building.";
    list.appendChild(empty);
  }
  for (const part of orderedByHierarchy(draft.bodyParts)) {
    if (isHiddenByCollapse(draft.bodyParts, part.id, uiState.collapsedPartIds)) continue;
    list.appendChild(buildPartRow(draft, part, onChange, onPreviewChange, uiState));
  }
  section.appendChild(list);

  const selectedPart = draft.bodyParts.find((p) => p.id === draft.selectedPartId);
  if (selectedPart) section.appendChild(buildPartEditor(draft, selectedPart, onChange, onPreviewChange));

  return section;
}

function buildPartRow(draft, part, onChange, onPreviewChange, uiState) {
  const li = document.createElement("li");
  if (part.id === draft.selectedPartId) li.classList.add("selected");

  // Version 3, Phase 10c ("Being Creator, Beyond the Prototype, Wave 2")
  // -- true drag-and-drop re-parenting. descendantIds() (already used
  // by the Parent dropdown below) rules out dropping a part onto its
  // own descendant, the same cycle guard either UI surface needs.
  li.draggable = true;
  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", part.id);
    e.dataTransfer.effectAllowed = "move";
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault(); // required for this element to register as a valid drop target
    e.stopPropagation(); // this row is the intended target, not the list background's own "drop to root" handler
    li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("drag-over");
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === part.id) return;
    const excluded = descendantIds(draft.bodyParts, draggedId);
    excluded.add(draggedId);
    if (excluded.has(part.id)) return; // would create a cycle
    const draggedPart = draft.bodyParts.find((p) => p.id === draggedId);
    if (!draggedPart) return;
    draggedPart.parentId = part.id;
    onPreviewChange();
    onChange();
  });

  const hasChildren = draft.bodyParts.some((p) => p.parentId === part.id);
  if (hasChildren) {
    const collapseToggle = document.createElement("button");
    collapseToggle.type = "button";
    collapseToggle.className = "builder-collapse-toggle";
    const collapsed = uiState.collapsedPartIds.has(part.id);
    collapseToggle.textContent = collapsed ? "▸" : "▾";
    collapseToggle.title = collapsed ? "Expand" : "Collapse";
    collapseToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // don't also select the row underneath
      if (collapsed) uiState.collapsedPartIds.delete(part.id);
      else uiState.collapsedPartIds.add(part.id);
      onChange();
    });
    li.appendChild(collapseToggle);
  }

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

  const positionHint = document.createElement("p");
  positionHint.className = "app-subtitle";
  positionHint.textContent = "Position/Rotation describe this part's own joint \u2014 where it attaches to its parent, and what a Workshop animation actually rotates. Mesh Offset (below) moves the visible shape relative to that joint.";
  section.appendChild(positionHint);
  section.appendChild(vectorRow("Position", part.position, -3, 3, 0.01, (v) => { part.position = v; onPreviewChange(); }));
  section.appendChild(vectorRow("Rotation", part.rotation.map((r) => r * RAD_TO_DEG), -180, 180, 1, (v) => { part.rotation = v.map((d) => d * DEG_TO_RAD); onPreviewChange(); }, "\u00b0"));
  section.appendChild(vectorRow("Scale", part.scale, 0.02, 2, 0.01, (v) => { part.scale = v; onPreviewChange(); }));

  section.appendChild(buildMeshOffsetSection(part, onChange, onPreviewChange));

  section.appendChild(selectRow("Material", part.material ?? "matte", BODY_PART_MATERIALS, (v) => { part.material = v; onPreviewChange(); }));

  const colorRow = document.createElement("div");
  colorRow.className = "panel-row";
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "Colour";
  const colorFieldId = nextDomId("being-color");
  colorLabel.htmlFor = colorFieldId;
  const colorInput = document.createElement("input");
  colorInput.id = colorFieldId;
  colorInput.type = "color";
  colorInput.value = part.color;
  colorInput.addEventListener("input", () => { part.color = colorInput.value; onPreviewChange(); });
  colorRow.append(colorLabel, colorInput);
  section.appendChild(colorRow);

  return section;
}

/** Version 3, Phase 10b ("Being Creator, Beyond the Prototype") —
 *  authoring UI for `BodyCompiler.js`'s own new `meshOffset` field (see
 *  its module comment for the full architecture story). "Hang Below
 *  Pivot" is the common case made one click: a limb's shape sitting
 *  directly beneath its own joint, sized to whatever this part's
 *  current Scale already is — recomputed fresh every click, so
 *  adjusting Scale first and pressing this after always matches. The
 *  slider row underneath stays available for anything the one-click
 *  case doesn't cover (a shape offset sideways or forward instead of
 *  straight down, say). `onChange` (not just `onPreviewChange`) after
 *  the button click, matching every other structural action in this
 *  file (Add Part, Mirror, Rig Joint) — the slider row itself needs a
 *  real re-render to show the values the button just computed, not just
 *  a 3D preview refresh. */
function buildMeshOffsetSection(part, onChange, onPreviewChange) {
  const wrap = document.createElement("div");

  const hangBtn = document.createElement("button");
  hangBtn.type = "button";
  hangBtn.className = "builder-small-button";
  hangBtn.textContent = "Hang Below Pivot";
  hangBtn.title = "Set Mesh Offset so this part's shape hangs directly below its own joint, sized to its current Scale.";
  hangBtn.addEventListener("click", () => {
    part.meshOffset = [0, -(part.scale[1] ?? 0) / 2, 0];
    onPreviewChange();
    onChange();
  });
  wrap.appendChild(hangBtn);

  wrap.appendChild(vectorRow("Mesh Offset", part.meshOffset ?? [0, 0, 0], -3, 3, 0.01, (v) => { part.meshOffset = v; onPreviewChange(); }));

  return wrap;
}

/** Three sliders in a row (X/Y/Z), for position/rotation/scale/mesh
 *  offset — the vector fields every body part has. `onChange` receives
 *  the whole updated `[x,y,z]` array each time any one axis changes, so
 *  a caller never has to reassemble it from three separate callbacks.
 *  Version 3, Phase 10c ("Being Creator, Beyond the Prototype, Wave 2")
 *  — each axis also gets a real number input beside its slider, synced
 *  both ways: dragging the slider updates the number, typing an exact
 *  value (committed on blur/Enter, not per keystroke — the same
 *  `"change"` convention `textRow()` already uses, so a value mid-typo
 *  never fires a preview refresh) updates the slider. A number input
 *  isn't bounded by `min`/`max` the way the slider visually is — typing
 *  something outside that range still applies it, the slider just
 *  displays clamped to its own ends, an intentional "advanced editor"
 *  escape hatch from the slider's own more casual range. */
function vectorRow(label, values, min, max, step, onChange, unit = "") {
  const wrap = document.createElement("div");
  wrap.className = "panel-row";
  // Version 3, Phase 12 — three real, separately-editable inputs (a
  // slider and a number field) per axis, not one control this outer
  // label could sensibly `htmlFor` — a `role="group"` with its own
  // `aria-label`, plus a per-axis `aria-label` on each input below
  // ("Position X", "Position Y", ...), is the honest fix here, not a
  // for/id pointing at just one of six controls.
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", label);
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

    const axisAccessibleLabel = `${label} ${axisLabel}`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.setAttribute("aria-label", axisAccessibleLabel);
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(values[axis]);

    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.setAttribute("aria-label", axisAccessibleLabel);
    numberInput.className = "being-vector-number";
    numberInput.step = String(step);
    numberInput.value = values[axis].toFixed(2);

    const commit = (v) => {
      current[axis] = v;
      onChange([...current]);
    };

    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      numberInput.value = v.toFixed(2);
      commit(v);
    });
    numberInput.addEventListener("change", () => {
      let v = parseFloat(numberInput.value);
      if (!Number.isFinite(v)) v = current[axis]; // reject garbage/empty input rather than propagate NaN
      slider.value = String(v); // range inputs clamp their own displayed value to [min,max]; the true typed value still commits below
      numberInput.value = v.toFixed(2);
      commit(v);
    });

    axisWrap.append(axisTag, numberInput, slider);
    if (unit) {
      const unitTag = document.createElement("span");
      unitTag.className = "being-vector-unit";
      unitTag.textContent = unit;
      axisWrap.appendChild(unitTag);
    }
    axesWrap.appendChild(axisWrap);
  });
  wrap.appendChild(axesWrap);
  return wrap;
}

function iconButton(glyph, title, onClick) {
  return createIconButton({ className: "builder-icon-button", glyph, label: title, onClick });
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
  const modelFieldId = nextDomId("being-model");
  label.htmlFor = modelFieldId;
  const select = document.createElement("select");
  select.id = modelFieldId;
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
    try {
      draft.modelId = await importModelFile(file, { modelLibrary, modelAssetStore });
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
// Skeleton Mapping \u2014 Version 4, Phase 8d ("The Rest of IK") \u2014 "allow
// imported rigs to be mapped onto a common Workshop skeleton" already
// had a real, working heuristic (`WorkshopSkeleton.autoMapSkeleton()`)
// and a real place to save a correction (`ModelLibrary.setSkeletonMap()`,
// already documented as waiting on "no editing UI exists yet"). This is
// that UI \u2014 one dropdown per Workshop joint, the identical
// `selectRow()` shape `buildPartEditor()`'s own "Rig Joint" row already
// uses for a primitive part, just pointed at an imported model's own
// bone names instead.
// ---------------------------------------------------------------------
function buildSkeletonMappingSection(draft, modelLibrary, previewSkeleton, previewModelBoneNames, onChange, onPreviewChange) {
  const section = document.createElement("div");
  section.className = "builder-section";
  section.appendChild(sectionHeading("Skeleton Mapping"));

  if (!draft.modelId) {
    const hint = document.createElement("p");
    hint.className = "app-subtitle";
    hint.textContent = "Import a model above to map its own bones onto the Workshop skeleton.";
    section.appendChild(hint);
    return section;
  }
  if (previewModelBoneNames.length === 0) {
    const hint = document.createElement("p");
    hint.className = "app-subtitle";
    hint.textContent = "Loading this model's own bones\u2026";
    section.appendChild(hint);
    return section;
  }

  const cachedMap = modelLibrary.get(draft.modelId)?.skeletonMap ?? null;
  const hint = document.createElement("p");
  hint.className = "app-subtitle";
  hint.textContent = cachedMap
    ? "Corrected by hand \u2014 each Workshop joint below is mapped to one of this model's own bones. Leave a joint unmapped if nothing here should drive it."
    : "Auto-detected \u2014 shown below exactly as it will animate. Change any joint to correct a wrong guess; every other joint keeps its own current detection.";
  section.appendChild(hint);

  // The map this model would actually resolve to right now, one entry
  // per joint \u2014 the cached override where one exists, the live
  // auto-detected guess otherwise, so an untouched model shows its real
  // current behaviour rather than a blank list (the same "an honest
  // preview of what actually happens" standard this file's own
  // refreshPreview() already holds itself to).
  const effectiveNames = {};
  for (const joint of WORKSHOP_JOINTS) {
    effectiveNames[joint.id] = cachedMap?.[joint.id] ?? previewSkeleton?.map?.[joint.id]?.name ?? "";
  }

  const options = [["", "\u2014 Not mapped \u2014"], ...previewModelBoneNames.map((n) => [n, n])];
  for (const joint of WORKSHOP_JOINTS) {
    section.appendChild(
      selectRow(joint.label, effectiveNames[joint.id], options, (v) => {
        // Changing one joint "promotes" the *entire* current effective
        // map \u2014 every other joint's own already-correct detection
        // included \u2014 into a real, explicit, saved override, rather
        // than starting the player over from a blank slate for every
        // joint they didn't actually mean to touch.
        const promoted = { ...effectiveNames, [joint.id]: v };
        const cleaned = Object.fromEntries(Object.entries(promoted).filter(([, name]) => name));
        modelLibrary.setSkeletonMap(draft.modelId, Object.keys(cleaned).length > 0 ? cleaned : null);
        onPreviewChange();
        onChange();
      })
    );
  }

  if (cachedMap) {
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "builder-small-button";
    resetBtn.textContent = "Reset to Auto-Detected";
    resetBtn.addEventListener("click", () => {
      // ModelLibrary.setSkeletonMap()'s own documented "forget this and
      // re-detect" contract \u2014 no separate store method needed.
      modelLibrary.setSkeletonMap(draft.modelId, null);
      onPreviewChange();
      onChange();
    });
    section.appendChild(resetBtn);
  }

  return section;
}

// ---------------------------------------------------------------------
// Movement & Behaviour
// ---------------------------------------------------------------------
function buildMovementSection(draft, onChange, residentProfileStore) {
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
  section.appendChild(selectRow("Interaction", draft.interactionBehaviour, INTERACTION_BEHAVIOURS, (v) => { draft.interactionBehaviour = v; onChange(); }));

  // Version 4, Phase 7 ("Being ↔ Resident Convergence") — only shown once
  // "AI Resident" is actually chosen above; `residentProfileId` is just a
  // reference into `ResidentProfileStore`, the same shape
  // `idleAnimationClipId` below already is for `AnimationLibraryStore`.
  // Deliberately not full CRUD here (rename/duplicate/export/delete stay
  // Mission Control's own job) — a small "New Profile…" affordance covers
  // the one action this screen genuinely needs.
  if (draft.interactionBehaviour === "aiResident" && residentProfileStore) {
    const profiles = residentProfileStore.all();
    const options = [["", "— choose a profile —"], ...profiles.map((p) => [p.id, p.name])];
    const profileRow = selectRow("Resident Profile", draft.residentProfileId ?? "", options, (v) => { draft.residentProfileId = v || null; });
    section.appendChild(profileRow);

    const newProfileBtn = document.createElement("button");
    newProfileBtn.type = "button";
    newProfileBtn.className = "workshop-phone-small-button";
    newProfileBtn.textContent = "New Profile…";
    newProfileBtn.addEventListener("click", () => {
      const name = window.prompt("Name this resident's own AI profile:", draft.name || "New Resident");
      if (!name) return;
      const profile = residentProfileStore.create(name);
      draft.residentProfileId = profile.id;
      onChange();
    });
    section.appendChild(newProfileBtn);

    const hint = document.createElement("p");
    hint.className = "app-subtitle";
    hint.textContent = "Configure this profile's own personality, memory, and behaviour in AI Mission Control.";
    section.appendChild(hint);
  }

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
  const fieldId = nextDomId("being-text");
  labelEl.htmlFor = fieldId;
  const input = document.createElement("input");
  input.id = fieldId;
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
  const fieldId = nextDomId("being-textarea");
  labelEl.htmlFor = fieldId;
  const textarea = document.createElement("textarea");
  textarea.id = fieldId;
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
  const fieldId = nextDomId("being-slider");
  labelEl.htmlFor = fieldId;
  const input = document.createElement("input");
  input.id = fieldId;
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
  const fieldId = nextDomId("being-select");
  labelEl.htmlFor = fieldId;
  const select = document.createElement("select");
  select.id = fieldId;
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
