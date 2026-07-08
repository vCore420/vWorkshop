import { PreviewRenderer } from "./builder/PreviewRenderer.js";
import { buildCharacter, disposeCharacter, PART_IDS } from "../../player/PlayerCharacter.js";
import { resolveTextureImages } from "../../player/PlayerCharacterSystem.js";

const PART_LABELS = {
  head: "Head",
  torso: "Torso",
  upperArm: "Upper Arms",
  lowerArm: "Lower Arms",
  hand: "Hands",
  upperLeg: "Upper Legs",
  lowerLeg: "Lower Legs",
  foot: "Feet",
};
// "Length" reads more naturally than "Height" for a limb — purely a label,
// the underlying field is still just `height` on every part.
const LIMB_PARTS = new Set(["upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg"]);

const MATERIAL_LABELS = { matte: "Matte", fabric: "Fabric", metal: "Metal", glossy: "Glossy", glass: "Glass" };

const PAINT_CANVAS_SIZE = 64;

/**
 * createWardrobeApp
 * -------------------
 * "Think of this as building a wardrobe rather than a character editor" —
 * concretely: a live preview (see PreviewRenderer.js's comment on reusing
 * the Builder app's isolated mini-scene), one part at a time, changes
 * applied immediately, nothing modal or wizard-like about it. Every write
 * goes straight to `PlayerAppearanceStore`/`OutfitStore`/`TextureStore` —
 * this file only ever builds the form and reads the current values back;
 * see docs/PLAYER.md for the full architecture.
 */
export function createWardrobeApp({ appearanceStore, outfitStore, textureStore }) {
  return {
    id: "wardrobe",
    label: "Wardrobe",
    glyph: "\u{1F455}",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Wardrobe";
      container.appendChild(heading);

      const root = document.createElement("div");
      root.className = "builder-root";

      const previewSlot = document.createElement("div");
      previewSlot.className = "builder-preview wardrobe-preview";
      root.appendChild(previewSlot);
      const preview = new PreviewRenderer(previewSlot, { lookAtHeight: 0.8, distance: 2.6 });

      const form = document.createElement("div");
      form.className = "builder-form";
      root.appendChild(form);
      container.appendChild(root);

      let selectedPart = "head";
      let paintOpen = false;
      let disposed = false;
      let previewRebuildInFlight = false;
      let previewRebuildAgainAfter = false;

      async function refreshPreview() {
        if (previewRebuildInFlight) {
          previewRebuildAgainAfter = true;
          return;
        }
        previewRebuildInFlight = true;
        const textureImages = await resolveTextureImages(appearanceStore.appearance, textureStore);
        const built = buildCharacter(appearanceStore.appearance, textureImages);
        if (disposed) {
          // The tab was switched away from while textures were still
          // resolving — nothing left to show this to; dispose it
          // immediately rather than leaking the geometry/materials it just
          // created.
          disposeCharacter(built);
          return;
        }
        if (preview.currentObject) disposeCharacter({ meshes: preview.currentObject.userData.meshes ?? {} });
        built.root.userData.meshes = built.meshes;
        preview.setObject(built.root);
        previewRebuildInFlight = false;
        if (previewRebuildAgainAfter) {
          previewRebuildAgainAfter = false;
          refreshPreview();
        }
      }

      function render() {
        form.innerHTML = "";
        form.appendChild(buildPartTabs());
        form.appendChild(buildProportionsSection());
        form.appendChild(buildAppearanceSection());
        if (paintOpen) form.appendChild(buildPaintSection());
        form.appendChild(buildOutfitsSection());
      }

      function buildPartTabs() {
        const wrap = document.createElement("div");
        wrap.className = "wardrobe-part-tabs";
        for (const partId of PART_IDS) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = PART_LABELS[partId];
          btn.className = partId === selectedPart ? "active" : "";
          btn.addEventListener("click", () => {
            selectedPart = partId;
            paintOpen = false;
            render();
          });
          wrap.appendChild(btn);
        }
        return wrap;
      }

      function buildProportionsSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = `${PART_LABELS[selectedPart]} \u2014 proportions`;
        section.appendChild(heading);

        const part = appearanceStore.getPart(selectedPart);
        const heightLabel = LIMB_PARTS.has(selectedPart) ? "Length" : "Height";
        section.appendChild(buildSlider("Width", part.width, (v) => appearanceStore.updatePart(selectedPart, { width: v })));
        section.appendChild(buildSlider(heightLabel, part.height, (v) => appearanceStore.updatePart(selectedPart, { height: v })));
        section.appendChild(buildSlider("Depth", part.depth, (v) => appearanceStore.updatePart(selectedPart, { depth: v })));
        return section;
      }

      function buildSlider(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0.4";
        input.max = "2";
        input.step = "0.02";
        input.value = String(value);
        const valueEl = document.createElement("span");
        valueEl.className = "settings-range-value";
        valueEl.textContent = `${Math.round(value * 100)}%`;
        input.addEventListener("input", () => {
          const v = parseFloat(input.value);
          valueEl.textContent = `${Math.round(v * 100)}%`;
          onChange(v);
        });
        row.append(labelEl, input, valueEl);
        return row;
      }

      function buildAppearanceSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = "Appearance";
        section.appendChild(heading);

        const part = appearanceStore.getPart(selectedPart);

        const colorRow = document.createElement("div");
        colorRow.className = "panel-row";
        const colorLabel = document.createElement("label");
        colorLabel.textContent = "Colour";
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = part.color;
        colorInput.addEventListener("input", () => appearanceStore.updatePart(selectedPart, { color: colorInput.value }));
        colorRow.append(colorLabel, colorInput);
        section.appendChild(colorRow);

        const materialRow = document.createElement("div");
        materialRow.className = "panel-row";
        const materialLabel = document.createElement("label");
        materialLabel.textContent = "Material";
        const materialSelect = document.createElement("select");
        for (const [value, label] of Object.entries(MATERIAL_LABELS)) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          if (value === part.material) opt.selected = true;
          materialSelect.appendChild(opt);
        }
        materialSelect.addEventListener("change", () => appearanceStore.updatePart(selectedPart, { material: materialSelect.value }));
        materialRow.append(materialLabel, materialSelect);
        section.appendChild(materialRow);

        const textureRow = document.createElement("div");
        textureRow.className = "wardrobe-texture-actions";

        const paintBtn = document.createElement("button");
        paintBtn.type = "button";
        paintBtn.className = "builder-small-button";
        paintBtn.textContent = paintOpen ? "Close painter" : "Paint texture";
        paintBtn.addEventListener("click", () => {
          paintOpen = !paintOpen;
          render();
        });
        textureRow.appendChild(paintBtn);

        const importLabel = document.createElement("label");
        importLabel.className = "builder-small-button wardrobe-import-label";
        importLabel.textContent = "Import image\u2026";
        const importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = "image/*";
        importInput.style.display = "none";
        importInput.addEventListener("change", () => importTexture(importInput.files?.[0]));
        importLabel.appendChild(importInput);
        textureRow.appendChild(importLabel);

        if (part.textureId) {
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "builder-small-button";
          clearBtn.textContent = "Remove texture";
          clearBtn.addEventListener("click", () => clearTexture());
          textureRow.appendChild(clearBtn);
        }
        section.appendChild(textureRow);

        if (part.textureId) {
          const note = document.createElement("p");
          note.className = "app-subtitle";
          note.textContent = "This part is using a custom texture instead of a flat colour.";
          section.appendChild(note);
        }

        return section;
      }

      async function importTexture(file) {
        if (!file) return;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = dataUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = PAINT_CANVAS_SIZE;
        canvas.height = PAINT_CANVAS_SIZE;
        canvas.getContext("2d").drawImage(img, 0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
        await saveCanvasAsTexture(canvas);
        paintOpen = true;
        render();
      }

      async function saveCanvasAsTexture(canvas) {
        const id = textureStore.generateId();
        await textureStore.put(id, canvas.toDataURL("image/png"));
        const previousId = appearanceStore.getPart(selectedPart).textureId;
        appearanceStore.updatePart(selectedPart, { textureId: id });
        await cleanupTextureIfUnused(previousId);
      }

      async function clearTexture() {
        const previousId = appearanceStore.getPart(selectedPart).textureId;
        appearanceStore.updatePart(selectedPart, { textureId: null });
        paintOpen = false;
        render();
        await cleanupTextureIfUnused(previousId);
      }

      /** A texture stops being needed the moment nothing currently worn or
       *  saved still references it — only then is it actually safe to
       *  drop from TextureStore. */
      async function cleanupTextureIfUnused(textureId) {
        if (!textureId) return;
        const stillInLiveAppearance = Object.values(appearanceStore.appearance.parts).some((p) => p.textureId === textureId);
        const stillInOutfits = outfitStore.allReferencedTextureIds().has(textureId);
        if (!stillInLiveAppearance && !stillInOutfits) await textureStore.remove(textureId);
      }

      function buildPaintSection() {
        const section = document.createElement("div");
        section.className = "builder-section";
        const heading = document.createElement("h2");
        heading.textContent = `Paint \u2014 ${PART_LABELS[selectedPart]}`;
        section.appendChild(heading);

        const canvas = document.createElement("canvas");
        canvas.width = PAINT_CANVAS_SIZE;
        canvas.height = PAINT_CANVAS_SIZE;
        canvas.className = "wardrobe-paint-canvas";
        section.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        const part = appearanceStore.getPart(selectedPart);
        (async () => {
          const existingImg = part.textureId ? await textureStore.getAsImage(part.textureId) : null;
          if (existingImg) {
            ctx.drawImage(existingImg, 0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
          } else {
            ctx.fillStyle = part.color;
            ctx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
          }
        })();

        let brushColor = part.color;
        let painting = false;
        const paintAt = (clientX, clientY) => {
          const rect = canvas.getBoundingClientRect();
          const x = Math.floor(((clientX - rect.left) / rect.width) * PAINT_CANVAS_SIZE);
          const y = Math.floor(((clientY - rect.top) / rect.height) * PAINT_CANVAS_SIZE);
          ctx.fillStyle = brushColor;
          ctx.fillRect(x - 1, y - 1, 3, 3);
        };
        canvas.addEventListener("pointerdown", (e) => {
          painting = true;
          canvas.setPointerCapture(e.pointerId);
          paintAt(e.clientX, e.clientY);
        });
        canvas.addEventListener("pointermove", (e) => {
          if (painting) paintAt(e.clientX, e.clientY);
        });
        canvas.addEventListener("pointerup", () => {
          painting = false;
        });

        const controls = document.createElement("div");
        controls.className = "wardrobe-paint-controls";

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = part.color;
        colorInput.addEventListener("input", () => {
          brushColor = colorInput.value;
        });
        controls.appendChild(colorInput);

        const clearCanvasBtn = document.createElement("button");
        clearCanvasBtn.type = "button";
        clearCanvasBtn.className = "builder-small-button";
        clearCanvasBtn.textContent = "Fill blank";
        clearCanvasBtn.addEventListener("click", () => {
          ctx.fillStyle = brushColor;
          ctx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
        });
        controls.appendChild(clearCanvasBtn);

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "builder-primary";
        saveBtn.textContent = "Save texture";
        saveBtn.addEventListener("click", async () => {
          await saveCanvasAsTexture(canvas);
          render();
        });
        controls.appendChild(saveBtn);

        section.appendChild(controls);
        return section;
      }

      function buildOutfitsSection() {
        const section = document.createElement("div");
        section.className = "builder-section builder-library";
        const heading = document.createElement("h2");
        heading.textContent = "Outfits";
        section.appendChild(heading);

        const actions = document.createElement("div");
        actions.className = "builder-library-controls";
        const saveNewBtn = document.createElement("button");
        saveNewBtn.type = "button";
        saveNewBtn.className = "builder-primary";
        saveNewBtn.textContent = "Save as new outfit";
        saveNewBtn.addEventListener("click", () => {
          const name = window.prompt("Name this outfit:", "New Outfit");
          if (name === null) return;
          const outfit = outfitStore.create(name, appearanceStore.snapshot());
          appearanceStore.currentOutfitId = outfit.id;
          render();
        });
        actions.appendChild(saveNewBtn);

        const current = appearanceStore.currentOutfitId ? outfitStore.get(appearanceStore.currentOutfitId) : null;
        if (current) {
          const updateBtn = document.createElement("button");
          updateBtn.type = "button";
          updateBtn.className = "builder-small-button";
          updateBtn.textContent = `Update "${current.name}"`;
          updateBtn.addEventListener("click", () => outfitStore.updateAppearance(current.id, appearanceStore.snapshot()));
          actions.appendChild(updateBtn);
        }
        section.appendChild(actions);

        const list = document.createElement("ul");
        list.className = "builder-library-list";
        const outfits = outfitStore.all();
        if (outfits.length === 0) {
          const empty = document.createElement("li");
          empty.className = "builder-empty";
          empty.textContent = "No outfits saved yet.";
          list.appendChild(empty);
        }
        for (const outfit of outfits) {
          list.appendChild(buildOutfitRow(outfit));
        }
        section.appendChild(list);
        return section;
      }

      function buildOutfitRow(outfit) {
        const li = document.createElement("li");
        // styled via .builder-library-list li, matching Builder's own list rows
        if (outfit.id === appearanceStore.currentOutfitId) li.classList.add("selected");

        const name = document.createElement("span");
        name.className = "builder-library-meta";
        name.textContent = outfit.name;
        li.appendChild(name);

        const actions = document.createElement("div");
        actions.className = "builder-inline-row";

        const loadBtn = document.createElement("button");
        loadBtn.type = "button";
        loadBtn.className = "builder-icon-button";
        loadBtn.textContent = "Wear";
        loadBtn.addEventListener("click", () => {
          appearanceStore.setAppearance(outfit.appearance, outfit.id);
          render();
        });
        actions.appendChild(loadBtn);

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "builder-icon-button";
        renameBtn.textContent = "Rename";
        renameBtn.addEventListener("click", () => {
          const name = window.prompt("Rename outfit:", outfit.name);
          if (name === null) return;
          outfitStore.rename(outfit.id, name);
          render();
        });
        actions.appendChild(renameBtn);

        const duplicateBtn = document.createElement("button");
        duplicateBtn.type = "button";
        duplicateBtn.className = "builder-icon-button";
        duplicateBtn.textContent = "Duplicate";
        duplicateBtn.addEventListener("click", () => {
          outfitStore.duplicate(outfit.id);
          render();
        });
        actions.appendChild(duplicateBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "builder-icon-button";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", async () => {
          if (!window.confirm(`Delete "${outfit.name}"? This can't be undone.`)) return;
          const textureIds = Object.values(outfit.appearance.parts).map((p) => p.textureId).filter(Boolean);
          outfitStore.remove(outfit.id);
          if (appearanceStore.currentOutfitId === outfit.id) appearanceStore.currentOutfitId = null;
          for (const textureId of textureIds) await cleanupTextureIfUnused(textureId);
          render();
        });
        actions.appendChild(deleteBtn);

        li.appendChild(actions);
        return li;
      }

      render();
      refreshPreview();
      const offAppearance = appearanceStore.events.on("appearance:changed", () => {
        refreshPreview();
        render();
      });
      const offOutfits = outfitStore.events.on("outfits:changed", render);

      return () => {
        disposed = true;
        offAppearance();
        offOutfits();
        preview.dispose();
      };
    },
  };
}
