/**
 * createToolStorageOverlay
 * -------------------------
 * A clearly-labelled placeholder. No inventory system exists yet in this
 * phase; the overlay says so rather than faking one.
 */
export function createToolStorageOverlay() {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Tool storage";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "An inventory system will live here eventually — tracking tools and supplies. For now, this cabinet is just a placeholder with a label on it.";
      panelEl.append(heading, empty);
      return null;
    },
  };
}
