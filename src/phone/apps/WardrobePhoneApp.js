/**
 * createWardrobePhoneApp
 * -------------------------
 * "This should NOT replace the full Player Creator... allow players to
 * change between saved outfits, save the current outfit, view outfit
 * previews." Deliberately lighter than the computer's own full Wardrobe
 * — no live 3D preview here (building and disposing a `PreviewRenderer`
 * scene for a small phone screen would be a disproportionate amount of
 * machinery for something meant to be glanced at while walking around);
 * a plain colour swatch stands in for "a preview" on this quick,
 * portable surface. The full, live-preview editor stays exactly where
 * it already is — the Workshop computer.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — "each app
 * should read as distinctly itself." A closet reads as a grid of
 * garments, not a scrolling list of rows, so outfits became cards: a
 * genuine per-outfit colour (the torso part's own, the single most
 * visually representative part of an outfit) instead of the identical
 * placeholder swatch every outfit used to share regardless of what it
 * actually looked like — "a preview," honestly, not just labelled as
 * one. The whole card is the tap target (matching how the home screen's
 * own app tiles already work), not a separate "Apply" button glued on.
 */
export function createWardrobePhoneApp({ appearanceStore, outfitStore }) {
  return {
    id: "wardrobe",
    label: "Wardrobe",
    glyph: "wardrobe",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Wardrobe";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Switch outfits on the go \u2014 the full editor stays on the Workshop computer.";
      container.append(heading, subtitle);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "workshop-phone-primary-button";
      saveBtn.textContent = "Save Current Outfit";
      saveBtn.addEventListener("click", () => {
        const name = window.prompt("Name this outfit:", "New Outfit");
        if (name) outfitStore.create(name, appearanceStore.snapshot(), appearanceStore.bodyModelId);
      });
      container.appendChild(saveBtn);

      const grid = document.createElement("div");
      grid.className = "workshop-phone-outfit-grid";
      grid.setAttribute("role", "list");
      container.appendChild(grid);

      function render() {
        grid.innerHTML = "";
        const outfits = outfitStore.all();
        if (outfits.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No saved outfits yet.";
          grid.appendChild(empty);
          return;
        }
        for (const outfit of outfits) grid.appendChild(buildCard(outfit));
      }

      /** One list item per outfit (`cell`, a plain non-interactive div —
       *  the thing `role="list"` above actually expects as a child) each
       *  containing one real, whole-card `<button>` — not `role="listitem"`
       *  on the button itself, which would silently strip its own native
       *  button semantics from assistive tech, the same way stacking an
       *  unrelated role always does. */
      function buildCard(outfit) {
        const isActive = outfit.id === appearanceStore.currentOutfitId;
        const cell = document.createElement("div");
        cell.className = "workshop-phone-outfit-cell";
        cell.setAttribute("role", "listitem");

        const card = document.createElement("button");
        card.type = "button";
        card.className = "workshop-phone-outfit-card" + (isActive ? " active" : "");
        if (isActive) card.setAttribute("aria-current", "true");
        card.setAttribute("aria-label", isActive ? `${outfit.name} — currently worn` : `Apply ${outfit.name}`);

        const swatch = document.createElement("span");
        swatch.className = "workshop-phone-outfit-swatch";
        swatch.style.background = outfit.appearance?.parts?.torso?.color ?? "var(--screen-glow)";
        swatch.setAttribute("aria-hidden", "true");
        card.appendChild(swatch);

        const name = document.createElement("span");
        name.className = "workshop-phone-outfit-name";
        name.textContent = outfit.name;
        card.appendChild(name);

        card.addEventListener("click", () => {
          if (outfit.bodyModelId && outfit.bodyModelId !== appearanceStore.bodyModelId) appearanceStore.setBodyModel(outfit.bodyModelId);
          appearanceStore.setAppearance(outfit.appearance, outfit.id);
          render();
        });

        cell.appendChild(card);
        return cell;
      }

      render();
      const offOutfits = outfitStore.events.on("outfits:changed", render);
      return () => offOutfits();
    },
  };
}
