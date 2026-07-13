import { PreviewRenderer } from "./builder/PreviewRenderer.js";
import { buildCharacter, disposeCharacter, applyPose } from "../../player/PlayerCharacter.js";
import { resolveTextureImages } from "../../player/PlayerCharacterSystem.js";
import { StorageUtils } from "../../utils/StorageUtils.js";
import { autoMapSkeleton, isSkeletonMapUsable } from "../../player/WorkshopSkeleton.js";
import { applyPoseToMappedSkeleton } from "../../player/AnimationRetargeting.js";

const ANIMATION_FILE_FORMAT = "workshop-animation";
const ANIMATION_FILE_VERSION = 1;

const PIVOT_GROUPS = [
  { label: "Head & Torso", pivots: ["head", "torso"] },
  { label: "Arms", pivots: ["upperArmLeft", "upperArmRight", "lowerArmLeft", "lowerArmRight", "handLeft", "handRight"] },
  { label: "Legs", pivots: ["upperLegLeft", "upperLegRight", "lowerLegLeft", "lowerLegRight", "footLeft", "footRight"] },
];
const PIVOT_LABELS = {
  head: "Head", torso: "Torso",
  upperArmLeft: "Upper Arm (L)", upperArmRight: "Upper Arm (R)",
  lowerArmLeft: "Lower Arm (L)", lowerArmRight: "Lower Arm (R)",
  handLeft: "Hand (L)", handRight: "Hand (R)",
  upperLegLeft: "Upper Leg (L)", upperLegRight: "Upper Leg (R)",
  lowerLegLeft: "Lower Leg (L)", lowerLegRight: "Lower Leg (R)",
  footLeft: "Foot (L)", footRight: "Foot (R)",
};
const CATEGORY_LABELS = { movement: "Movement", emote: "Emote", custom: "Custom" };
const AXIS_LABELS = ["X", "Y", "Z"];
const DEG = 180 / Math.PI;

/**
 * createAnimationEditorApp
 * ---------------------------
 * "Think of this less as building a game animation editor, and more as
 * creating another creative application inside the Workshop." Same shape
 * as the Builder app on purpose: a live preview that's always visible on
 * one side, editing tools on the other, changes applied immediately, no
 * modal dialogs or wizard steps.
 *
 * **Working copy, not live editing.** Unlike the Wardrobe (where every
 * slider writes straight through to the live-worn appearance), this app
 * edits a local, deep-copied draft of whichever clip is selected, saved
 * back to `AnimationLibraryStore` only on explicit "Save" — an animation
 * mid-edit (a frame half-posed, a duration being typed) shouldn't be
 * live in the Workshop the instant a slider moves, especially since the
 * player's own on-screen character could be playing this exact clip
 * while it's being edited. A default clip (`animationLibraryStore.isDefault()`)
 * is shown but its editing controls are disabled — "Duplicate to Edit"
 * is the one action offered, producing a fresh, fully-editable user clip
 * to work from instead, the same read-only-defaults rule the Builder's
 * own Construction Library already follows.
 *
 * The preview is its own small, isolated scene (`PreviewRenderer`, the
 * exact pattern the Builder and Wardrobe apps already use) — a second
 * character rig built fresh here, not the player's actual on-screen one,
 * so posing it for editing never has any effect on what's actually
 * happening in the Workshop right now.
 */
export function createAnimationEditorApp({ appearanceStore, textureStore, animationLibraryStore, beingLibrary, modelLibrary, modelLoader, poseLibraryStore }) {
  return {
    id: "animationEditor",
    label: "Animation Editor",
    glyph: "\u{1F3AC}",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Animation Editor";
      container.appendChild(heading);

      const workspace = document.createElement("div");
      workspace.className = "builder-workspace";

      const previewPane = document.createElement("div");
      previewPane.className = "builder-workspace-preview";
      workspace.appendChild(previewPane);

      const previewSlot = document.createElement("div");
      previewSlot.className = "builder-preview";
      previewSlot.style.height = "100%";
      previewPane.appendChild(previewSlot);
      const preview = new PreviewRenderer(previewSlot, { lookAtHeight: 0.9, distance: 3 });

      // "Playback controls should simply overlay the bottom of the
      // preview" — an absolutely-positioned overlay (see
      // .anim-playback-bar's own CSS) rather than a separate stacked
      // element sharing the pane's height with the preview, so the
      // preview itself can use the full available space. Appended after
      // previewSlot so it paints on top, matching the CSS z-order that
      // relies on.
      const playbackBar = document.createElement("div");
      playbackBar.className = "anim-playback-bar";
      previewPane.appendChild(playbackBar);

      const form = document.createElement("div");
      form.className = "builder-workspace-form";
      workspace.appendChild(form);
      container.appendChild(workspace);

      // --- Model Selection — "Player models, Saved Being models,
      // Imported Workshop models... the preview should become
      // independent of any single character." A plain select, grouped by
      // source; "modelSource" is {type: "player"} | {type: "being", id} |
      // {type: "model", id}. As of the Advanced Animation phase, this is
      // genuine retargeted preview, not only a proportions check — the
      // moment a Being/Model's own skeleton maps onto the shared Workshop
      // vocabulary well enough (`WorkshopSkeleton.isSkeletonMapUsable()`),
      // the current pose/playback applies through
      // `AnimationRetargeting.applyPoseToMappedSkeleton()` exactly the
      // same way `BeingController.js` already does for a placed Being.
      // The keyframe *editing* controls below still only ever move the
      // Player rig's own pivots regardless of which model is being
      // previewed — editing a clip is authored once, against the shared
      // vocabulary, not against any one specific rig's own bone names.
      let modelSource = { type: "player" };
      let previewSkeleton = null; // {map, rest} once a non-Player preview's own skeleton maps usably; null for the Player rig itself (see applyPreviewPose() below) or an unmappable model
      const modelSelectRow = document.createElement("div");
      modelSelectRow.className = "panel-row";
      const modelSelectLabel = document.createElement("label");
      modelSelectLabel.textContent = "Model";
      const modelSelect = document.createElement("select");
      const modelNote = document.createElement("p");
      modelNote.className = "app-subtitle";

      function populateModelSelect() {
        modelSelect.innerHTML = "";
        const playerOpt = document.createElement("option");
        playerOpt.value = "player";
        playerOpt.textContent = "Player";
        modelSelect.appendChild(playerOpt);

        if (beingLibrary?.all().length) {
          const beingGroup = document.createElement("optgroup");
          beingGroup.label = "Saved Beings";
          for (const being of beingLibrary.all()) {
            const opt = document.createElement("option");
            opt.value = `being:${being.id}`;
            opt.textContent = being.name;
            beingGroup.appendChild(opt);
          }
          modelSelect.appendChild(beingGroup);
        }
        if (modelLibrary?.all().length) {
          const modelGroup = document.createElement("optgroup");
          modelGroup.label = "Imported Models";
          for (const model of modelLibrary.all()) {
            const opt = document.createElement("option");
            opt.value = `model:${model.id}`;
            opt.textContent = model.name;
            modelGroup.appendChild(opt);
          }
          modelSelect.appendChild(modelGroup);
        }
        modelSelect.value =
          modelSource.type === "player" ? "player" : modelSource.type === "being" ? `being:${modelSource.id}` : `model:${modelSource.id}`;
      }

      modelSelect.addEventListener("change", () => {
        const [type, id] = modelSelect.value.split(":");
        modelSource = type === "player" ? { type: "player" } : { type, id };
        rebuildPreviewRig();
      });
      populateModelSelect();
      modelSelectRow.append(modelSelectLabel, modelSelect);
      previewPane.appendChild(modelSelectRow);
      previewPane.appendChild(modelNote);
      const offBeingsChanged = beingLibrary?.events.on("beings:changed", populateModelSelect);
      const offModelsChanged = modelLibrary?.events.on("library:changed", populateModelSelect);

      // --- Preview rig (a second, isolated rig — never the live player's own) ---
      let rig = null;
      let disposed = false;

      async function rebuildPreviewRig() {
        if (modelSource.type !== "player") {
          const libraryEntry = modelSource.type === "being" ? beingLibrary?.get(modelSource.id) : modelLibrary?.get(modelSource.id);
          const modelId = modelSource.type === "being" ? libraryEntry?.modelId : modelSource.id;
          const object3D = (modelId && (await modelLoader?.load(modelId))) ?? modelLoader?.buildPlaceholder();
          if (disposed || modelSource.type === "player") return; // selection changed again while this resolved
          preview.setObject(object3D);
          previewSkeleton = null;
          if (modelId) {
            const { map, rest } = autoMapSkeleton(object3D);
            previewSkeleton = isSkeletonMapUsable(map) ? { map, rest } : null;
          }
          modelNote.textContent = previewSkeleton
            ? "Retargeted preview \u2014 this model's own skeleton mapped onto the shared Workshop vocabulary well enough to play this clip directly. Editing still moves the Player rig's own named parts."
            : "This model's skeleton couldn't be mapped confidently enough to preview retargeted playback \u2014 showing its own proportions only. Editing still moves the Player rig's own named parts.";
          applyCurrentFramePose();
          return;
        }
        const textureImages = await resolveTextureImages(appearanceStore.appearance, textureStore);
        if (disposed || modelSource.type !== "player") return;
        if (rig) disposeCharacter(rig);
        rig = buildCharacter(appearanceStore.appearance, appearanceStore.bodyModelId, textureImages);
        previewSkeleton = null;
        modelNote.textContent = "";
        preview.setObject(rig.root);
        applyCurrentFramePose();
      }

      /** The one place a pose actually gets applied to whichever preview
       *  is currently showing — the Player rig directly
       *  (`PlayerCharacter.applyPose()`, unchanged), or a retargeted
       *  skeleton (`AnimationRetargeting.applyPoseToMappedSkeleton()`) if
       *  one's active. Every other call site (frame selection, playback)
       *  calls this instead of choosing between the two itself. */
      function applyPreviewPose(pose) {
        if (rig) applyPose(rig.pivots, pose);
        else if (previewSkeleton) applyPoseToMappedSkeleton(pose, previewSkeleton.map, previewSkeleton.rest);
      }

      // --- Editor state ---
      let selectedClipId = null;
      let draft = null; // a deep-copied, mutable clip — see this file's own comment
      let selectedFrameIndex = 0;
      let selectedPivot = "torso";
      let isPlaying = false;
      let loopPreview = true;
      let playbackFrameIndex = 0;
      let playbackT = 0;
      let lastTimestamp = null;
      let rafHandle = null;

      function isEditable() {
        return draft !== null && !animationLibraryStore.isDefault(selectedClipId);
      }

      function selectClip(id) {
        stopPlayback();
        selectedClipId = id;
        const source = animationLibraryStore.getClip(id);
        draft = source ? JSON.parse(JSON.stringify(source)) : null;
        selectedFrameIndex = 0;
        render();
        applyCurrentFramePose();
      }

      function saveDraft() {
        if (!draft || !isEditable()) return;
        animationLibraryStore.update(selectedClipId, {
          name: draft.name, description: draft.description, category: draft.category,
          loop: draft.loop, speed: draft.speed, frames: draft.frames,
        });
      }

      function duplicateToEdit() {
        if (!selectedClipId) return;
        const copy = animationLibraryStore.duplicate(selectedClipId);
        if (copy) selectClip(copy.id);
      }

      function applyCurrentFramePose() {
        if (!draft || (!rig && !previewSkeleton)) return;
        const frame = draft.frames[selectedFrameIndex];
        if (frame) applyPreviewPose(frame.pose);
      }

      // --- Playback (this editor's own — separate from PlayerAnimationSystem, since this is a preview scene, not the live player) ---
      function startPlayback() {
        if (!draft || draft.frames.length === 0) return;
        isPlaying = true;
        playbackFrameIndex = selectedFrameIndex;
        playbackT = 0;
        lastTimestamp = null;
        renderPlaybackBar();
        // requestAnimationFrame, not a direct tick() call — tick()'s very
        // first invocation needs a real `timestamp` from the browser's
        // own RAF scheduler. Calling tick() directly here used to pass no
        // argument at all, making the first dt computation
        // (undefined - undefined) a genuine NaN — which then never
        // recovers through ordinary arithmetic, silently poisoning
        // playbackT, then the blend parameter, then every interpolated
        // rotation, on every following frame too. That's the actual
        // cause of "the rendered player model disappears": NaN rotations
        // corrupt the whole rig's transform hierarchy below whichever
        // pivot receives them, which WebGL then simply fails to draw.
        rafHandle = requestAnimationFrame(tick);
      }

      function stopPlayback() {
        isPlaying = false;
        if (rafHandle) cancelAnimationFrame(rafHandle);
        rafHandle = null;
        renderPlaybackBar();
      }

      function tick(timestamp) {
        if (!isPlaying || disposed) return;
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
        lastTimestamp = timestamp;

        const frame = draft.frames[playbackFrameIndex];
        if (frame) {
          playbackT += dt * (draft.speed || 1);
          if (playbackT >= Math.max(frame.duration, 0.001)) {
            playbackT = 0;
            const atEnd = playbackFrameIndex >= draft.frames.length - 1;
            if (atEnd) {
              if (loopPreview) playbackFrameIndex = 0;
              else {
                stopPlayback();
                return;
              }
            } else {
              playbackFrameIndex++;
            }
          }
          const currentFrame = draft.frames[playbackFrameIndex];
          const nextFrame = draft.frames[(playbackFrameIndex + 1) % draft.frames.length];
          const t = Math.min(1, playbackT / Math.max(currentFrame.duration, 0.001));
          const blended = blendPoses(currentFrame.pose, nextFrame.pose, t);
          applyPreviewPose(blended);
        }
        rafHandle = requestAnimationFrame(tick);
      }

      function blendPoses(a, b, t) {
        const result = {};
        const names = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const name of names) {
          const ra = a[name] ?? [0, 0, 0];
          const rb = b[name] ?? [0, 0, 0];
          result[name] = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t];
        }
        return result;
      }

      // --- Frame operations ---
      function addFrame() {
        if (!isEditable()) return;
        const lastFrame = draft.frames[selectedFrameIndex] ?? draft.frames[draft.frames.length - 1];
        draft.frames.splice(selectedFrameIndex + 1, 0, { duration: lastFrame?.duration ?? 0.3, pose: JSON.parse(JSON.stringify(lastFrame?.pose ?? {})) });
        selectedFrameIndex++;
        saveDraft();
        render();
        applyCurrentFramePose();
      }

      function duplicateFrame(index) {
        if (!isEditable()) return;
        const frame = draft.frames[index];
        draft.frames.splice(index + 1, 0, JSON.parse(JSON.stringify(frame)));
        selectedFrameIndex = index + 1;
        saveDraft();
        render();
      }

      function deleteFrame(index) {
        if (!isEditable() || draft.frames.length <= 1) return;
        draft.frames.splice(index, 1);
        selectedFrameIndex = Math.min(selectedFrameIndex, draft.frames.length - 1);
        saveDraft();
        render();
        applyCurrentFramePose();
      }

      function moveFrame(index, direction) {
        if (!isEditable()) return;
        const target = index + direction;
        if (target < 0 || target >= draft.frames.length) return;
        [draft.frames[index], draft.frames[target]] = [draft.frames[target], draft.frames[index]];
        selectedFrameIndex = target;
        saveDraft();
        render();
      }

      function setFrameDuration(index, duration) {
        if (!isEditable()) return;
        draft.frames[index].duration = Math.max(0.02, duration);
        saveDraft();
      }

      function setPivotRotation(axisIndex, degrees) {
        if (!isEditable()) return;
        const frame = draft.frames[selectedFrameIndex];
        const current = frame.pose[selectedPivot] ?? [0, 0, 0];
        const next = [...current];
        next[axisIndex] = degrees / DEG;
        frame.pose[selectedPivot] = next;
        saveDraft();
        applyCurrentFramePose();
      }

      function exportClip(id) {
        const clip = animationLibraryStore.getClip(id);
        if (!clip) return;
        // A simple, self-describing wrapper — format/version markers up
        // front so a future version of this app can tell an old export
        // apart from a new one without guessing, the same reasoning
        // every persisted store in this project already follows for its
        // own save shape.
        const payload = {
          format: ANIMATION_FILE_FORMAT,
          version: ANIMATION_FILE_VERSION,
          clip: { name: clip.name, description: clip.description, category: clip.category, loop: clip.loop, speed: clip.speed, frames: clip.frames },
        };
        const filename = `${clip.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "animation"}.json`;
        StorageUtils.downloadJSON(filename, payload);
      }

      async function importClip() {
        let payload;
        try {
          payload = await StorageUtils.uploadJSON();
        } catch {
          return; // cancelled or unreadable — nothing to do
        }
        const clipData = payload?.format === ANIMATION_FILE_FORMAT ? payload.clip : payload; // tolerate a bare clip object too, not just the wrapped format
        if (!clipData?.frames || !Array.isArray(clipData.frames)) {
          window.alert("That file doesn't look like a Workshop animation.");
          return;
        }
        const clip = animationLibraryStore.create({
          name: clipData.name ? `${clipData.name} (imported)` : "Imported animation",
          description: clipData.description ?? "",
          category: clipData.category ?? "custom",
          loop: clipData.loop ?? true,
          speed: clipData.speed ?? 1,
          frames: clipData.frames,
        });
        selectClip(clip.id);
      }

      // --- Rendering ---
      function render() {
        form.innerHTML = "";
        form.appendChild(buildLibrarySection());
        if (draft) {
          if (!isEditable()) form.appendChild(buildReadOnlyNotice());
          form.appendChild(buildPropertiesSection());
          form.appendChild(buildFrameListSection());
          form.appendChild(buildPartSelectionSection());
          form.appendChild(buildRotationSection());
        }
        renderPlaybackBar();
      }

      function buildReadOnlyNotice() {
        const notice = document.createElement("div");
        notice.className = "anim-readonly-notice";
        notice.textContent = "This is one of the Workshop's default animations and can't be edited directly.";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "builder-primary";
        btn.textContent = "Duplicate to Edit";
        btn.addEventListener("click", duplicateToEdit);
        notice.appendChild(btn);
        return notice;
      }

      function buildLibrarySection() {
        const section = document.createElement("div");
        section.className = "builder-section builder-library";
        const heading = document.createElement("h2");
        heading.textContent = "Animation Library";
        section.appendChild(heading);

        const actions = document.createElement("div");
        actions.className = "builder-library-controls";
        const newBtn = document.createElement("button");
        newBtn.type = "button";
        newBtn.className = "builder-primary";
        newBtn.textContent = "New Animation";
        newBtn.addEventListener("click", () => {
          const clip = animationLibraryStore.create({ name: "Untitled animation", category: "custom", loop: true, speed: 1, frames: [{ duration: 0.3, pose: {} }] });
          selectClip(clip.id);
        });
        actions.appendChild(newBtn);

        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.className = "builder-small-button";
        importBtn.textContent = "Import";
        importBtn.addEventListener("click", importClip);
        actions.appendChild(importBtn);

        section.appendChild(actions);

        const list = document.createElement("ul");
        list.className = "builder-library-list";
        for (const clip of animationLibraryStore.all()) {
          list.appendChild(buildLibraryRow(clip));
        }
        section.appendChild(list);
        return section;
      }

      function buildLibraryRow(clip) {
        const li = document.createElement("li");
        if (clip.id === selectedClipId) li.classList.add("selected");

        const meta = document.createElement("span");
        meta.className = "builder-library-meta";
        meta.textContent = animationLibraryStore.isDefault(clip.id) ? `${clip.name} (default)` : clip.name;
        li.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "builder-inline-row";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "builder-icon-button";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => selectClip(clip.id));
        actions.appendChild(editBtn);

        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "builder-icon-button";
        dupBtn.textContent = "Duplicate";
        dupBtn.addEventListener("click", () => {
          const copy = animationLibraryStore.duplicate(clip.id);
          if (copy) selectClip(copy.id);
        });
        actions.appendChild(dupBtn);

        const exportBtn = document.createElement("button");
        exportBtn.type = "button";
        exportBtn.className = "builder-icon-button";
        exportBtn.textContent = "Export";
        exportBtn.addEventListener("click", () => exportClip(clip.id));
        actions.appendChild(exportBtn);

        if (!animationLibraryStore.isDefault(clip.id)) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "builder-icon-button";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", () => {
            if (!window.confirm(`Delete "${clip.name}"? This can't be undone.`)) return;
            animationLibraryStore.remove(clip.id);
            if (selectedClipId === clip.id) { selectedClipId = null; draft = null; render(); }
          });
          actions.appendChild(delBtn);
        }
        li.appendChild(actions);
        return li;
      }

      function buildPropertiesSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = "Properties";
        section.appendChild(heading);
        const disabled = !isEditable();

        section.appendChild(buildTextRow("Name", draft.name, (v) => { draft.name = v; saveDraft(); }, disabled));
        section.appendChild(buildTextRow("Description", draft.description, (v) => { draft.description = v; saveDraft(); }, disabled));

        const categoryRow = document.createElement("div");
        categoryRow.className = "panel-row";
        const categoryLabel = document.createElement("label");
        categoryLabel.textContent = "Category";
        const categorySelect = document.createElement("select");
        categorySelect.disabled = disabled;
        for (const [value, label] of Object.entries(CATEGORY_LABELS)) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          if (draft.category === value) opt.selected = true;
          categorySelect.appendChild(opt);
        }
        categorySelect.addEventListener("change", () => { draft.category = categorySelect.value; saveDraft(); });
        categoryRow.append(categoryLabel, categorySelect);
        section.appendChild(categoryRow);

        const speedRow = document.createElement("div");
        speedRow.className = "panel-row";
        const speedLabel = document.createElement("label");
        speedLabel.textContent = "Playback Speed";
        const speedInput = document.createElement("input");
        speedInput.type = "range";
        speedInput.min = "0.25"; speedInput.max = "3"; speedInput.step = "0.05";
        speedInput.value = String(draft.speed);
        speedInput.disabled = disabled;
        const speedValue = document.createElement("span");
        speedValue.className = "settings-range-value";
        speedValue.textContent = `${draft.speed.toFixed(2)}x`;
        speedInput.addEventListener("input", () => {
          draft.speed = parseFloat(speedInput.value);
          speedValue.textContent = `${draft.speed.toFixed(2)}x`;
          saveDraft();
        });
        speedRow.append(speedLabel, speedInput, speedValue);
        section.appendChild(speedRow);

        const loopRow = document.createElement("div");
        loopRow.className = "panel-row";
        const loopLabel = document.createElement("label");
        loopLabel.textContent = "Loop";
        const loopCheckbox = document.createElement("input");
        loopCheckbox.type = "checkbox";
        loopCheckbox.checked = draft.loop;
        loopCheckbox.disabled = disabled;
        loopCheckbox.addEventListener("change", () => { draft.loop = loopCheckbox.checked; saveDraft(); });
        loopRow.append(loopLabel, loopCheckbox);
        section.appendChild(loopRow);
        const loopHint = document.createElement("p");
        loopHint.className = "app-subtitle";
        loopHint.textContent = draft.loop
          ? "Loops continuously until interrupted by movement or another animation."
          : "Plays once, then returns naturally to the appropriate idle state.";
        section.appendChild(loopHint);

        return section;
      }

      function buildTextRow(label, value, onChange, disabled) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const input = document.createElement("input");
        input.type = "text";
        input.value = value ?? "";
        input.disabled = disabled;
        input.addEventListener("change", () => onChange(input.value));
        row.append(labelEl, input);
        return row;
      }

      function buildFrameListSection() {
        const section = document.createElement("div");
        section.className = "builder-section builder-library";
        const heading = document.createElement("h2");
        heading.textContent = "Frames";
        section.appendChild(heading);

        const actions = document.createElement("div");
        actions.className = "builder-library-controls";
        if (isEditable()) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "builder-primary";
          addBtn.textContent = "Add Frame";
          addBtn.addEventListener("click", addFrame);
          actions.appendChild(addBtn);
        }
        // "Please introduce the foundations for a shared pose library...
        // these should become reusable Workshop Assets." Saving a pose
        // is a read-only operation on the currently-selected frame's own
        // data (a copy, not a reference) — available even when viewing a
        // read-only default clip, since extracting "just this one pose"
        // from Walk or Wave is exactly the kind of reuse a shared library
        // is for.
        if (poseLibraryStore) {
          const savePoseBtn = document.createElement("button");
          savePoseBtn.type = "button";
          savePoseBtn.className = "builder-small-button";
          savePoseBtn.textContent = "Save Frame as Pose";
          savePoseBtn.addEventListener("click", () => {
            const frame = draft?.frames[selectedFrameIndex];
            if (!frame) return;
            const name = window.prompt("Name this pose:", `${draft.name} \u2014 frame ${selectedFrameIndex + 1}`);
            if (name === null) return; // cancelled
            poseLibraryStore.create({ name, category: draft.category, pose: JSON.parse(JSON.stringify(frame.pose)) });
          });
          actions.appendChild(savePoseBtn);
        }
        if (actions.children.length) section.appendChild(actions);

        const list = document.createElement("ul");
        list.className = "builder-library-list";
        draft.frames.forEach((frame, index) => list.appendChild(buildFrameRow(frame, index)));
        section.appendChild(list);
        return section;
      }

      function buildFrameRow(frame, index) {
        const li = document.createElement("li");
        if (index === selectedFrameIndex) li.classList.add("selected");
        const editable = isEditable();

        const meta = document.createElement("span");
        meta.className = "builder-library-meta";
        meta.textContent = `Frame ${index + 1}`;
        meta.style.cursor = "pointer";
        meta.addEventListener("click", () => {
          stopPlayback();
          selectedFrameIndex = index;
          render();
          applyCurrentFramePose();
        });
        li.appendChild(meta);

        const durationInput = document.createElement("input");
        durationInput.type = "number";
        durationInput.min = "0.02";
        durationInput.step = "0.02";
        durationInput.value = frame.duration;
        durationInput.disabled = !editable;
        durationInput.className = "anim-duration-input";
        durationInput.addEventListener("change", () => setFrameDuration(index, parseFloat(durationInput.value)));
        li.appendChild(durationInput);

        if (editable) {
          const actions = document.createElement("div");
          actions.className = "builder-inline-row";
          const upBtn = document.createElement("button");
          upBtn.type = "button";
          upBtn.className = "builder-icon-button";
          upBtn.textContent = "\u2191";
          upBtn.disabled = index === 0;
          upBtn.addEventListener("click", () => moveFrame(index, -1));
          actions.appendChild(upBtn);

          const downBtn = document.createElement("button");
          downBtn.type = "button";
          downBtn.className = "builder-icon-button";
          downBtn.textContent = "\u2193";
          downBtn.disabled = index === draft.frames.length - 1;
          downBtn.addEventListener("click", () => moveFrame(index, 1));
          actions.appendChild(downBtn);

          const dupBtn = document.createElement("button");
          dupBtn.type = "button";
          dupBtn.className = "builder-icon-button";
          dupBtn.textContent = "Duplicate";
          dupBtn.addEventListener("click", () => duplicateFrame(index));
          actions.appendChild(dupBtn);

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "builder-icon-button";
          delBtn.textContent = "Delete";
          delBtn.disabled = draft.frames.length <= 1;
          delBtn.addEventListener("click", () => deleteFrame(index));
          actions.appendChild(delBtn);
          li.appendChild(actions);
        }
        return li;
      }

      function buildPartSelectionSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = "Body Part";
        section.appendChild(heading);

        for (const group of PIVOT_GROUPS) {
          const groupLabel = document.createElement("p");
          groupLabel.className = "app-subtitle";
          groupLabel.textContent = group.label;
          section.appendChild(groupLabel);

          const tabs = document.createElement("div");
          tabs.className = "wardrobe-part-tabs";
          for (const pivotName of group.pivots) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = PIVOT_LABELS[pivotName];
            btn.className = pivotName === selectedPivot ? "active" : "";
            btn.addEventListener("click", () => { selectedPivot = pivotName; render(); });
            tabs.appendChild(btn);
          }
          section.appendChild(tabs);
        }
        return section;
      }

      function buildRotationSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = `Rotation \u2014 ${PIVOT_LABELS[selectedPivot]}`;
        section.appendChild(heading);

        const editable = isEditable();
        const frame = draft.frames[selectedFrameIndex];
        const rotation = frame.pose[selectedPivot] ?? [0, 0, 0];

        for (let axis = 0; axis < 3; axis++) {
          const row = document.createElement("div");
          row.className = "panel-row";
          const label = document.createElement("label");
          label.textContent = AXIS_LABELS[axis];
          const input = document.createElement("input");
          input.type = "range";
          input.min = "-180"; input.max = "180"; input.step = "1";
          input.value = String(Math.round(rotation[axis] * DEG));
          input.disabled = !editable;
          const valueEl = document.createElement("span");
          valueEl.className = "settings-range-value";
          valueEl.textContent = `${Math.round(rotation[axis] * DEG)}\u00b0`;
          input.addEventListener("input", () => {
            const degrees = parseFloat(input.value);
            valueEl.textContent = `${degrees}\u00b0`;
            setPivotRotation(axis, degrees);
          });
          row.append(label, input, valueEl);
          section.appendChild(row);
        }
        return section;
      }

      function renderPlaybackBar() {
        playbackBar.innerHTML = "";
        if (!draft) return;

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "builder-primary";
        playBtn.textContent = isPlaying ? "Pause" : "Play";
        playBtn.addEventListener("click", () => (isPlaying ? stopPlayback() : startPlayback()));
        playbackBar.appendChild(playBtn);

        const loopBtn = document.createElement("button");
        loopBtn.type = "button";
        loopBtn.className = loopPreview ? "builder-small-button active" : "builder-small-button";
        loopBtn.textContent = "Loop Preview";
        loopBtn.addEventListener("click", () => { loopPreview = !loopPreview; renderPlaybackBar(); });
        playbackBar.appendChild(loopBtn);
      }

      // --- Boot ---
      // Not awaited — mount() itself must return synchronously (see the
      // comment on its own signature above), so the preview rig builds
      // in the background the same way WardrobeApp's own refreshPreview()
      // does; render() below doesn't depend on it existing yet, only the
      // preview pane does, and that updates itself the moment
      // rebuildPreviewRig() actually finishes.
      rebuildPreviewRig();
      const offAppearance = appearanceStore.events.on("appearance:changed", rebuildPreviewRig);
      const offLibrary = animationLibraryStore.events.on("library:changed", () => {
        // Another tab of this same app, or an import, could have changed
        // the library out from under this one — re-render the list, but
        // don't clobber an in-progress edit's own draft.
        render();
      });
      render();

      return () => {
        disposed = true;
        stopPlayback();
        offAppearance();
        offLibrary();
        offBeingsChanged?.();
        offModelsChanged?.();
        if (rig) disposeCharacter(rig);
        preview.dispose();
      };
    },
  };
}
