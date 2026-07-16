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
 */
export function createWardrobePhoneApp({ appearanceStore, outfitStore }) {
  return {
    id: "wardrobe",
    label: "Wardrobe",
    glyph: "\uD83D\uDC55",
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

      const list = document.createElement("div");
      list.className = "workshop-phone-list";
      container.appendChild(list);

      function render() {
        list.innerHTML = "";
        const outfits = outfitStore.all();
        if (outfits.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No saved outfits yet.";
          list.appendChild(empty);
          return;
        }
        for (const outfit of outfits) list.appendChild(buildRow(outfit));
      }

      function buildRow(outfit) {
        const row = document.createElement("div");
        row.className = "workshop-phone-list-row";
        if (outfit.id === appearanceStore.currentOutfitId) row.classList.add("active");

        const swatch = document.createElement("span");
        swatch.className = "workshop-phone-swatch";
        swatch.style.background = "var(--screen-glow)";
        row.appendChild(swatch);

        const name = document.createElement("span");
        name.className = "workshop-phone-list-label";
        name.textContent = outfit.name;
        row.appendChild(name);

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = "workshop-phone-small-button";
        applyBtn.textContent = "Apply";
        applyBtn.addEventListener("click", () => {
          if (outfit.bodyModelId && outfit.bodyModelId !== appearanceStore.bodyModelId) appearanceStore.setBodyModel(outfit.bodyModelId);
          appearanceStore.setAppearance(outfit.appearance, outfit.id);
          render();
        });
        row.appendChild(applyBtn);
        return row;
      }

      render();
      const offOutfits = outfitStore.events.on("outfits:changed", render);
      return () => offOutfits();
    },
  };
}
